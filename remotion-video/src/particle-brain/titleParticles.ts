/**
 * Sampling the "AI" lettering.
 *
 * The title is drawn from the same technique as the brain rather than set
 * as type: the letterforms are rendered once into an offscreen canvas and
 * the particles are rejection-sampled against those pixels. That is what
 * ties the title to the subject — it is visibly made of the same
 * material. It is deliberately quieter: a coarser lattice, fewer
 * particles and lower brightness, so it reads as secondary.
 *
 * The letters are placed one at a time with explicit tracking rather than
 * drawn as a single string, so spacing does not depend on the font's own
 * kerning tables being available at sample time.
 */
import { distanceField, renderMask, sampleFromMask } from "../lib/maskSampler";
import { titleFont } from "./fonts";
import { buildParticleField, type FieldParticle } from "../lib/particleField";
import {
  HEIGHT,
  ORBIT_MAX_RADIUS,
  ORBIT_MIN_RADIUS,
  ORBIT_PERIODS,
  TITLE_CAP_HEIGHT,
  TITLE_GRID,
  TITLE_PARTICLE_COUNT,
  TITLE_PARTICLE_MAX_SIZE,
  TITLE_PARTICLE_MIN_SIZE,
  TITLE_TEXT,
  TITLE_TRACKING,
  TWINKLE_MAX_AMP,
  TWINKLE_MIN_AMP,
  TWINKLE_PERIODS,
} from "./config";

const PAD = 26;
const TRIAL_SIZE = 400;

type Placed = { char: string; x: number; advance: number };

/**
 * Measures each glyph at a trial size, then derives the font size that
 * puts the capitals at exactly TITLE_CAP_HEIGHT. `actualBoundingBoxAscent`
 * for an all-caps string is the cap height, so no font metrics table is
 * needed.
 */
const layout = (): {
  fontSize: number;
  placed: Placed[];
  width: number;
  ascent: number;
} | null => {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  probe.font = titleFont(TRIAL_SIZE);
  const metrics = probe.measureText(TITLE_TEXT);
  const ascent = metrics.actualBoundingBoxAscent;
  if (!ascent || ascent <= 0) return null;

  const scale = TITLE_CAP_HEIGHT / ascent;
  const fontSize = TRIAL_SIZE * scale;
  const tracking = TITLE_CAP_HEIGHT * TITLE_TRACKING;

  probe.font = titleFont(fontSize);
  const placed: Placed[] = [];
  let x = 0;
  for (let i = 0; i < TITLE_TEXT.length; i++) {
    const char = TITLE_TEXT[i];
    const advance = probe.measureText(char).width;
    placed.push({ char, x, advance });
    x += advance + (i < TITLE_TEXT.length - 1 ? tracking : 0);
  }
  return { fontSize, placed, width: x, ascent: TITLE_CAP_HEIGHT };
};

export type TitleField = { particles: FieldParticle[]; centerX: number; centerY: number };

export const buildTitleField = (
  centerX: number,
  centerYFraction: number,
  seed: string,
): TitleField => {
  const centerY = centerYFraction * HEIGHT;
  const laid = layout();
  if (!laid) return { particles: [], centerX, centerY };

  const width = Math.ceil(laid.width) + PAD * 2;
  const height = Math.ceil(laid.ascent) + PAD * 2;

  const mask = renderMask(width, height, (ctx) => {
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.font = titleFont(laid.fontSize);
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < laid.placed.length; i++) {
      const p = laid.placed[i];
      ctx.fillText(p.char, PAD + p.x, PAD + laid.ascent);
    }
  });

  const dist = distanceField(mask, true);
  const points = sampleFromMask({
    mask,
    count: TITLE_PARTICLE_COUNT,
    grid: TITLE_GRID,
    seed: seed + ":title",
    // A mild edge lift keeps the letterforms crisp without the interiors
    // going hollow.
    weightAt: (_x, _y, i) => Math.min(1, 0.62 + 0.38 * Math.exp(-dist[i] / 14)),
    maxAttempts: TITLE_PARTICLE_COUNT * 90,
  });

  const particles = buildParticleField(points, {
    seed: seed + ":title",
    originX: centerX - width / 2,
    originY: centerY - height / 2,
    sizeMin: TITLE_PARTICLE_MIN_SIZE,
    sizeMax: TITLE_PARTICLE_MAX_SIZE,
    brightScale: 0.82,
    twinklePeriods: TWINKLE_PERIODS,
    twinkleMinAmp: TWINKLE_MIN_AMP,
    twinkleMaxAmp: TWINKLE_MAX_AMP,
    orbitPeriods: ORBIT_PERIODS,
    orbitMinRadius: ORBIT_MIN_RADIUS * 0.6,
    orbitMaxRadius: ORBIT_MAX_RADIUS * 0.55,
  });

  return { particles, centerX, centerY };
};
