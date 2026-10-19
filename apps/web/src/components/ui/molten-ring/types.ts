import type * as React from 'react';

export interface MoltenRingItem {
  /** Cover art URL or local public asset path. */
  image: string;
  /** Shown to the left of the ring while this card is at the front. */
  title: string;
  /** The line to the right of the ring - discipline, year, credential. */
  meta?: string;
}

export interface MoltenRingCarouselProps extends Omit<
  React.ComponentPropsWithoutRef<'section'>,
  'children'
> {
  items: MoltenRingItem[];
  /** Wordmark in the top-left. Omit to drop it. @default undefined */
  brand?: string;
  /** Ring radius, in stage widths. Larger flattens the arc. @default 1 */
  arc?: number;
  /** Card long edge, as a fraction of the stage width. @default 0.265 */
  cardSize?: number;
  /** Card long edge / short edge. Art is cover-fitted into it. @default 1.5 */
  cardRatio?: number;
  /** Fusion radius between neighbours, in card long-edges. @default 0.087 */
  fuse?: number;
  /** String threads between cards as they pull apart. @default true */
  threads?: boolean;
  /** Optical band that bends the image at the upper and lower borders. @default true */
  glass?: boolean;
  /** Extra classes on the root surface. @default undefined */
  className?: string;
}
