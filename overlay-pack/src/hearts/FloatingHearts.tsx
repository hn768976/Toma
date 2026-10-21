import { useCallback } from "react";
import { CanvasStage, DrawInfo } from "../lib/CanvasStage";
import { hash, mulberry32, range } from "../lib/random";
import { GREEN, HEARTS } from "../config";

const LOOP = 600;
// Each regular heart slot repeats on one of these periods (all divide 600).
const PERIODS = [100, 120, 150, 200];
const OCCUPANCY = 0.85; // average fraction of its period a slot is on screen
const BURSTS = [
  { frame: 40, x: 0.38 },
  { frame: 205, x: 0.62 },
  { frame: 360, x: 0.45 },
  { frame: 515, x: 0.56 },
];

type Slot = { period: number; phase: number; life: number; seed: number };
type BurstHeart = { start: number; seed: number; x: number; life: number };

const rng = mulberry32(1077988112);
const BURST_COUNTS = BURSTS.map(() => 5 + Math.floor(rng() * 4));
const burstOnScreen = BURST_COUNTS.reduce((a, n) => a + n, 0) * (120 / LOOP);
const slotCount = Math.max(
  1,
  Math.round((HEARTS.density - burstOnScreen) / OCCUPANCY),
);
const SLOTS: Slot[] = Array.from({ length: slotCount }, (_, i) => {
  const period = PERIODS[Math.floor(rng() * PERIODS.length)];
  return {
    period,
    phase: Math.floor(rng() * LOOP),
    life: Math.round(period * range(rng, 0.72, 0.98)),
    seed: hash(i, 77),
  };
});
const BURST_HEARTS: BurstHeart[] = BURSTS.flatMap((b, bi) =>
  Array.from({ length: BURST_COUNTS[bi] }, (_, j) => ({
    start: b.frame + Math.floor(rng() * 7),
    seed: hash(bi, j, 991),
    x: b.x + range(rng, -0.035, 0.035),
    life: Math.round(range(rng, 100, 140)),
  })),
);

const lighten = (hex: string, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(v + (255 - v) * t),
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// Unit heart: 1 tall, ~1.1 wide, centred on the origin.
const heartPath = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.bezierCurveTo(-0.12, 0.36, -0.56, 0.1, -0.56, -0.17);
  ctx.bezierCurveTo(-0.56, -0.39, -0.4, -0.5, -0.27, -0.5);
  ctx.bezierCurveTo(-0.13, -0.5, -0.04, -0.42, 0, -0.29);
  ctx.bezierCurveTo(0.04, -0.42, 0.13, -0.5, 0.27, -0.5);
  ctx.bezierCurveTo(0.4, -0.5, 0.56, -0.39, 0.56, -0.17);
  ctx.bezierCurveTo(0.56, 0.1, 0.12, 0.36, 0, 0.5);
  ctx.closePath();
};

const popScale = (age: number) => {
  // 0 -> 1.15 over 3.5 frames, then settle to 1 by frame 6.
  if (age >= 6) return 1;
  if (age <= 3.5) {
    const u = age / 3.5;
    return 1.15 * (1 - (1 - u) * (1 - u));
  }
  const u = (age - 3.5) / 2.5;
  return 1.15 - 0.15 * (u * u * (3 - 2 * u));
};

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

const drawHeart = (
  ctx: CanvasRenderingContext2D,
  info: DrawInfo,
  seed: number,
  age: number,
  life: number,
  xFrac: number,
  keyGreen: boolean,
) => {
  const { width: W, height: H, pxRatio } = info;
  const r = mulberry32(seed);
  const color = HEARTS.colors[Math.floor(r() * HEARTS.colors.length)];
  // Smaller hearts are more common.
  const size = H * (HEARTS.sizeMin + (HEARTS.sizeMax - HEARTS.sizeMin) * Math.pow(r(), 0.7));
  const y0 = H * range(r, 0.93, 1.0);
  const y1 = H * range(r, 0.12, 0.42);
  const swayAmp = W * range(r, 0.008, 0.026);
  const swayPeriod = range(r, 45, 85);
  const swayPhase = range(r, 0, Math.PI * 2);
  const tilt = range(r, -0.12, 0.12);
  const rotAmp = range(r, 0.08, 0.22);

  const u = age / life;
  const rise = 1 - Math.pow(1 - u, 1.35);
  const sway = Math.sin((2 * Math.PI * age) / swayPeriod + swayPhase);
  const x = xFrac * W + swayAmp * (sway - Math.sin(swayPhase));
  const y = y0 + (y1 - y0) * rise;
  const out = smooth(0.6, 1, u);
  // On black, fade out (alpha over black = darkening, which Screen mode reads
  // as transparency). On green, shrink out instead: a translucent heart would
  // be a pink/green mix that a chroma key tints or punches holes in.
  const alpha = keyGreen ? 1 : 1 - out;
  const s = size * popScale(age) * (keyGreen ? 1 - out : 1);
  if (alpha <= 0 || s <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt + rotAmp * Math.cos((2 * Math.PI * age) / swayPeriod + swayPhase) * 0.6);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  heartPath(ctx);
  // Tight glow: a few pixels at most so it never tints the key colour.
  ctx.shadowColor = color;
  ctx.shadowBlur = (keyGreen ? 0.12 : 0.22) * s * pxRatio;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.clip();
  const g = ctx.createRadialGradient(-0.24, -0.24, 0, -0.24, -0.24, 0.42);
  g.addColorStop(0, lighten(color, 0.5));
  g.addColorStop(0.45, lighten(color, 0.3));
  g.addColorStop(1, color);
  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = g;
  ctx.fillRect(-0.6, -0.6, 1.2, 1.2);
  ctx.restore();
};

export const FloatingHearts: React.FC<{ background: string; extraFrames?: number }> = ({ background }) => {
  const keyGreen = background.toUpperCase() === GREEN;
  const draw = useCallback((ctx: CanvasRenderingContext2D, info: DrawInfo) => {
    const f = ((info.frame % LOOP) + LOOP) % LOOP;
    SLOTS.forEach((slot) => {
      const g = (f - slot.phase + LOOP) % LOOP;
      const k = Math.floor(g / slot.period);
      const age = g - k * slot.period;
      if (age >= slot.life) return;
      const seed = hash(slot.seed, k);
      const xr = mulberry32(hash(seed, 5));
      drawHeart(ctx, info, seed, age, slot.life, range(xr, 0.12, 0.88), keyGreen);
    });
    for (const b of BURST_HEARTS) {
      const age = (f - b.start + LOOP) % LOOP;
      if (age >= b.life) continue;
      drawHeart(ctx, info, b.seed, age, b.life, b.x, keyGreen);
    }
  }, [keyGreen]);
  return <CanvasStage background={background} draw={draw} />;
};
