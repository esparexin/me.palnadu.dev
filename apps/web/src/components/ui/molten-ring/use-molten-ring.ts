'use client';

import * as React from 'react';
import {CLICK_SLOP, MAX_CARDS} from './constants';
import {buildProgram, createColorReader, createQuadBuffer, createUniformGetter} from './gl-utils';
import {QUAD_VERT, RING_FRAG} from './shaders';
import {attachRingGestures} from './gestures';
import {loadAtlasTexture} from './atlas-loader';
import {createRingAnimator} from './animator';
import type {MoltenRingItem} from './types';

export interface MoltenRingConfig {
  arc: number;
  cardSize: number;
  cardRatio: number;
  fuse: number;
  threads: boolean;
  glass: boolean;
}

export function useMoltenRing(items: MoltenRingItem[], config: MoltenRingConfig) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [active, setActive] = React.useState(0);
  const [reduced, setReduced] = React.useState(false);
  const [supported, setSupported] = React.useState(true);

  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  const settingsRef = React.useRef(config);
  settingsRef.current = config;
  const stepRef = React.useRef<(by: number) => void>(() => {});

  const count = Math.min(items.length, MAX_CARDS);
  const sources = items.map((item) => item.image).join(' ');

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !count) return;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) {
      setSupported(false);
      return;
    }

    const readColor = createColorReader();
    const program = buildProgram(gl, QUAD_VERT, RING_FRAG);
    if (!program) return;
    const u = createUniformGetter(gl, program);

    const quadRes = createQuadBuffer(gl);
    if (!quadRes) return;
    const {quad, buffer} = quadRes;

    const COLS = Math.min(4, count);
    const CELL = 512;
    const animator = createRingAnimator({
      canvas,
      gl,
      program,
      quad,
      u,
      readColor,
      count,
      cols: COLS,
      reduced,
      getConfig: () => settingsRef.current,
      onActiveChange: (near) => setActive((prev) => (prev === near ? prev : near)),
    });

    const {cleanup: cleanupAtlas} = loadAtlasTexture(
      gl,
      itemsRef.current,
      count,
      COLS,
      CELL,
      settingsRef.current.cardRatio,
      (tex) => animator.setAtlas(tex),
    );

    animator.resize();
    const observer = new ResizeObserver(() => animator.resize());
    observer.observe(canvas);

    stepRef.current = (by: number) => animator.step(by);

    const cleanupGestures = attachRingGestures(
      canvas,
      {
        onWheel: (deltaY) => animator.onWheel(deltaY),
        onPointerDown: () => animator.onPointerDown(),
        onPointerMove: (nx, ny, travel) => animator.onPointerMove(nx, ny, travel),
        onPointerUp: (wasClick) => animator.onPointerUp(wasClick),
        onPointerLeave: () => animator.onPointerLeave(),
      },
      CLICK_SLOP,
    );

    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      animator.render(now);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      cleanupGestures();
      cleanupAtlas();
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(quad);
      gl.deleteProgram(program);
    };
  }, [sources, count, reduced]);

  return {canvasRef, active, step: (by: number) => stepRef.current(by), supported, count};
}
