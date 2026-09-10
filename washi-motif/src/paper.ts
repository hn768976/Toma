import { REFERENCE_HEIGHT } from "./constants";
import { css, parseHex, lighten, darken, mix, luminance } from "./color";
import { createRng, seedFor } from "./rng";
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
  /** Multiplier on the strand count. 1 is the standard washi surface. */
  fibreDensity?: number;
};

/**
 * The washi surface. A flat fill will not do: the sheet is built from broad
 * mottling, several thousand individual fibre strands, a fine grain and a
 * single soft corner light. The strands are what separate washi from
 * cartridge paper, so they are drawn one by one.
 */
export const drawPaper = (
  ctx: CanvasRenderingContext2D,
  o: PaperOptions,
): void => {
  const { width, height, palette } = o;
  const scale = height / REFERENCE_HEIGHT;
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

  /* Base tone. */
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, width, height);

  /* MOTTLING — broad soft tonal variation. Overlapping radial falloffs, so
     the transitions are inherently blurred and no edge can show. */
  const mottleCount = 46;
  for (let i = 0; i < mottleCount; i += 1) {
    const cx = rng.range(-0.1, 1.1) * width;
    const cy = rng.range(-0.1, 1.1) * height;
    const r = rng.range(0.22, 0.85) * height;
    const towardMottle = rng.chance(0.62);
    const tone = towardMottle
      ? mottle
      : dark
        ? lighten(paper, 0.05)
        : lighten(paper, 0.55);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, css(tone, rng.range(0.35, 0.8)));
    grad.addColorStop(0.55, css(tone, rng.range(0.12, 0.3)));
    grad.addColorStop(1, css(tone, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  }

  /* FIBRE TEXTURE — short thin strands at random angles and lengths, each a
     single faint stroke. Individually almost invisible; together they give the
     sheet its handmade quality. */
  const strandCount = Math.round(4000 * (o.fibreDensity ?? 1));
  const paleFibre = dark ? lighten(fibre, 0.22) : lighten(paper, 0.75);
  const deepFibre = dark ? darken(fibre, 0.45) : darken(fibre, 0.16);

  ctx.lineCap = "round";
  for (let i = 0; i < strandCount; i += 1) {
    const x = rng.next() * width;
    const y = rng.next() * height;
    const angle = rng.next() * TAU;
    const len = rng.range(15, 90) * scale;
    const bow = rng.bell() * len * 0.14;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const mx = x + cos * len * 0.5 - sin * bow;
    const my = y + sin * len * 0.5 + cos * bow;

    const roll = rng.next();
    const tone = roll < 0.42 ? paleFibre : roll < 0.86 ? fibre : deepFibre;
    ctx.strokeStyle = css(tone, dark ? rng.range(0.1, 0.34) : rng.range(0.18, 0.62));
    ctx.lineWidth = rng.range(1, 2) * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx, my, x + cos * len, y + sin * len);
    ctx.stroke();
  }

  /* A smaller number of long fibres, as real washi shows. */
  const longCount = Math.round(320 * (o.fibreDensity ?? 1));
  for (let i = 0; i < longCount; i += 1) {
    const x = rng.next() * width;
    const y = rng.next() * height;
    const angle = rng.next() * TAU;
    const len = rng.range(120, 420) * scale;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const bow = rng.bell() * len * 0.1;
    ctx.strokeStyle = css(
      rng.chance(0.5) ? paleFibre : fibre,
      dark ? rng.range(0.05, 0.15) : rng.range(0.08, 0.26),
    );
    ctx.lineWidth = rng.range(1, 2.2) * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + cos * len * 0.5 - sin * bow,
      y + sin * len * 0.5 + cos * bow,
      x + cos * len,
      y + sin * len,
    );
    ctx.stroke();
  }

  /* A slight overall gradient — one corner marginally brighter. */
  const corner = Math.floor(rng.next() * 4);
  const cx = corner === 0 || corner === 3 ? 0 : width;
  const cy = corner < 2 ? 0 : height;
  const lift = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(width, height));
  const liftTone = dark ? lighten(paper, 0.5) : lighten(paper, 1);
  lift.addColorStop(0, css(liftTone, dark ? 0.07 : 0.42));
  lift.addColorStop(1, css(liftTone, 0));
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, width, height);

  const shade = ctx.createRadialGradient(
    width - cx,
    height - cy,
    0,
    width - cx,
    height - cy,
    Math.hypot(width, height) * 0.9,
  );
  const shadeTone = mix(paper, darken(mottle, 0.35), 0.7);
  shade.addColorStop(0, css(shadeTone, 0.16));
  shade.addColorStop(1, css(shadeTone, 0));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  /* GRAIN — a very subtle per-pixel noise over everything. */
  applyGrain(ctx, width, height, o.seed, luminance(paper) < 0.5 ? 7 : 5.6);
};

/**
 * ~2% noise, applied per pixel. Seeded from the composition name like
 * everything else, so the grain is identical on every render.
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
 * Render the sheet once to an offscreen canvas. Four thousand strands and ten
 * million grain samples are not something to redraw.
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
