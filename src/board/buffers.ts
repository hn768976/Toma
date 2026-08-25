import {
  BLOOM_SCALE,
  GRAIN_TILE,
  HEIGHT,
  PLANES,
  STRIPE_PERIOD,
  WIDTH,
} from './constants';
import { buildGrainTiles, buildStripeTile } from './grain';

export type Surface = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
};

export type Plane = Surface & {
  scale: number;
  /** Destination for this plane's single blur pass, at the plane's own size. */
  blur: Surface | null;
  /** A second, wider blur of the same content, for the defocus glow. */
  glow: Surface | null;
};

const surface = (w: number, h: number): Surface => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')!, w, h };
};

export type Buffers = {
  planes: Plane[];
  bloom: Surface;
  grain: HTMLCanvasElement[];
  stripe: CanvasPattern;
  grainPatterns: CanvasPattern[];
};

/**
 * Allocate every offscreen surface once.
 *
 * The mid and far planes are rendered below frame resolution. They are blurred
 * far past the point where their own pixel grid could show, so the only thing
 * their size costs is speed — and at 4K that is the whole budget.
 */
export const buildBuffers = (): Buffers => {
  const planes: Plane[] = PLANES.map((p) => {
    const w = Math.round(WIDTH * p.scale);
    const h = Math.round(HEIGHT * p.scale);
    const base = surface(w, h);
    return {
      ...base,
      scale: p.scale,
      blur: p.blur > 0 ? surface(w, h) : null,
      glow: p.glow > 0 ? surface(w, h) : null,
    };
  });

  const bloom = surface(
    Math.round(WIDTH * BLOOM_SCALE),
    Math.round(HEIGHT * BLOOM_SCALE),
  );

  const grain = buildGrainTiles();
  const scratch = planes[0].ctx;

  return {
    planes,
    bloom,
    grain,
    stripe: scratch.createPattern(buildStripeTile(STRIPE_PERIOD), 'repeat')!,
    grainPatterns: grain.map((g) => scratch.createPattern(g, 'repeat')!),
  };
};

export const GRAIN_TILE_SIZE = GRAIN_TILE;
