import {
  BACKGROUND_BOTTOM,
  BACKGROUND_TOP,
  BAND_GLOW_ALPHA,
  BREATH_RADIUS,
  GLOW_ALPHA,
  GLOW_FLATTEN,
  GLOW_RADIUS_FRACTION,
  GRAIN_ALPHA,
  GRAIN_TILE_SIZE,
  HALO_SIZE_SCALE,
  HUE_STEPS,
  LEVEL_EXP,
  LEVEL_FLOOR,
  LEVEL_STEPS,
  NOISE_GAIN,
  OCTAVES,
  OVERSCAN_X,
  SLOPE_GAIN,
} from "./constants";
import type { WaveLayout } from "./field";
import type { Noise4D } from "./noise";
import { cssColor, paletteTables, type Palette } from "./palette";
import { mulberry32 } from "./random";

const TAU = Math.PI * 2;
const BUCKETS = HUE_STEPS * LEVEL_STEPS;

// Maps the 0..1 noise height onto a brightness multiplier. A lookup
// table because the alternative is ~29,000 Math.pow calls per frame.
const ENERGY_LUT_SIZE = 512;
const ENERGY_LUT = new Float32Array(ENERGY_LUT_SIZE);
for (let i = 0; i < ENERGY_LUT_SIZE; i++) {
  const n = i / (ENERGY_LUT_SIZE - 1);
  ENERGY_LUT[i] = LEVEL_FLOOR + (1 - LEVEL_FLOOR) * Math.pow(n, LEVEL_EXP);
}

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// Scratch buffers. Every entry is overwritten before it is read on each
// frame, so nothing carries over between frames — they exist only to
// keep 29,000-element allocations out of the per-frame path.
type Scratch = {
  count: number;
  cols: number;
  px: Float32Array;
  py: Float32Array;
  bucket: Uint16Array;
  order: Uint32Array;
  ends: Uint32Array;
  circleX: Float32Array;
  circleY: Float32Array;
  prevRow: Float32Array;
};

let scratch: Scratch | null = null;

const getScratch = (count: number, cols: number): Scratch => {
  if (!scratch || scratch.count !== count || scratch.cols !== cols) {
    scratch = {
      count,
      cols,
      px: new Float32Array(count),
      py: new Float32Array(count),
      bucket: new Uint16Array(count),
      order: new Uint32Array(count),
      ends: new Uint32Array(BUCKETS),
      circleX: new Float32Array(cols * OCTAVES.length),
      circleY: new Float32Array(cols * OCTAVES.length),
      prevRow: new Float32Array(cols),
    };
  }
  return scratch;
};

// One soft round sprite per hue bucket, used for the halo around the
// brightest dots. Drawn with "lighter", so the sprite only ever adds.
const spriteCache = new Map<string, HTMLCanvasElement[]>();
const SPRITE_SIZE = 64;

const haloSprites = (palette: Palette): HTMLCanvasElement[] | null => {
  const cached = spriteCache.get(palette.id);
  if (cached) return cached;
  const tables = paletteTables(palette);
  const sprites: HTMLCanvasElement[] = [];
  for (let h = 0; h < HUE_STEPS; h++) {
    const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const c = SPRITE_SIZE / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    const stop = tables.hueStops[h];
    gradient.addColorStop(0, cssColor(stop, 0.9));
    gradient.addColorStop(0.35, cssColor(stop, 0.32));
    gradient.addColorStop(1, cssColor(stop, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    sprites.push(canvas);
  }
  spriteCache.set(palette.id, sprites);
  return sprites;
};

let grainTile: HTMLCanvasElement | null = null;

const getGrainTile = (): HTMLCanvasElement | null => {
  if (grainTile) return grainTile;
  const canvas = createCanvas(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
  const rand = mulberry32(0x5eed);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.round(rand() * 255);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return canvas;
};

export type DrawArgs = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  frame: number;
  durationInFrames: number;
  layout: WaveLayout;
  palette: Palette;
  noise: Noise4D;
};

// Sums the octaves at one point of the field. cx/cy are the point's
// position on the sampling circle for that octave (see drawWaveFrame).
const sampleHeight = (
  noise: Noise4D,
  circleX: Float32Array,
  circleY: Float32Array,
  col: number,
  cols: number,
  depth: number,
  breath: Float32Array,
): number => {
  let n = 0;
  for (let o = 0; o < OCTAVES.length; o++) {
    const octave = OCTAVES[o];
    const idx = o * cols + col;
    n +=
      octave.weight *
      noise(circleX[idx], circleY[idx], depth * octave.depthScale, breath[o]);
  }
  return n;
};

export const drawWaveFrame = ({
  ctx,
  width,
  height,
  frame,
  durationInFrames,
  layout,
  palette,
  noise,
}: DrawArgs) => {
  const t = (frame % durationInFrames) / durationInFrames;
  const { cols, rows, count } = layout;
  const tables = paletteTables(palette);
  const work = getScratch(count, cols);
  const { px, py, bucket, order, ends, circleX, circleY, prevRow } = work;

  // The horizontal axis of the noise field is sampled around a circle,
  // and time rotates that circle. Because each octave travels a whole
  // number of circles per loop, frame `durationInFrames` lands exactly
  // back on frame 0 — the loop is exact, not cross-faded.
  const breath = new Float32Array(OCTAVES.length);
  for (let o = 0; o < OCTAVES.length; o++) {
    const octave = OCTAVES[o];
    breath[o] = BREATH_RADIUS * Math.cos(TAU * t + octave.phase);
    for (let c = 0; c < cols; c++) {
      const theta =
        TAU * (layout.colFieldX[c] * octave.periods - octave.travel * t);
      circleX[o * cols + c] = octave.radius * Math.cos(theta);
      circleY[o * cols + c] = octave.radius * Math.sin(theta);
    }
  }

  // --- Background ---------------------------------------------------
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  backdrop.addColorStop(0, BACKGROUND_TOP);
  backdrop.addColorStop(1, BACKGROUND_BOTTOM);
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  // Find the brightest part of the wave so the glow can sit under it.
  let bestCol = 0;
  let bestHeight = -Infinity;
  const glowDepth = layout.depthZ[Math.floor(rows * 0.7)];
  const step = Math.max(1, Math.floor(cols / 48));
  for (let c = 0; c < cols; c += step) {
    const h = sampleHeight(noise, circleX, circleY, c, cols, glowDepth, breath);
    if (h > bestHeight) {
      bestHeight = h;
      bestCol = c;
    }
  }

  ctx.globalCompositeOperation = "lighter";
  const bandY = layout.horizonY + (layout.nearY - layout.horizonY) * 0.55;

  // Broad glow across the whole band, then a brighter one under the
  // crest. Both are squashed vertically so they read as light coming off
  // the surface rather than as a lens flare behind it.
  const drawGlow = (
    centerX: number,
    radius: number,
    stops: [number, string][],
  ) => {
    ctx.save();
    ctx.translate(centerX, bandY);
    ctx.scale(1, GLOW_FLATTEN);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  };

  drawGlow(width / 2, width * 0.8, [
    [0, cssColor(palette.glow, BAND_GLOW_ALPHA)],
    [1, cssColor(palette.glow, 0)],
  ]);

  const glowX =
    width / 2 + (layout.colFieldX[bestCol] - 0.5) * width * OVERSCAN_X;
  const glowStop =
    tables.hueStops[
      Math.min(
        HUE_STEPS - 1,
        Math.max(0, Math.floor((glowX / width) * HUE_STEPS)),
      )
    ];
  drawGlow(glowX, width * GLOW_RADIUS_FRACTION, [
    [0, cssColor(glowStop, GLOW_ALPHA)],
    [0.45, cssColor(glowStop, GLOW_ALPHA * 0.3)],
    [1, cssColor(glowStop, 0)],
  ]);

  // --- Displace every dot and bucket it by colour --------------------
  ends.fill(0);
  // Rows are walked far -> near so the previous row's heights are still
  // in hand when the next row needs them for the slope term.
  const slopeRef =
    ((layout.depthZ[rows - 1] - layout.depthZ[0]) / Math.max(1, rows - 1)) * 2;
  for (let r = 0; r < rows; r++) {
    const rowAmp = layout.amp[r];
    const rowEnergy = layout.depthEnergy[r];
    const depth = layout.depthZ[r];
    const base = r * cols;
    for (let c = 0; c < cols; c++) {
      const i = base + c;
      const n = sampleHeight(noise, circleX, circleY, c, cols, depth, breath);
      px[i] = layout.x[i];
      py[i] = layout.y0[i] - rowAmp * n;
      let unit = n * NOISE_GAIN + 0.5;
      unit = unit < 0 ? 0 : unit > 1 ? 1 : unit;
      let slope = r === 0 ? 0 : (n - prevRow[c]) / slopeRef;
      slope = slope < -1 ? -1 : slope > 1 ? 1 : slope;
      prevRow[c] = n;
      const energy =
        rowEnergy *
        ENERGY_LUT[(unit * (ENERGY_LUT_SIZE - 1)) | 0] *
        (1 + SLOPE_GAIN * slope);
      // Clamped both ways: the bucket index is written straight into a
      // fixed-size histogram below, so a retuned SLOPE_GAIN must not be
      // able to push it out of range.
      let level = (energy * LEVEL_STEPS) | 0;
      if (level > LEVEL_STEPS - 1) level = LEVEL_STEPS - 1;
      else if (level < 0) level = 0;
      const b = layout.hue[i] * LEVEL_STEPS + level;
      bucket[i] = b;
      ends[b]++;
    }
  }

  // Counting sort into bucket order, so the fill style is set once per
  // bucket rather than once per dot. After this pass ends[b] is the end
  // index of bucket b.
  let running = 0;
  for (let b = 0; b < BUCKETS; b++) {
    running += ends[b];
    ends[b] = running;
  }
  for (let i = count - 1; i >= 0; i--) {
    order[--ends[bucket[i]]] = i;
  }
  // ends[b] is now the *start* of bucket b; bucket b runs to the start
  // of the next non-empty bucket, i.e. to ends[b + 1] (or count).

  // --- Dots ---------------------------------------------------------
  ctx.globalCompositeOperation = "lighter";
  const sprites = haloSprites(palette);
  const sizes = layout.size;

  for (let b = 0; b < BUCKETS; b++) {
    const start = ends[b];
    const end = b + 1 < BUCKETS ? ends[b + 1] : count;
    if (end <= start) continue;

    const level = b % LEVEL_STEPS;
    ctx.globalAlpha = 1;
    ctx.fillStyle = tables.colors[b];
    for (let k = start; k < end; k++) {
      const i = order[k];
      const s = sizes[i];
      ctx.fillRect(px[i] - s * 0.5, py[i] - s * 0.5, s, s);
    }

    const halo = tables.haloAlpha[level];
    if (halo > 0 && sprites) {
      const sprite = sprites[(b / LEVEL_STEPS) | 0];
      ctx.globalAlpha = halo;
      for (let k = start; k < end; k++) {
        const i = order[k];
        const radius = sizes[i] * HALO_SIZE_SCALE;
        ctx.drawImage(
          sprite,
          px[i] - radius,
          py[i] - radius,
          radius * 2,
          radius * 2,
        );
      }
    }

    const hot = tables.hotAlpha[level];
    if (hot > 0) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(255, 255, 255, ${hot})`;
      for (let k = start; k < end; k++) {
        const i = order[k];
        const s = sizes[i] * 0.62;
        ctx.fillRect(px[i] - s * 0.5, py[i] - s * 0.5, s, s);
      }
    }
  }
  ctx.globalAlpha = 1;

  // --- Grain --------------------------------------------------------
  const tile = getGrainTile();
  if (tile) {
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      // Offset derived from the frame number so the grain moves without
      // ever needing Math.random(), and repeats with the loop.
      const rand = mulberry32(frame % durationInFrames);
      const ox = Math.floor(rand() * GRAIN_TILE_SIZE);
      const oy = Math.floor(rand() * GRAIN_TILE_SIZE);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = GRAIN_ALPHA;
      ctx.save();
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width + GRAIN_TILE_SIZE, height + GRAIN_TILE_SIZE);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }
};
