export function packAtlas(
  images: HTMLImageElement[],
  cols: number,
  cell: number,
  ratio: number,
): HTMLCanvasElement {
  const rows = Math.ceil(images.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * cell;
  sheet.height = rows * Math.round(cell / ratio);
  const ctx = sheet.getContext('2d');
  if (!ctx) return sheet;
  const cellH = Math.round(cell / ratio);
  images.forEach((image, i) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cellH;
    const scale = Math.max(cell / image.naturalWidth, cellH / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cell, cellH);
    ctx.clip();
    ctx.drawImage(image, x + (cell - w) / 2, y + (cellH - h) / 2, w, h);
    ctx.restore();
  });
  return sheet;
}
