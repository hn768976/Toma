import { BUCKET_SHARPNESS, GRAIN_TILE_COUNT, GRAIN_TILE_SIZE } from "./constants";
import { COLOR_BUCKETS, PALETTES, rgba, type Rgb, type VariantName } from "./palette";
import { mulberry32 } from "./random";

// Every particle is drawn from a cached sprite scaled to size, rather
// than from a per-element filter: at 1500 particles a filter per element
// is what turns a 20s render into an overnight one. The blur is baked
// into the sprite's radial falloff.
const SPRITE_SIZE = 128;

const createCanvas = (size: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

// Radial alpha profile. `sharpness` 0 gives a fully diffuse orb with no
// flat core (a blurred near particle); 1 gives a crisp disc with a thin
// edge (the sharp mid-depth band).
const falloff = (r: number, sharpness: number) => {
  const core = 0.08 + 0.46 * sharpness;
  if (r <= core) {
    return 1;
  }
  const t = (r - core) / (1 - core);
  return Math.exp(-Math.pow(t, 1.5) * 4.6);
};

// Many stops, not three: a coarse gradient is a visible ring on a soft
// orb once it is scaled up to 50+ px at 4K.
const GRADIENT_STOPS = 24;

const buildDot = (color: Rgb, sharpness: number) => {
  const canvas = createCanvas(SPRITE_SIZE);
  const ctx = canvas.getContext("2d")!;
  const c = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (let i = 0; i <= GRADIENT_STOPS; i++) {
    const r = i / GRADIENT_STOPS;
    gradient.addColorStop(r, rgba(color, i === GRADIENT_STOPS ? 0 : falloff(r, sharpness)));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
};

// A wide, very dim halo. Drawn under the sharp mid-depth particles and
// the sparkle flashes only.
const buildBloom = (color: Rgb) => {
  const canvas = createCanvas(SPRITE_SIZE);
  const ctx = canvas.getContext("2d")!;
  const c = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (let i = 0; i <= GRADIENT_STOPS; i++) {
    const r = i / GRADIENT_STOPS;
    const a = i === GRADIENT_STOPS ? 0 : Math.pow(1 - r, 2.6);
    gradient.addColorStop(r, rgba(color, a));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
};

// The four-point cross that turns warm dust into glitter. Arms are thin
// tapered gradients; the sprite is drawn only a few pixels across at 4K
// so it reads as a glint, not as a drawn star.
const buildSparkleCross = (color: Rgb) => {
  const canvas = createCanvas(SPRITE_SIZE);
  const ctx = canvas.getContext("2d")!;
  const c = SPRITE_SIZE / 2;
  ctx.globalCompositeOperation = "lighter";
  for (let axis = 0; axis < 2; axis++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((axis * Math.PI) / 2);
    const gradient = ctx.createLinearGradient(-c, 0, c, 0);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const d = Math.abs(t - 0.5) * 2;
      gradient.addColorStop(t, rgba(color, Math.pow(1 - d, 3)));
    }
    ctx.fillStyle = gradient;
    // A tapered bar: narrow enough that the cross has no visible body.
    ctx.beginPath();
    ctx.moveTo(-c, 0);
    ctx.lineTo(0, -c * 0.055);
    ctx.lineTo(c, 0);
    ctx.lineTo(0, c * 0.055);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  return canvas;
};

export type SpriteSet = {
  /** [depthBucket][colorBucket] */
  dots: HTMLCanvasElement[][];
  bloom: HTMLCanvasElement;
  sparkleCore: HTMLCanvasElement;
  sparkleCross: HTMLCanvasElement;
  sparkleBloom: HTMLCanvasElement;
  grain: HTMLCanvasElement[];
};

// Grain tiles double as dithering for the glow gradient. Twelve tiles
// divide the 600-frame loop evenly, so the grain cycle closes too.
const buildGrainTiles = () => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = createCanvas(GRAIN_TILE_SIZE);
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const rand = mulberry32(9176 + t * 7919);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = rand();
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(v * v * 255);
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

const cache = new Map<VariantName, SpriteSet>();

export const getSprites = (variant: VariantName): SpriteSet => {
  const cached = cache.get(variant);
  if (cached) {
    return cached;
  }
  const palette = PALETTES[variant];
  const set: SpriteSet = {
    dots: BUCKET_SHARPNESS.map((sharpness) =>
      Array.from({ length: COLOR_BUCKETS }, (_unused, colorIndex) =>
        buildDot(palette.particleRamp[colorIndex], sharpness),
      ),
    ),
    bloom: buildBloom(palette.particleRamp[1]),
    sparkleCore: buildDot(palette.sparkle, 0.55),
    sparkleCross: buildSparkleCross(palette.sparkle),
    sparkleBloom: buildBloom(palette.sparkle),
    grain: buildGrainTiles(),
  };
  cache.set(variant, set);
  return set;
};
