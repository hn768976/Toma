import type {RefObject} from 'react';
import type {VariantConfig} from './variants';
import type {TextBuffer} from './lib/buffers';
import type {CorruptionEvent, TearEvent} from './lib/glitch';

/**
 * Everything the layers need for one frame. Each layer is a component that draws
 * into the same 4K canvas from its own layout effect; React runs sibling layout
 * effects in tree order, so the compositing order is the order they are mounted.
 */
export type Stage = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cfg: VariantConfig;
  ready: boolean;
  frame: number;
  /** frame % 300 — every schedule in the piece is derived from this. */
  f: number;
  instability: number;
  pulse: number;
  scrollY: number;
  washAlpha: number;
  striation: number;
  text: TextBuffer;
  washTexture: HTMLCanvasElement;
  scanlineTile: HTMLCanvasElement;
  grainTiles: HTMLCanvasElement[];
  frameScratch: HTMLCanvasElement;
  bandScratch: HTMLCanvasElement;
  tears: TearEvent[];
  corruptions: CorruptionEvent[];
};
