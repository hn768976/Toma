import { REFERENCE_AREA, REFERENCE_HEIGHT } from "./constants";
import { css, darken, lighten, mix, parseHex, type Rgb } from "./color";
import { createRng, seedFor, type Rng } from "./rng";
import {
  applyGrain,
  drawCloudiness,
  drawCornerLight,
  drawFibres,
  drawMottling,
  drawPaper,
  makeSurface,
  type Surface,
} from "./paper";
import type { Palette } from "./palettes";
import type { GroundSpec } from "./surfaces";

const TAU = Math.PI * 2;

export type GroundEnv = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  palette: Palette;
  /** Composition or surface id — the seed for everything on the sheet. */
  seed: string;
};

type Pass = {
  env: GroundEnv;
  spec: GroundSpec;
  surface: Surface;
  rng: Rng;
  scale: number;
  area: number;
};

/**
 * The four grounds this project can print on.
 *
 *   washi     the handmade sheet the motif set uses
 *   cloth     a woven board: fabric weave, chalk haze, a strong vignette
 *   metallic  beaten leaf: a directional sheen, creases, a fine sparkle
 *   wash      watercolour: soft pigment blooms that dry darker at their edges
 *
 * All four are built from the same passes as the washi sheet — base tone,
 * mottling, cloudiness, fibre, corner light, grain — so a metallic leaf is
 * still fibrous underneath and a watercolour still sits on paper.
 */
export const drawGround = (env: GroundEnv, spec: GroundSpec): void => {
  const pass: Pass = {
    env,
    spec,
    surface: makeSurface(env.palette, spec.tone),
    rng: createRng(seedFor(env.seed, `ground-${spec.kind}`)),
    scale: env.height / REFERENCE_HEIGHT,
    area: (env.width * env.height) / REFERENCE_AREA,
  };

  switch (spec.kind) {
    case "washi":
      drawPaper(env.ctx, {
        width: env.width,
        height: env.height,
        palette: env.palette,
        tone: spec.tone ?? "light",
        seed: env.seed,
        fibreDensity: spec.fibreDensity,
        mottleStrength: spec.mottle,
        cornerLight: spec.light,
      });
      break;
    case "cloth":
      drawCloth(pass);
      break;
    case "metallic":
      drawMetallicLeaf(pass);
      break;
    case "wash":
      drawWatercolour(pass);
      break;
  }

};

/** Corners pulled down. Called after the motifs, so it darkens them too. */
export const applyVignette = (env: GroundEnv, spec: GroundSpec): void => {
  if (!spec.vignette) return;
  drawVignette({
    env,
    spec,
    surface: makeSurface(env.palette, spec.tone),
    rng: createRng(seedFor(env.seed, "vignette")),
    scale: env.height / REFERENCE_HEIGHT,
    area: (env.width * env.height) / REFERENCE_AREA,
  });
};

/**
 * Render a ground once to an offscreen canvas, as the washi sheet does — a
 * metallic leaf is four thousand creases and a watercolour is three hundred
 * soft blooms, neither of which should be redrawn.
 */
export const createGroundCanvas = (
  o: Omit<GroundEnv, "ctx"> & { spec: GroundSpec },
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = o.width;
  canvas.height = o.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable for the ground");
  drawGround({ ...o, ctx }, o.spec);
  return canvas;
};

/* ── SHARED ─────────────────────────────────────────────────────────────── */

const base = ({ env, surface }: Pass) => {
  env.ctx.fillStyle = css(surface.paper);
  env.ctx.fillRect(0, 0, env.width, env.height);
};

const mottleAndCloud = (pass: Pass, cloud: number) => {
  const { env, surface, rng } = pass;
  drawMottling(
    env.ctx,
    env.width,
    env.height,
    rng,
    surface,
    parseHex(env.palette.mottle),
    pass.spec.mottle ?? 1,
  );
  drawCloudiness(env.ctx, env.width, env.height, env.seed, surface, cloud, 96);
  drawCloudiness(
    env.ctx,
    env.width,
    env.height,
    `${env.seed}:fine`,
    surface,
    cloud * 0.8,
    26,
  );
};

/** Corners pulled down, as on a board or a photographed sheet. */
const drawVignette = ({ env, surface, spec }: Pass) => {
  const strength = spec.vignette ?? 0;
  const grad = env.ctx.createRadialGradient(
    env.width / 2,
    env.height / 2,
    Math.min(env.width, env.height) * 0.22,
    env.width / 2,
    env.height / 2,
    Math.hypot(env.width, env.height) * 0.62,
  );
  const tone = darken(surface.paper, 0.72);
  grad.addColorStop(0, css(tone, 0));
  grad.addColorStop(0.6, css(tone, strength * 0.34));
  grad.addColorStop(1, css(tone, strength));
  env.ctx.fillStyle = grad;
  env.ctx.fillRect(0, 0, env.width, env.height);
};

/* ── CLOTH ──────────────────────────────────────────────────────────────────
   A woven board. The weave is two fine line sets at right angles, far too
   faint to read as lines; what the eye gets is the cloth. Over it go broad
   chalk-dust smudges and a heavy vignette.                                 */

const drawCloth = (pass: Pass) => {
  const { env, surface, rng, scale, spec } = pass;
  const { ctx, width, height } = env;

  base(pass);
  mottleAndCloud(pass, 0.1);

  /* Weave. */
  const spacing = (spec.weave ?? 7) * scale;
  const warp = darken(surface.paper, 0.3);
  const weft = lighten(surface.paper, 0.24);
  ctx.lineWidth = 1.4 * scale;
  for (let pass2 = 0; pass2 < 2; pass2 += 1) {
    ctx.strokeStyle = css(pass2 === 0 ? warp : weft, 0.09);
    ctx.beginPath();
    const offset = pass2 * spacing * 0.5;
    for (let y = offset; y < height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    for (let x = offset; x < width; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();
  }

  /* Chalk dust: broad, soft, slightly elongated smudges. */
  const chalk = lighten(surface.paper, 0.4);
  for (let i = 0; i < 46; i += 1) {
    const cx = rng.next() * width;
    const cy = rng.next() * height;
    const r = rng.range(0.1, 0.42) * height;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rng.range(-0.5, 0.5));
    ctx.scale(1, rng.range(0.3, 0.75));
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, css(chalk, rng.range(0.03, 0.1)));
    grad.addColorStop(1, css(chalk, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  applyGrain(ctx, width, height, env.seed, spec.grain ?? 8);
};

/* ── METALLIC LEAF ──────────────────────────────────────────────────────────
   Beaten gold. A directional sheen across the sheet, fine creases running
   mostly with that direction, and an optional sparkle. The fibre pass stays
   on, because leaf in this set is laid over washi and shows it.            */

const drawMetallicLeaf = (pass: Pass) => {
  const { env, surface, rng, scale, area, spec } = pass;
  const { ctx, width, height } = env;
  const angle = ((spec.angle ?? 35) * Math.PI) / 180;

  base(pass);
  mottleAndCloud(pass, 0.05);

  const bright = parseHex(env.palette.motifs[0]);
  const deep = parseHex(env.palette.motifs[1]);

  /* Sheen: broad soft bands of light and shade along the sweep direction. */
  const sheen = spec.sheen ?? 1;
  const reach = Math.hypot(width, height);
  for (let i = 0; i < 5; i += 1) {
    const t = (i + rng.range(0.1, 0.9)) / 5;
    const cx = width / 2 + Math.cos(angle) * (t - 0.5) * reach;
    const cy = height / 2 + Math.sin(angle) * (t - 0.5) * reach;
    const r = rng.range(0.45, 0.95) * reach * 0.6;
    const tone = i % 2 === 0 ? bright : deep;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, css(tone, rng.range(0.18, 0.42) * sheen));
    grad.addColorStop(1, css(tone, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  }

  /* A single specular hot spot, for the polished variant. */
  if (spec.hotspot) {
    const hx = spec.hotspot.x * width;
    const hy = spec.hotspot.y * height;
    const hr = spec.hotspot.r * height;
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    const white = lighten(bright, 0.7);
    glow.addColorStop(0, css(white, 0.85));
    glow.addColorStop(0.35, css(white, 0.3));
    glow.addColorStop(1, css(white, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, TAU);
    ctx.fill();
  }

  /* Fibre, because the leaf is laid on paper. */
  drawFibres(
    ctx,
    width,
    height,
    scale,
    area,
    spec.fibreDensity ?? 0.7,
    rng,
    surface,
  );

  /* Creases: fine strokes running mostly with the sweep. */
  const creases = Math.round((spec.crease ?? 2200) * area);
  ctx.lineCap = "round";
  for (let i = 0; i < creases; i += 1) {
    const x = rng.next() * width;
    const y = rng.next() * height;
    const a = angle + rng.bell() * 0.5;
    const len = rng.range(40, 520) * scale;
    const lighter = rng.chance(0.55);
    ctx.strokeStyle = css(
      lighter ? lighten(bright, 0.3) : darken(deep, 0.2),
      rng.range(0.04, 0.2),
    );
    ctx.lineWidth = rng.range(0.9, 2.6) * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * len * 0.5 - Math.sin(a) * rng.bell() * len * 0.05,
      y + Math.sin(a) * len * 0.5 + Math.cos(a) * rng.bell() * len * 0.05,
      x + Math.cos(a) * len,
      y + Math.sin(a) * len,
    );
    ctx.stroke();
  }

  /* Sparkle. */
  const sparkle = Math.round((spec.granulation ?? 0) * area);
  if (sparkle > 0) {
    for (let i = 0; i < sparkle; i += 1) {
      ctx.fillStyle = css(
        rng.chance(0.6) ? lighten(bright, 0.55) : darken(deep, 0.3),
        rng.range(0.1, 0.45),
      );
      ctx.beginPath();
      ctx.arc(
        rng.next() * width,
        rng.next() * height,
        rng.range(0.8, 2.4) * scale,
        0,
        TAU,
      );
      ctx.fill();
    }
  }

  applyGrain(ctx, width, height, env.seed, spec.grain ?? 7);
};

/* ── WATERCOLOUR ────────────────────────────────────────────────────────────
   Pigment blooms on wet paper. Each bloom is a cluster of overlapping soft
   discs so its edge stays irregular, laid down with `multiply` so overlaps
   deepen the way pigment does. A few blooms get a faint darker rim, because
   watercolour dries darker at its edge — that rim is what stops a wash from
   reading as an airbrush gradient.                                         */

const drawWatercolour = (pass: Pass) => {
  const { env, surface, rng, scale, area, spec } = pass;
  const { ctx, width, height } = env;

  base(pass);

  const pigments: Rgb[] = env.palette.motifs.map(parseHex);
  const blooms = Math.round((spec.blooms ?? 26) * (spec.bloomScale ?? 1));

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < blooms; i += 1) {
    const cx = rng.range(-0.1, 1.1) * width;
    const cy = rng.range(-0.15, 1.15) * height;
    const spread = rng.range(0.16, 0.52) * height * (spec.bloomScale ?? 1);
    const pigment = pigments[Math.floor(rng.next() * pigments.length)];
    const strength = rng.range(0.05, 0.17) * (spec.pigment ?? 1);
    const lobes = rng.int(7, 14);

    for (let j = 0; j < lobes; j += 1) {
      const a = rng.next() * TAU;
      const d = Math.sqrt(rng.next()) * spread * 0.7;
      const lx = cx + Math.cos(a) * d;
      const ly = cy + Math.sin(a) * d;
      const lr = spread * rng.range(0.3, 0.8);
      const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      grad.addColorStop(0, css(pigment, strength));
      grad.addColorStop(0.62, css(pigment, strength * 0.45));
      grad.addColorStop(1, css(pigment, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, TAU);
      ctx.fill();
    }

    /* The dried edge. */
    if (rng.chance(0.45)) {
      ctx.strokeStyle = css(pigment, rng.range(0.05, 0.13));
      ctx.lineWidth = rng.range(2, 7) * scale;
      ctx.beginPath();
      const steps = 40;
      for (let j = 0; j <= steps; j += 1) {
        const a = (j / steps) * TAU;
        const wobble = 1 + rng.bell() * 0.14;
        const px = cx + Math.cos(a) * spread * 0.72 * wobble;
        const py = cy + Math.sin(a) * spread * 0.72 * wobble;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  /* Granulation: pigment settling into the paper's hollows. */
  const grains = Math.round((spec.granulation ?? 1400) * area);
  for (let i = 0; i < grains; i += 1) {
    const pigment = pigments[Math.floor(rng.next() * pigments.length)];
    ctx.fillStyle = css(darken(pigment, 0.15), rng.range(0.05, 0.22));
    ctx.beginPath();
    ctx.arc(
      rng.next() * width,
      rng.next() * height,
      rng.range(1, 3.4) * scale,
      0,
      TAU,
    );
    ctx.fill();
  }

  /* The paper beneath. */
  drawFibres(
    ctx,
    width,
    height,
    scale,
    area,
    spec.fibreDensity ?? 0.45,
    rng,
    surface,
  );
  drawCornerLight(
    ctx,
    width,
    height,
    rng,
    surface,
    mix(parseHex(env.palette.mottle), surface.paper, 0.4),
  );
  applyGrain(ctx, width, height, env.seed, spec.grain ?? 6);
};
