import {
  BAND,
  CORNER,
  CROSSFADE,
  CURSOR_FUSE,
  CURSOR_REACH,
  FRINGE,
  REFRACT,
  RIPPLE,
  RIPPLE_FREQ,
  SHEEN,
  SQUEEZE,
  WAVE,
  WAVE_FREQ,
  WAVE_SPEED,
  WOBBLE,
} from './constants';
import {clamp} from './math';

export interface RenderState {
  width: number;
  height: number;
  long: number;
  short: number;
  count: number;
  pos: Float32Array;
  rot: Float32Array;
  scale: Float32Array;
  strands: number;
  strandA: Float32Array;
  strandB: Float32Array;
  strandPar: Float32Array;
  fuse: number;
  speed: number;
  spread: number;
  clock: number;
  ink: [number, number, number];
  atlas: WebGLTexture | null;
  cols: number;
  mx: number;
  my: number;
  present: number;
  pointerSpeed: number;
  glass: boolean;
  reduced: boolean;
}

export function renderRingScene(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  quad: WebGLVertexArrayObject,
  u: (name: string) => WebGLUniformLocation | null,
  s: RenderState,
): void {
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindVertexArray(quad);

  gl.uniform2f(u('uResolution'), s.width, s.height);
  gl.uniform2f(u('uSize'), s.long, s.short);
  gl.uniform1f(u('uCorner'), CORNER * s.long);
  gl.uniform1f(u('uCount'), s.count);
  gl.uniform2fv(u('uCentre'), s.pos);
  gl.uniform1fv(u('uAngle'), s.rot);
  gl.uniform4fv(u('uCardState'), s.scale);
  gl.uniform1f(u('uStrandCount'), s.strands);
  gl.uniform2fv(u('uStrandA'), s.strandA);
  gl.uniform2fv(u('uStrandB'), s.strandB);
  gl.uniform4fv(u('uStrandPar'), s.strandPar);
  gl.uniform1f(u('uFuse'), s.fuse * s.long);
  gl.uniform1f(
    u('uJitter'),
    s.reduced ? 0 : WOBBLE * s.long * clamp(s.speed * 2 + (1 - s.spread), 0, 1),
  );
  gl.uniform1f(u('uTime'), s.reduced ? 0 : s.clock);
  gl.uniform3fv(u('uColor'), s.ink);
  gl.uniform1f(u('uCrossfade'), CROSSFADE * s.long);
  gl.uniform1f(u('uHasArt'), s.atlas ? 1 : 0);
  gl.uniform2f(u('uGrid'), s.cols, Math.ceil(s.count / s.cols));
  gl.uniform4f(u('uCursor'), s.mx, s.my, s.present, CURSOR_FUSE * s.long);
  gl.uniform4f(
    u('uWake'),
    CURSOR_REACH * s.long,
    s.reduced ? 0 : WAVE * s.long * clamp(s.pointerSpeed / 40, 0, 1),
    WAVE_FREQ / s.long,
    WAVE_SPEED,
  );
  gl.uniform1f(u('uLipDepth'), s.glass ? BAND * s.height : 0);
  gl.uniform4f(u('uLip'), REFRACT * s.long, SQUEEZE, RIPPLE * s.long, RIPPLE_FREQ / s.long);
  gl.uniform1f(u('uFringe'), FRINGE);
  gl.uniform1f(u('uSheen'), SHEEN);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, s.atlas);
  gl.uniform1i(u('uAtlas'), 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
