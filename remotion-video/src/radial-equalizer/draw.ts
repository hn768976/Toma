/**
 * Frame painter. Everything is 2D polar: elements are placed by
 * (radius, angle) and expand outward. Radial expansion projects the same way
 * whether you build it in 3D or in polar 2D, and 2D keeps the capsule edges
 * crisp and the render fast.
 *
 * Compositing is additive throughout the element passes, so draw order inside
 * them does not matter; records are sorted by colour bucket purely to keep the
 * blits coherent.
 */

import {
  BEAT_EXPANSION,
  CORE_DOTS,
  CORE_RADIUS,
  GRAIN_STRENGTH,
  GRAIN_TILE_SIZE,
  NUM_BANDS,
  ROTATION_TURNS,
  SPIKE_INNER,
  SPIKE_MAX_LEN,
  SPIKE_MIN_LEN,
  TAU,
} from "./constants";
import { getGrainTile } from "./grain";
import { bucketIndex, Palette, sectorField } from "./palette";
import { clamp01, mulberry32 } from "./random";
import { buildRecords } from "./records";
import { bandAngle, beatEnvelope, spectrumAt } from "./spectrum";
import { getSprites, SpriteSet } from "./sprites";

export type DrawOptions = {
  frame: number;
  width: number;
  height: number;
  duration: number;
  palette: Palette;
};

/** The core's fine dust. Positions are fixed; only brightness shimmers. */
const CORE = (() => {
  const rnd = mulberry32(0xc0f2e1);
  const out: {
    r: number;
    theta: number;
    size: number;
    band: number;
    cycles: number;
    phase: number;
  }[] = [];
  for (let i = 0; i < CORE_DOTS; i++) {
    out.push({
      // sqrt-ish distribution fills the disc evenly, weighted a little denser
      // toward the middle so it reads as a solid core.
      r: Math.pow(rnd(), 0.62),
      theta: rnd() * TAU,
      size: 0.0007 + rnd() * 0.0011,
      band: Math.floor(rnd() * NUM_BANDS),
      cycles: 3 + Math.floor(rnd() * 12),
      phase: rnd(),
    });
  }
  return out;
})();

const drawSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  angle: number,
  w: number,
  h: number,
) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.setTransform(cos, sin, -sin, cos, x, y);
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
};

const spriteFor = (s: SpriteSet, shape: number, soft: number, bucket: number) =>
  shape === 0
    ? s.dot[soft][bucket]
    : shape === 1
      ? s.capsule[soft][bucket]
      : s.outline[soft][bucket];

const haze = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
};

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  { frame, width: W, height: H, duration, palette }: DrawOptions,
) => {
  const sprites = getSprites(palette);
  const spec = spectrumAt(frame, duration);
  const beat = beatEnvelope(frame);
  const pulse = 1 + BEAT_EXPANSION * beat;
  const t = frame / duration;
  const rot = TAU * ROTATION_TURNS * t;

  const cx = W / 2;
  const cy = H / 2;
  const halfDiag = Math.hypot(W, H) / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // --- background -----------------------------------------------------
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, halfDiag);
  bg.addColorStop(0, palette.bgInner);
  bg.addColorStop(1, palette.bgOuter);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // --- soft hazes, warm above and cool below --------------------------
  ctx.globalCompositeOperation = "lighter";
  haze(ctx, cx, -0.06 * H, 0.62 * H, palette.hazeTop, 0.17 + 0.05 * beat);
  haze(ctx, cx, 1.05 * H, 0.72 * H, palette.hazeBottom, 0.19 + 0.05 * beat);

  // --- travelling field ------------------------------------------------
  const recs = buildRecords({ frame, width: W, height: H, duration });
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (rec.glow > 0) {
      ctx.globalAlpha = rec.glow;
      const g = rec.w * 1.5;
      drawSprite(ctx, sprites.glow[rec.bucket], rec.x, rec.y, rec.angle, g, g);
    }
    ctx.globalAlpha = rec.alpha;
    drawSprite(
      ctx,
      spriteFor(sprites, rec.shape, rec.soft, rec.bucket),
      rec.x,
      rec.y,
      rec.angle,
      rec.w,
      rec.h,
    );
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // --- spike ring: the equalizer proper --------------------------------
  const spikeInner = SPIKE_INNER * H * pulse;
  const spikeThick = H * 0.0021;
  for (let i = 0; i < NUM_BANDS; i++) {
    const v = spec[i];
    const theta = bandAngle(i);
    const angle = theta + rot;
    const len = H * (SPIKE_MIN_LEN + (SPIKE_MAX_LEN - SPIKE_MIN_LEN) * v) * pulse;
    const mid = spikeInner + len / 2;
    const intensity = clamp01(0.2 + 0.66 * v);
    const family = sectorField(theta) > 0.5 ? 0 : 1;
    const bucket = bucketIndex(family, intensity);
    ctx.globalAlpha = 0.18 + 0.72 * intensity;
    drawSprite(
      ctx,
      sprites.capsule[0][bucket],
      cx + Math.cos(angle) * mid,
      cy + Math.sin(angle) * mid,
      angle,
      len,
      spikeThick,
    );
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // --- core cluster ----------------------------------------------------
  const coreR = CORE_RADIUS * H * pulse;
  const coreBucket = bucketIndex(1, 0.9);
  ctx.globalAlpha = 0.1 + 0.07 * beat;
  ctx.drawImage(
    sprites.glow[coreBucket],
    cx - coreR * 4,
    cy - coreR * 4,
    coreR * 8,
    coreR * 8,
  );
  for (let i = 0; i < CORE.length; i++) {
    const d = CORE[i];
    const v = spec[d.band];
    const shimmer = 0.5 + 0.5 * Math.sin(TAU * (d.cycles * t + d.phase));
    const intensity = clamp01((0.2 + 0.7 * v) * (0.3 + 0.8 * shimmer));
    const angle = d.theta + rot;
    const r = d.r * coreR;
    const size = d.size * H;
    ctx.globalAlpha = 0.18 + 0.72 * intensity;
    const sprite = sprites.dot[0][bucketIndex(1, 0.45 + 0.5 * intensity)];
    ctx.drawImage(
      sprite,
      cx + Math.cos(angle) * r - size,
      cy + Math.sin(angle) * r - size,
      size * 2,
      size * 2,
    );
  }

  // --- vignette --------------------------------------------------------
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(cx, cy, halfDiag * 0.32, cx, cy, halfDiag);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.7, "rgba(0,0,0,0.26)");
  vig.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // --- grain (last, so it dithers the vignette falloff too) ------------
  const tile = getGrainTile(frame);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = GRAIN_STRENGTH;
  for (let y = 0; y < H; y += GRAIN_TILE_SIZE) {
    for (let x = 0; x < W; x += GRAIN_TILE_SIZE) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
};
