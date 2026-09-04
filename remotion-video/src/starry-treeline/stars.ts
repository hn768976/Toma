// Star generation and drawing.
//
// Stars are split into two sets: the static majority, which is drawn once into
// the pre-rendered sky canvas, and the ~6% that twinkle, which are the only
// thing redrawn per frame. Redrawing all 4200 every frame would be pure waste.
import { mulberry32 } from "../particle-ring/random";
import {
  BRIGHT_STAR_COUNT,
  DIFFRACTION_STAR_COUNT,
  STAR_FIELD_BOTTOM,
  TWINKLE_FRACTION,
  TWINKLE_PERIODS,
} from "./constants";
import { bandWeight, type BandGeometry } from "./sky";

export type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
  /** Set on the handful of very bright stars that get a diffraction cross. */
  cross: number;
  /** Frames per twinkle cycle; 0 for the static majority. */
  twinklePeriod: number;
  twinklePhase: number;
  twinkleDepth: number;
};

// Mostly white, with a scattering of pale blue and warm amber.
const STAR_COLORS = [
  { color: "#ffffff", weight: 0.72 },
  { color: "#cddcff", weight: 0.14 },
  { color: "#a9c4f5", weight: 0.06 },
  { color: "#ffd9a8", weight: 0.06 },
  { color: "#ffb87a", weight: 0.02 },
];

const pickColor = (r: number) => {
  let acc = 0;
  for (const entry of STAR_COLORS) {
    acc += entry.weight;
    if (r <= acc) return entry.color;
  }
  return "#ffffff";
};

export const generateStars = (
  width: number,
  height: number,
  band: BandGeometry,
  count: number,
  seed: number,
): Star[] => {
  const rand = mulberry32(seed);
  const stars: Star[] = [];
  const fieldBottom = height * STAR_FIELD_BOTTOM;
  // Guard against a pathological rejection loop if the weighting ever changes.
  let attempts = 0;
  const maxAttempts = count * 40;

  while (stars.length < count && attempts < maxAttempts) {
    attempts++;
    const x = rand() * width;
    const y = rand() * fieldBottom;
    // Density is noticeably higher along the Milky Way, so reject a share of
    // the candidates that land away from the band.
    if (rand() > 0.42 + 0.58 * bandWeight(band, x, y)) continue;

    // Brightness is heavily weighted toward faint.
    const faint = Math.pow(rand(), 2.1);
    const alpha = 0.18 + faint * 0.68;
    const sizeRoll = rand();
    // 2-3.6px across at 4K. Anything thinner than this survives the 4K -> 1080p
    // downscale as barely a smudge, and the reference sky is dense.
    const radius = sizeRoll > 0.975 ? 1.8 : sizeRoll > 0.86 ? 1.35 : 1.0;

    stars.push({
      x,
      y,
      radius: radius * (height / 2160),
      alpha,
      color: pickColor(rand()),
      cross: 0,
      twinklePeriod: 0,
      twinklePhase: 0,
      twinkleDepth: 0,
    });
  }

  // A small number of bright stars carry the frame. Promote the ones highest
  // in the sky-density sense (just take a seeded sample) rather than adding
  // new ones, so the layout stays as generated.
  for (let i = 0; i < BRIGHT_STAR_COUNT && i < stars.length; i++) {
    const star = stars[Math.floor(rand() * stars.length)];
    star.alpha = 0.86 + rand() * 0.14;
    star.radius = (1.5 + rand() * 0.7) * (height / 2160);
    if (i < DIFFRACTION_STAR_COUNT) {
      star.cross = star.radius * (7 + rand() * 4);
    }
  }

  // Twinkle assignment. Subtle: stars should shimmer, not blink.
  const twinklers = Math.round(stars.length * TWINKLE_FRACTION);
  for (let i = 0; i < twinklers; i++) {
    const star = stars[Math.floor(rand() * stars.length)];
    star.twinklePeriod =
      TWINKLE_PERIODS[Math.floor(rand() * TWINKLE_PERIODS.length)];
    star.twinklePhase = rand();
    star.twinkleDepth = 0.22 + rand() * 0.28;
  }

  return stars;
};

export const twinkleMultiplier = (star: Star, frame: number) => {
  if (!star.twinklePeriod) return 1;
  const phase = (frame / star.twinklePeriod + star.twinklePhase) * Math.PI * 2;
  return 1 - star.twinkleDepth * (0.5 - 0.5 * Math.cos(phase));
};

export const drawStar = (
  ctx: CanvasRenderingContext2D,
  star: Star,
  brightness: number,
) => {
  const alpha = star.alpha * brightness;
  if (alpha <= 0.004) return;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = star.color;
  ctx.beginPath();
  ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
  ctx.fill();

  // A 1px soft halo on the brightest few only — heavier bloom makes a
  // starfield look like glitter.
  if (star.alpha > 0.8) {
    const halo = ctx.createRadialGradient(
      star.x,
      star.y,
      star.radius * 0.5,
      star.x,
      star.y,
      star.radius * 3.2,
    );
    halo.addColorStop(0, star.color);
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (star.cross > 0) {
    const arm = star.cross * brightness;
    ctx.globalAlpha = alpha * 0.42;
    ctx.strokeStyle = star.color;
    ctx.lineWidth = Math.max(0.6, star.radius * 0.5);
    ctx.beginPath();
    ctx.moveTo(star.x - arm, star.y);
    ctx.lineTo(star.x + arm, star.y);
    ctx.moveTo(star.x, star.y - arm);
    ctx.lineTo(star.x, star.y + arm);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
};
