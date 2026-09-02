import { rndRange } from "../random/seeded";

/**
 * One cycle of jagged trace values in [-1, 1].
 *
 * The series is cyclic by construction: index it modulo its length and drawing
 * it twice side by side tiles seamlessly, which is what lets a scrolling
 * waveform close on a loop.
 */
export const makeJaggedSeries = (
  seed: string,
  samples: number,
  spikeChance: number,
  o: { slowCycles?: number; fastCycles?: number; jitter?: number } = {},
): number[] => {
  const { slowCycles = 3, fastCycles = 7, jitter = 0.32 } = o;
  return Array.from({ length: samples }, (_, i) => {
    const base =
      Math.sin((i / samples) * Math.PI * 2 * slowCycles + rndRange(`${seed}-ph`, 0, 6)) * 0.28 +
      Math.sin((i / samples) * Math.PI * 2 * fastCycles) * 0.14;
    const j = rndRange(`${seed}-j-${i}`, -jitter, jitter);
    const spike =
      rndRange(`${seed}-s-${i}`, 0, 1) > 1 - spikeChance
        ? rndRange(`${seed}-sm-${i}`, -0.85, 0.85)
        : 0;
    return Math.max(-1, Math.min(1, base + j + spike));
  });
};

/**
 * Draws a cyclic series as a leftward-scrolling trace, tiled twice so one copy
 * leaves to the left while the next arrives from the right. `offsetFraction`
 * is the scroll position, 0..1, over one full tile width; drive it from
 * (frame % period) / period and the scroll closes on the loop.
 *
 * Both tiles go into ONE path so the seam between them is a normal line join
 * rather than a visible break. Clip to the panel before calling.
 */
export const drawScrollingTrace = (
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    series: number[];
    offsetFraction: number;
    color: string;
    lineWidth: number;
    glow?: number;
    amplitudeFraction?: number;
  },
) => {
  const { x, y, w, h, series, offsetFraction, color, lineWidth, glow = 0 } = o;
  const amp = h * (o.amplitudeFraction ?? 0.42);
  const midY = y + h / 2;
  const step = w / series.length;
  const offset = offsetFraction * w;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  for (let tile = 0; tile < 2; tile++) {
    const x0 = x - offset + tile * w;
    for (let i = 0; i < series.length; i++) {
      const px = x0 + i * step;
      const py = midY - series[i] * amp;
      if (i === 0 && tile === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
};
