import {
  GRAB,
  MAX_STRANDS,
  NEIGHBOUR_DIM,
  NEIGHBOUR_PUSH,
  NEIGHBOUR_REACH,
  NEIGHBOUR_SCALE,
  PULL,
  REACH,
  RELEASE,
  SAG,
  STRAND,
  STRAND_SNAP,
  SWELL,
  WAIST,
  WELD,
} from './constants';
import {clamp} from './math';

export interface CardTransform {
  x: number;
  y: number;
  angle: number;
  scale: number;
}

export function updateCardSlots(
  count: number,
  progress: number,
  front: number,
  angleStep: number,
  spread: number,
  centreX: number,
  radius: number,
  at: CardTransform[],
): void {
  for (let i = 0; i < count; i++) {
    const itemAt = at[i];
    if (!itemAt) continue;
    const slot = ((((i - progress) % count) + count) % count) - front;
    const angle = slot * angleStep * spread;
    itemAt.angle = angle;
    itemAt.x = centreX + Math.cos(angle) * radius;
    itemAt.y = Math.sin(angle) * radius;
  }
}

export function detectHoveredCard(
  count: number,
  at: CardTransform[],
  mx: number,
  my: number,
  long: number,
  short: number,
  present: number,
  pointerSpeed: number,
): number {
  if (!present || pointerSpeed >= 24) return -1;
  let hovered = -1;
  let best = Infinity;
  for (let i = 0; i < count; i++) {
    const itemAt = at[i];
    if (!itemAt) continue;
    const dx = Math.abs(mx - itemAt.x);
    const dy = Math.abs(my - itemAt.y);
    if (dx > long / 2 || dy > short / 2) continue;
    const distance = dx + dy;
    if (distance < best) {
      best = distance;
      hovered = i;
    }
  }
  return hovered;
}

export interface CardDynamicsBuffers {
  leanX: Float32Array;
  leanY: Float32Array;
  swell: Float32Array;
  dim: Float32Array;
  pos: Float32Array;
  rot: Float32Array;
  scale: Float32Array;
}

export function createDynamicsBuffers(count: number, maxCards: number): CardDynamicsBuffers {
  return {
    leanX: new Float32Array(count),
    leanY: new Float32Array(count),
    swell: new Float32Array(count),
    dim: new Float32Array(count),
    pos: new Float32Array(maxCards * 2),
    rot: new Float32Array(maxCards),
    scale: new Float32Array(maxCards * 4),
  };
}

export function applyCardDynamics(
  count: number,
  at: CardTransform[],
  mx: number,
  my: number,
  present: number,
  long: number,
  hovered: number,
  spread: number,
  buf: CardDynamicsBuffers,
): void {
  for (let i = 0; i < count; i++) {
    const itemAt = at[i];
    if (!itemAt) continue;
    const dx = mx - itemAt.x;
    const dy = my - itemAt.y;
    const pull = present ? Math.max(0, 1 - Math.hypot(dx, dy) / (long * REACH)) : 0;
    const isHovered = i === hovered ? 1 : 0;

    const towardX = dx * (pull * pull) * PULL * long * 0.02;
    const towardY = dy * (pull * pull) * PULL * long * 0.02;
    const currentLeanX = buf.leanX[i] ?? 0;
    const currentLeanY = buf.leanY[i] ?? 0;
    const nextLeanX = currentLeanX + (towardX - currentLeanX) * (pull > 0 ? GRAB : RELEASE);
    const nextLeanY = currentLeanY + (towardY - currentLeanY) * (pull > 0 ? GRAB : RELEASE);
    buf.leanX[i] = nextLeanX;
    buf.leanY[i] = nextLeanY;

    let push = 0;
    let dimTarget = 0;
    if (hovered >= 0 && i !== hovered) {
      const hoveredAt = at[hovered];
      if (hoveredAt) {
        let gap = Math.abs(i - hovered);
        gap = Math.min(gap, count - gap);
        const off = Math.max(0, 1 - gap / NEIGHBOUR_REACH);
        push = Math.sign(itemAt.y - hoveredAt.y || 1) * off * NEIGHBOUR_PUSH * long;
        dimTarget = off * NEIGHBOUR_DIM;
      }
    }
    const currentDim = buf.dim[i] ?? 0;
    const nextDim =
      currentDim + (dimTarget - currentDim) * (dimTarget > currentDim ? GRAB : RELEASE);
    buf.dim[i] = nextDim;

    const wantSwell =
      pull * pull * SWELL +
      isHovered * NEIGHBOUR_SCALE -
      dimTarget * (NEIGHBOUR_SCALE / NEIGHBOUR_DIM);
    const currentSwell = buf.swell[i] ?? 0;
    const nextSwell =
      currentSwell + (wantSwell - currentSwell) * (wantSwell > currentSwell ? GRAB : RELEASE);
    buf.swell[i] = nextSwell;

    itemAt.x += nextLeanX;
    itemAt.y += nextLeanY + push;
    itemAt.scale = (0.18 + 0.82 * spread) * (1 + nextSwell);

    buf.pos[i * 2] = itemAt.x;
    buf.pos[i * 2 + 1] = itemAt.y;
    buf.rot[i] = itemAt.angle;
    buf.scale[i * 4] = itemAt.scale;
    buf.scale[i * 4 + 1] = itemAt.scale;
    buf.scale[i * 4 + 2] = 1 - nextDim;
    buf.scale[i * 4 + 3] = i;
  }
}

export function computeThreadStrands(
  count: number,
  at: CardTransform[],
  short: number,
  long: number,
  spread: number,
  hovered: number,
  strandA: Float32Array,
  strandB: Float32Array,
  strandPar: Float32Array,
): number {
  let strands = 0;
  for (let i = 0; i < count && strands < MAX_STRANDS; i++) {
    const j = (i + 1) % count;
    const atI = at[i];
    const atJ = at[j];
    if (!atI || !atJ) continue;
    const gap = Math.hypot(atJ.x - atI.x, atJ.y - atI.y);
    const opening = (gap - short) / (short * STRAND_SNAP);
    if (opening > 1 || opening < -1) continue;
    const strength = Math.max(1 - spread, hovered === i || hovered === j ? 1 : 0);
    if (strength < 0.02) continue;
    const rEnd = short * 0.5 * STRAND * strength * (1 - clamp(opening, 0, 1));
    if (rEnd <= 0.5) continue;
    strandA[strands * 2] = atI.x;
    strandA[strands * 2 + 1] = atI.y;
    strandB[strands * 2] = atJ.x;
    strandB[strands * 2 + 1] = atJ.y;
    strandPar[strands * 4] = rEnd;
    strandPar[strands * 4 + 1] = rEnd * WAIST;
    strandPar[strands * 4 + 2] = SAG * long * clamp(opening, 0, 1);
    strandPar[strands * 4 + 3] = WELD * long;
    strands++;
  }
  return strands;
}
