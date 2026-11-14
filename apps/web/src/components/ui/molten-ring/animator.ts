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
  /** A card was pressed rather than dragged. */
  onCardClick: (index: number) => void;
}

export function createRingAnimator(ctx: RingAnimatorContext) {
  const {
    canvas,
    gl,
    program,
    quad,
    u,
    readColor,
    count,
    cols,
    reduced,
    getConfig,
    onActiveChange,
    onCardClick,
  } = ctx;
  const FRONT = Math.floor(count / 2);

  let width = 0;
  let height = 0;
  // The ring starts with the newest entry at the front: the front card is
  // (progress + FRONT), so the rotation starts at -FRONT (UI_UX_STANDARDS 7.3:
  // "the newest entry is the initial view").
  let progress = -FRONT;
  let goal = -FRONT;
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
      // The step accumulates on the target the ring is already heading to, not
      // on the rounded position of the moment: a key pressed while the previous
      // tween is still in flight must not lose its step to rounding.
      const base = tween ? tween.to : Math.round(goal);
      tween = {from: goal, to: base + by, at: performance.now()};
      lastInput = performance.now();
      snapped = true;
    },
    stepTo(index: number) {
      // The shortest rotation that brings the named card to the front, taken
      // from wherever the ring is heading rather than from where it happens to
      // be mid-tween, so a jump issued during a glide still lands on the card.
      const want = (((index - FRONT) % count) + count) % count;
      const base = tween ? tween.to : goal;
      tween = {
        from: goal,
        to: want + Math.round((base - want) / count) * count,
        at: performance.now(),
      };
      lastInput = performance.now();
      snapped = true;
    },
    onWheel(deltaY: number) {
      tween = null;
      goal += deltaY * WHEEL;
      lastInput = performance.now();
      snapped = false;
    },
    onPointerDown(nx: number, ny: number) {
      tween = null;
      // The press position is recorded so that a press that never moves can
      // still be resolved to the card under the pointer.
      pointerX = nx;
      pointerY = ny;
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
      if (!wasClick) return;
      // The card under the pointer is resolved here rather than read from the
      // last frame: a fast approach suppresses the hover, and a press that
      // follows one would otherwise be lost.
      const conf = getConfig();
      const long = width * conf.cardSize;
      const short = long / conf.cardRatio;
      const mx = pointerX >= 0 ? pointerX - width / 2 : 0;
      const my = pointerY >= 0 ? height / 2 - pointerY : 0;
      const pressed = detectHoveredCard(count, at, mx, my, long, short, pointerX >= 0 ? 1 : 0, 0);
      if (pressed < 0) return;
      hovered = pressed;
      const want = (((pressed - FRONT) % count) + count) % count;
      const base = tween ? tween.to : goal;
      tween = {
        from: goal,
        to: want + Math.round((base - want) / count) * count,
        at: performance.now(),
      };
      snapped = true;
      // The press is reported as well as the rotation, so the owner of the
      // ring can open what the card stands for.
      onCardClick(pressed);
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
