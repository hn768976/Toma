import { REFERENCE_AREA, REFERENCE_HEIGHT } from "./constants";
import { css, parseHex, lighten, darken, mix, luminance, type Rgb } from "./color";
import { createRng, seedFor, type Rng } from "./rng";
import type { Palette } from "./palettes";
import type { PaperTone } from "./types";

const TAU = Math.PI * 2;

export type PaperOptions = {
  width: number;
  height: number;
  palette: Palette;
  tone: PaperTone;
  /** Composition id — the seed for every random value on the sheet. */
  seed: string;
  /** Multiplier on the fibre counts. 1 is the standard washi surface. */
  fibreDensity?: number;
};

/**
 * Fibre counts for the 3840x2560 reference sheet.
 *
 * These are per-sheet totals, scaled by AREA at other sizes. Four thousand
 * strands sounds like a lot until you spread it over ten million pixels: it
 * covers about 3% of the surface and the sheet still reads as flat digital
 * paper. Washi needs the strands to actually meet each other.
 */
const PULP_STRANDS = 34000;
const STRANDS = 13000;
const LONG_FIBRES = 1400;
/** Fraction of the mid-length strands drawn inside a clump. */
const CLUMPED_SHARE = 0.45;
const CLUMPS = 520;

type Surface = {
  paper: Rgb;
  fibre: Rgb;
  pale: Rgb;
  deep: Rgb;
  dark: boolean;
};

/**
 * The washi surface. A flat fill will not do: the sheet is built from broad
 * mottling, a mid-scale cloudiness, tens of thousands of individual fibre
 * strands laid in clumps, a fine grain and a single soft corner light. The
 * strands are what separate washi from cartridge paper, so they are drawn one
 * by one.
 */
export const drawPaper = (
  ctx: CanvasRenderingContext2D,
  o: PaperOptions,
): void => {
  const { width, height, palette } = o;
  const scale = height / REFERENCE_HEIGHT;
  const area = (width * height) / REFERENCE_AREA;
  const density = o.fibreDensity ?? 1;
  const rng = createRng(seedFor(o.seed, "paper"));

  const paper = parseHex(palette.paper);
  const mottle = parseHex(palette.mottle);
  const fibre = parseHex(palette.fibre);
  /**
   * A composition declares its intended tone, but any composition can be
   * rendered in any palette — w08 on indigo, for instance — so the sheet also
   * reads the paper colour itself. Get this wrong and a dark palette gets the
   * light sheet's near-white fibres and corner light, and the indigo washes
   * out to slate.
   */
  const dark = o.tone === "dark" || luminance(paper) < 0.5;

  const surface: Surface = {
    paper,
    fibre,
    // Washi fibre mostly CATCHES the light: the strands that read are pale
    // ones, with only a scattering of slightly deeper shadows. Make the deep
    // tone too dark and the sheet reads as pencil scratches on cartridge.
    pale: dark ? lighten(fibre, 0.3) : lighten(paper, 0.95),
    deep: dark ? darken(fibre, 0.35) : darken(fibre, 0.13),
    dark,
  };

  /* Base tone. */
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, width, height);

  /* MOTTLING — broad soft tonal variation. Overlapping radial falloffs, so
     the transitions are inherently blurred and no edge can show. */
  drawMottling(ctx, width, height, rng, surface, mottle);

  /* CLOUDINESS — the mid-scale unevenness between the broad mottling and the
     per-pixel grain. Coarse noise upscaled with smoothing, so it stays soft.
     This is the band that survives downscaling, and without it the sheet looks
     flat in anything but a 1:1 crop. */
  drawCloudiness(ctx, width, height, o.seed, surface, 0.055, 96);
  drawCloudiness(ctx, width, height, `${o.seed}:fine`, surface, 0.045, 26);

  /* FIBRE TEXTURE — short thin strands at random angles and lengths, each a
     single faint stroke. Individually almost invisible; together they give the
     sheet its handmade quality. */
  drawFibres(ctx, width, height, scale, area, density, rng, surface);

  /* A slight overall gradient — one corner marginally brighter. */
  drawCornerLight(ctx, width, height, rng, surface, mottle);

  /* GRAIN — a very subtle per-pixel noise over everything. */
  applyGrain(ctx, width, height, o.seed, dark ? 7.5 : 6.5);
};

/* ── MOTTLING ───────────────────────────────────────────────────────────── */

const drawMottling = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rng: Rng,
  surface: Surface,
  mottle: Rgb,
) => {
  for (let i = 0; i < 46; i += 1) {
    const cx = rng.range(-0.1, 1.1) * width;
    const cy = rng.range(-0.1, 1.1) * height;
    const r = rng.range(0.22, 0.85) * height;
    const tone = rng.chance(0.62)
      ? mottle
      : surface.dark
        ? lighten(surface.paper, 0.05)
        : lighten(surface.paper, 0.55);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, css(tone, rng.range(0.35, 0.8)));
    grad.addColorStop(0.55, css(tone, rng.range(0.12, 0.3)));
    grad.addColorStop(1, css(tone, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  }
};

/* ── CLOUDINESS ─────────────────────────────────────────────────────────────
   Coarse noise blown up with smoothing. Each noise pixel becomes a soft blob
   `cell` pixels across, lighter or darker than the sheet, so there is tonal
   structure at a scale the eye reads as handmade unevenness.                */

const drawCloudiness = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: string,
  surface: Surface,
  strength: number,
  cell: number,
) => {
  const rng = createRng(seedFor(seed, `cloud-${cell}`));
  const cols = Math.max(2, Math.round(width / cell));
  const rows = Math.max(2, Math.round(height / cell));

  const tile = document.createElement("canvas");
  tile.width = cols;
  tile.height = rows;
  const tileCtx = tile.getContext("2d");
  if (!tileCtx) return;

  const light = surface.dark
    ? lighten(surface.paper, 0.55)
    : lighten(surface.paper, 1);
  const shade = surface.dark
    ? darken(surface.paper, 0.5)
    : darken(surface.fibre, 0.15);

  const image = tileCtx.createImageData(cols, rows);
  const data = image.data;
  for (let i = 0; i < cols * rows; i += 1) {
    const v = rng.next() - 0.5;
    const tone = v > 0 ? light : shade;
    const offset = i * 4;
    data[offset] = tone.r;
    data[offset + 1] = tone.g;
    data[offset + 2] = tone.b;
    data[offset + 3] = Math.abs(v) * 2 * 255;
  }
  tileCtx.putImageData(image, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = strength;
  ctx.drawImage(tile, 0, 0, cols, rows, 0, 0, width, height);
  ctx.restore();
};

/* ── FIBRES ─────────────────────────────────────────────────────────────────
   Three passes, because real washi has three scales of fibre: a dense mat of
   very short pulp, the characteristic mid-length strands, and a scattering of
   long ones. Nearly half the mid-length strands are laid inside clumps — an
   even scatter reads as digital noise, whereas washi fibres bunch.          */

const drawFibres = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  area: number,
  density: number,
  rng: Rng,
  surface: Surface,
) => {
  ctx.lineCap = "round";

  /**
   * Each strand's opacity depends on which tone it is. The pale strands are
   * the ones meant to be seen; the deep ones only hint at shadow between
   * fibres, so they stay much fainter.
   */
  const toneFor = (): { tone: Rgb; alpha: [number, number] } => {
    const roll = rng.next();
    if (roll < 0.55) {
      return {
        tone: surface.pale,
        alpha: surface.dark ? [0.1, 0.32] : [0.3, 0.75],
      };
    }
    if (roll < 0.88) {
      return {
        tone: surface.fibre,
        alpha: surface.dark ? [0.07, 0.22] : [0.16, 0.46],
      };
    }
    return {
      tone: surface.deep,
      alpha: surface.dark ? [0.05, 0.14] : [0.09, 0.24],
    };
  };

  const strand = (
    x: number,
    y: number,
    len: number,
    opacity: number,
    widthRange: [number, number],
    bowFactor: number,
  ) => {
    const angle = rng.next() * TAU;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const bow = rng.bell() * len * bowFactor;

    const { tone, alpha } = toneFor();
    ctx.strokeStyle = css(tone, rng.range(alpha[0], alpha[1]) * opacity);
    ctx.lineWidth = rng.range(widthRange[0], widthRange[1]) * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + cos * len * 0.5 - sin * bow,
      y + sin * len * 0.5 + cos * bow,
      x + cos * len,
      y + sin * len,
    );
    ctx.stroke();
  };

  /* The pulp mat. */
  const pulp = Math.round(PULP_STRANDS * area * density);
  for (let i = 0; i < pulp; i += 1) {
    strand(
      rng.next() * width,
      rng.next() * height,
      rng.range(8, 30) * scale,
      0.7,
      [0.8, 1.6],
      0.1,
    );
  }

  /* Clump centres for the mid-length strands. */
  const clumps = Math.max(1, Math.round(CLUMPS * area));
  const centres: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < clumps; i += 1) {
    centres.push({
      x: rng.next() * width,
      y: rng.next() * height,
      r: rng.range(45, 190) * scale,
    });
  }

  /* The characteristic strands: 15-90px on the reference sheet. */
  const strands = Math.round(STRANDS * area * density);
  for (let i = 0; i < strands; i += 1) {
    let x: number;
    let y: number;
    if (rng.next() < CLUMPED_SHARE) {
      const clump = centres[Math.floor(rng.next() * centres.length)];
      const angle = rng.next() * TAU;
      const dist = Math.sqrt(rng.next()) * clump.r;
      x = clump.x + Math.cos(angle) * dist;
      y = clump.y + Math.sin(angle) * dist;
    } else {
      x = rng.next() * width;
      y = rng.next() * height;
    }
    strand(x, y, rng.range(15, 90) * scale, 1, [1, 2], 0.14);
  }

  /* The long fibres real washi shows on close inspection. */
  const longFibres = Math.round(LONG_FIBRES * area * density);
  for (let i = 0; i < longFibres; i += 1) {
    strand(
      rng.next() * width,
      rng.next() * height,
      rng.range(120, 460) * scale,
      0.5,
      [1, 2.2],
      0.1,
    );
  }
};

/* ── CORNER LIGHT ───────────────────────────────────────────────────────── */

const drawCornerLight = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rng: Rng,
  surface: Surface,
  mottle: Rgb,
) => {
  const corner = Math.floor(rng.next() * 4);
  const cx = corner === 0 || corner === 3 ? 0 : width;
  const cy = corner < 2 ? 0 : height;
  const reach = Math.hypot(width, height);

  const lift = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  const liftTone = surface.dark
    ? lighten(surface.paper, 0.5)
    : lighten(surface.paper, 1);
  lift.addColorStop(0, css(liftTone, surface.dark ? 0.07 : 0.34));
  lift.addColorStop(1, css(liftTone, 0));
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, width, height);

  const shade = ctx.createRadialGradient(
    width - cx,
    height - cy,
    0,
    width - cx,
    height - cy,
    reach * 0.9,
  );
  const shadeTone = mix(surface.paper, darken(mottle, 0.35), 0.7);
  shade.addColorStop(0, css(shadeTone, 0.16));
  shade.addColorStop(1, css(shadeTone, 0));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
};

/* ── GRAIN ──────────────────────────────────────────────────────────────── */

/**
 * A per-pixel noise pass over everything. Seeded from the composition name
 * like the rest of the sheet, so the grain is identical on every render.
 */
const applyGrain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: string,
  amplitude: number,
): void => {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const rng = createRng(seedFor(seed, "grain"));
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng.next() - 0.5) * amplitude * 2;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
};

/**
 * Render the sheet once to an offscreen canvas. Tens of thousands of strands
 * and ten million grain samples are not something to redraw.
 */
export const createPaperCanvas = (o: PaperOptions): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = o.width;
  canvas.height = o.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable for the paper ground");
  drawPaper(ctx, o);
  return canvas;
};
