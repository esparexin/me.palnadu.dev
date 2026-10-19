import {
  CLICK_MS,
  DRAG,
  EASE,
  ENTRY_MS,
  MAX_CARDS,
  MAX_STRANDS,
  SNAP_EASE,
  SNAP_IDLE,
  SPACING,
  THEME_EVERY,
  WHEEL,
} from './constants';
import {clamp, inOutCubic, outCubic} from './math';
import {
  applyCardDynamics,
  computeThreadStrands,
  createDynamicsBuffers,
  detectHoveredCard,
  updateCardSlots,
  type CardTransform,
} from './physics';
import {renderRingScene} from './renderer';
import type {MoltenRingConfig} from './use-molten-ring';

export interface RingAnimatorContext {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  quad: WebGLVertexArrayObject;
  u: (name: string) => WebGLUniformLocation | null;
  readColor: (css: string) => [number, number, number];
  count: number;
  cols: number;
  reduced: boolean;
  getConfig: () => MoltenRingConfig;
  onActiveChange: (active: number) => void;
}

export function createRingAnimator(ctx: RingAnimatorContext) {
  const {canvas, gl, program, quad, u, readColor, count, cols, reduced, getConfig, onActiveChange} =
    ctx;
  const FRONT = Math.floor(count / 2);

  let width = 0;
  let height = 0;
  let progress = 0;
  let goal = 0;
  let lastInput = 0;
  let snapped = true;
  let hovered = -1;
  let pointerX = -1;
  let pointerY = -1;
  let pointerSpeed = 0;
  let entry = 0;
  let clock = 0;
  let previous = 0;
  let ticks = 0;
  let tween: {from: number; to: number; at: number} | null = null;
  let ink: [number, number, number] = [0, 0, 0];
  let atlas: WebGLTexture | null = null;

  const dynamics = createDynamicsBuffers(count, MAX_CARDS);
  const strandA = new Float32Array(MAX_STRANDS * 2);
  const strandB = new Float32Array(MAX_STRANDS * 2);
  const strandPar = new Float32Array(MAX_STRANDS * 4);
  const at: CardTransform[] = Array.from({length: count}, () => ({x: 0, y: 0, angle: 0, scale: 1}));

  return {
    setAtlas(tex: WebGLTexture | null) {
      atlas = tex;
    },
    resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    },
    step(by: number) {
      tween = {from: goal, to: Math.round(goal) + by, at: performance.now()};
      lastInput = performance.now();
      snapped = true;
    },
    onWheel(deltaY: number) {
      tween = null;
      goal += deltaY * WHEEL;
      lastInput = performance.now();
      snapped = false;
    },
    onPointerDown() {
      tween = null;
    },
    onPointerMove(nx: number, ny: number, travel: number) {
      pointerSpeed = Math.hypot(nx - pointerX, ny - pointerY);
      pointerX = nx;
      pointerY = ny;
      if (travel !== 0) {
        goal += travel * DRAG;
        lastInput = performance.now();
        snapped = false;
      }
    },
    onPointerUp(wasClick: boolean) {
      if (!wasClick || hovered < 0) return;
      const want = (((hovered - FRONT) % count) + count) % count;
      tween = {
        from: goal,
        to: want + Math.round((goal - want) / count) * count,
        at: performance.now(),
      };
      snapped = true;
    },
    onPointerLeave() {
      pointerX = -1;
      pointerY = -1;
      hovered = -1;
    },
    render(now: number) {
      if (!width || !height) return;
      const dt = previous ? Math.min((now - previous) / 1000, 1 / 20) : 0;
      previous = now;
      clock += dt;
      const conf = getConfig();

      if (ticks++ % THEME_EVERY === 0) ink = readColor(getComputedStyle(canvas).color);
      if (atlas) entry = reduced ? 1 : Math.min(1, entry + (dt * 1000) / ENTRY_MS);
      const spread = inOutCubic(entry);

      if (tween) {
        const t = clamp((now - tween.at) / CLICK_MS, 0, 1);
        goal = tween.from + (tween.to - tween.from) * outCubic(t);
        if (t >= 1) tween = null;
      } else if (!snapped && now - lastInput > SNAP_IDLE) {
        goal = Math.round(goal);
        snapped = true;
      }
      progress += (goal - progress) * (reduced ? 1 : snapped ? SNAP_EASE : EASE);
      const speed = Math.abs(goal - progress);
      const near = (((Math.round(goal) + FRONT) % count) + count) % count;
      onActiveChange(near);

      const long = width * conf.cardSize;
      const short = long / conf.cardRatio;
      const radius = width * conf.arc;
      const angleStep = (short * SPACING) / radius;
      const centreX = -radius;

      updateCardSlots(count, progress, FRONT, angleStep, spread, centreX, radius, at);
      const mx = pointerX >= 0 ? pointerX - width / 2 : 0;
      const my = pointerY >= 0 ? height / 2 - pointerY : 0;
      const present = pointerX >= 0 ? 1 : 0;
      const foundHovered = detectHoveredCard(count, at, mx, my, long, short, present, pointerSpeed);
      if (foundHovered !== -1 || present === 0 || pointerSpeed >= 24) hovered = foundHovered;
      pointerSpeed *= 0.85;

      applyCardDynamics(count, at, mx, my, present, long, hovered, spread, dynamics);
      const strands = conf.threads
        ? computeThreadStrands(count, at, short, long, spread, hovered, strandA, strandB, strandPar)
        : 0;

      renderRingScene(gl, program, quad, u, {
        width,
        height,
        long,
        short,
        count,
        pos: dynamics.pos,
        rot: dynamics.rot,
        scale: dynamics.scale,
        strands,
        strandA,
        strandB,
        strandPar,
        fuse: conf.fuse,
        speed,
        spread,
        clock,
        ink,
        atlas,
        cols,
        mx,
        my,
        present,
        pointerSpeed,
        glass: conf.glass,
        reduced,
      });
    },
  };
}
