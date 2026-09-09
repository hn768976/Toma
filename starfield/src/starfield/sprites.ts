import type {Palette} from './palettes';

export type SpriteSet = {
  points: HTMLCanvasElement[];
  heroes: HTMLCanvasElement[];
};

const POINT_SIZE = 64;
const HERO_SIZE = 256;

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/**
 * A point star: white-hot centre, a tight coloured core, then a fast falloff.
 * Drawn once per tint and reused ~12,000 times a frame — building a canvas
 * gradient per star would cost more than the rest of the render combined.
 */
const buildPointSprite = (color: string): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = c.height = POINT_SIZE;
  const ctx = c.getContext('2d')!;
  const r = POINT_SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, rgba(color, 0.95));
  g.addColorStop(0.34, rgba(color, 0.3));
  g.addColorStop(0.62, rgba(color, 0.06));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, POINT_SIZE, POINT_SIZE);
  return c;
};

/**
 * A hero star: the same core, a much wider halo, and a faint four-point
 * diffraction cross. The spikes are deliberately weak — they should suggest a
 * lens, not announce one.
 */
const buildHeroSprite = (color: string): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = c.height = HERO_SIZE;
  const ctx = c.getContext('2d')!;
  const r = HERO_SIZE / 2;

  ctx.globalCompositeOperation = 'lighter';

  // Diffraction cross first, so the core burns through it.
  const spikeLen = r * 0.92;
  const spikeWidth = r * 0.04;
  for (const vertical of [false, true]) {
    const g = ctx.createLinearGradient(
      vertical ? r : r - spikeLen,
      vertical ? r - spikeLen : r,
      vertical ? r : r + spikeLen,
      vertical ? r + spikeLen : r,
    );
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.32, rgba(color, 0.05));
    g.addColorStop(0.5, rgba(color, 0.15));
    g.addColorStop(0.68, rgba(color, 0.05));
    g.addColorStop(1, rgba(color, 0));
    ctx.save();
    // Taper the spike by masking it with a soft radial falloff.
    ctx.fillStyle = g;
    if (vertical) {
      ctx.fillRect(r - spikeWidth / 2, r - spikeLen, spikeWidth, spikeLen * 2);
    } else {
      ctx.fillRect(r - spikeLen, r - spikeWidth / 2, spikeLen * 2, spikeWidth);
    }
    ctx.restore();
  }
  // Soften the spike ends so they fade out instead of stopping.
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(r, r, 0, r, r, r);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.7, 'rgba(0,0,0,0.85)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, HERO_SIZE, HERO_SIZE);

  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.045, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.07, rgba(color, 0.7));
  g.addColorStop(0.13, rgba(color, 0.18));
  g.addColorStop(0.26, rgba(color, 0.05));
  g.addColorStop(0.5, rgba(color, 0.012));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, HERO_SIZE, HERO_SIZE);

  return c;
};

export const buildSprites = (palette: Palette): SpriteSet => ({
  points: palette.stars.map((s) => buildPointSprite(s.color)),
  heroes: palette.stars.map((s) => buildHeroSprite(s.color)),
});
