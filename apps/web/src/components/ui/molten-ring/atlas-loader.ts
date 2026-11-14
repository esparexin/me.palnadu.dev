import {packAtlas} from './atlas';
import type {MoltenRingItem} from './types';

export function loadAtlasTexture(
  gl: WebGL2RenderingContext,
  items: MoltenRingItem[],
  count: number,
  cols: number,
  cell: number,
  cardRatio: number,
  onLoaded: (texture: WebGLTexture) => void,
): {images: HTMLImageElement[]; cleanup: () => void} {
  let loaded = 0;
  let atlas: WebGLTexture | null = null;
  const images = items.slice(0, count).map((item) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    const settle = () => {
      if (++loaded < count) return;
      atlas = gl.createTexture();
      if (!atlas) return;
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        packAtlas(images, cols, cell, cardRatio),
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      onLoaded(atlas);
    };
    image.onload = settle;
    image.onerror = () => settle();
    image.src = item.image;
    return image;
  });

  return {
    images,
    cleanup: () => {
      for (const image of images) image.onload = null;
      if (atlas) gl.deleteTexture(atlas);
    },
  };
}
