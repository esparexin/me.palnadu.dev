export interface GestureHandlers {
  onWheel: (deltaY: number) => void;
  onPointerDown: (clientY: number) => void;
  onPointerMove: (nx: number, ny: number, deltaTravel: number) => void;
  onPointerUp: (wasClick: boolean) => void;
  onPointerLeave: () => void;
}

export function attachRingGestures(
  canvas: HTMLCanvasElement,
  handlers: GestureHandlers,
  clickSlop: number,
): () => void {
  let dragFrom: number | null = null;
  let dragTravel = 0;

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    handlers.onWheel(event.deltaY);
  };

  const onDown = (event: PointerEvent) => {
    dragFrom = event.clientY;
    dragTravel = 0;
    canvas.setPointerCapture(event.pointerId);
    handlers.onPointerDown(event.clientY);
  };

  const onMove = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    const nx = event.clientX - box.left;
    const ny = event.clientY - box.top;
    let travel = 0;
    if (dragFrom !== null) {
      travel = dragFrom - event.clientY;
      dragTravel += Math.abs(travel);
      dragFrom = event.clientY;
    }
    handlers.onPointerMove(nx, ny, travel);
  };

  const onUp = () => {
    const wasClick = dragFrom !== null && dragTravel < clickSlop;
    dragFrom = null;
    handlers.onPointerUp(wasClick);
  };

  const onLeave = () => {
    handlers.onPointerLeave();
  };

  canvas.addEventListener('wheel', onWheel, {passive: false});
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);

  return () => {
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onLeave);
  };
}
