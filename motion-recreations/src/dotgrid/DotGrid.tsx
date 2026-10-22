import { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mulberry32 } from "../shared/random";

// Grid geometry measured from the reference (62 x 32 nodes, slightly taller
// than wide cells), expressed in 4K pixels.
const COLS = 62;
const ROWS = 32;
const SPACING_X = 62.55;
const SPACING_Y = 67.9;
const OFFSET_X = 20.6;
const OFFSET_Y = 27.6;
const TWINKLE_WAVES = 4;

// Quantiles of the per-dot average intensity measured from the reference.
const MEAN_QUANTILES: [number, number][] = [
  [0, 0],
  [0.1, 0.011],
  [0.3, 0.068],
  [0.5, 0.134],
  [0.7, 0.236],
  [0.9, 0.44],
  [0.99, 0.73],
  [1, 0.85],
];

const sampleQuantile = (u: number) => {
  for (let i = 1; i < MEAN_QUANTILES.length; i++) {
    const [q1, v1] = MEAN_QUANTILES[i];
    const [q0, v0] = MEAN_QUANTILES[i - 1];
    if (u <= q1) {
      return v0 + ((u - q0) / (q1 - q0)) * (v1 - v0);
    }
  }
  return MEAN_QUANTILES[MEAN_QUANTILES.length - 1][1];
};

type Dot = {
  x: number;
  y: number;
  mean: number;
  freqs: number[];
  phases: number[];
};

const buildDots = (seed: number): Dot[] => {
  const rand = mulberry32(seed);
  const dots: Dot[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Soft vertical bands of activity, ~30 columns apart (as in the reference).
      const band = 1.2 + 0.65 * Math.cos((2 * Math.PI * (c - 30)) / 30.5);
      const mean = (sampleQuantile(rand()) * band) / 1.2;
      dots.push({
        x: OFFSET_X + c * SPACING_X,
        y: OFFSET_Y + r * SPACING_Y,
        mean,
        freqs: Array.from({ length: TWINKLE_WAVES }, () => 0.1 + rand() * 1.1),
        phases: Array.from(
          { length: TWINKLE_WAVES },
          () => rand() * Math.PI * 2,
        ),
      });
    }
  }
  return dots;
};

// Smooth twinkle around each dot's mean; decorrelates in ~0.3 s like the reference.
const dotIntensity = (d: Dot, t: number) => {
  let n = 0;
  for (let i = 0; i < TWINKLE_WAVES; i++) {
    n += Math.sin(2 * Math.PI * d.freqs[i] * t + d.phases[i]);
  }
  n /= Math.sqrt(TWINKLE_WAVES / 2);
  return Math.min(1, Math.max(0, d.mean * (1 + 0.55 * n)));
};

export type DotGridPalette = {
  background:
    | string
    | ((ctx: CanvasRenderingContext2D, w: number, h: number) => void);
  // Returns the dot fill for a given horizontal position (0..1) and intensity.
  dotColor: (xNorm: number, v: number) => string;
  // Draw a soft halo behind brighter dots (used on dark palettes).
  glow: boolean;
};

export const DotGrid: React.FC<{ palette: DotGridPalette; seed?: number }> = ({
  palette,
  seed = 7,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dots = useMemo(() => buildDots(seed), [seed]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    const t = frame / fps;
    if (typeof palette.background === "string") {
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, width, height);
    } else {
      palette.background(ctx, width, height);
    }

    for (const d of dots) {
      const v = dotIntensity(d, t);
      if (v <= 0.002) {
        continue;
      }
      const xNorm = d.x / width;
      const size = 9 + 11 * v;
      if (palette.glow && v > 0.25) {
        const radius = size * 1.9;
        const halo = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, radius);
        halo.addColorStop(0, palette.dotColor(xNorm, (v - 0.25) * 0.55));
        halo.addColorStop(1, palette.dotColor(xNorm, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(d.x - radius, d.y - radius, radius * 2, radius * 2);
      }
      ctx.fillStyle = palette.dotColor(xNorm, v);
      ctx.fillRect(d.x - size / 2, d.y - size / 2, size, size);
    }
  }, [frame, fps, width, height, dots, palette]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} width={width} height={height} />
    </AbsoluteFill>
  );
};
