import { useMemo } from "react";
import { useCanvasPaint } from "../lib/canvas";
import { rgba } from "../lib/color";
import { closedDrift, randInt, randPick, randRange } from "../lib/random";

export type SparkFieldProps = {
  width: number;
  height: number;
  /** The word's centre; sparks cluster around it. */
  centerX: number;
  centerY: number;
  frame: number;
  period: number;
  hues: readonly string[];
  count?: number;
  seed?: string;
};

type Spark = {
  x: number;
  y: number;
  radius: number;
  hue: string;
  /** Integer twinkle frequency, so every spark closes its cycle on the loop. */
  twinkle: number;
  phase: number;
  driftAmp: number;
  driftFreqX: number;
  driftFreqY: number;
  key: string;
};

/**
 * Small bright points scattered around the word, denser near it, drifting
 * slowly and twinkling.
 *
 * Positions come from a cubed uniform, which concentrates points near the
 * centre while still reaching the corners — an even scatter reads as noise,
 * a clustered one reads as light coming off the letters.
 */
const buildSparks = (
  count: number,
  seed: string,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  hues: readonly string[],
): Spark[] => {
  const sparks: Spark[] = [];
  for (let i = 0; i < count; i++) {
    const key = `${seed}-${i}`;
    const cube = (v: number) => v * v * v;
    sparks.push({
      x: centerX + cube(randRange(`${key}-x`, -1, 1)) * width * 0.62,
      y: centerY + cube(randRange(`${key}-y`, -1, 1)) * height * 0.58,
      radius: randRange(`${key}-r`, 1.2, 4.5),
      hue: randPick(`${key}-h`, hues),
      twinkle: randInt(`${key}-t`, 1, 4),
      phase: randRange(`${key}-p`, 0, Math.PI * 2),
      driftAmp: randRange(`${key}-d`, 8, 34),
      driftFreqX: randInt(`${key}-fx`, 1, 2),
      driftFreqY: randInt(`${key}-fy`, 1, 3),
      key,
    });
  }
  return sparks;
};

export const SparkField: React.FC<SparkFieldProps> = ({
  width,
  height,
  centerX,
  centerY,
  frame,
  period,
  hues,
  count = 180,
  seed = "spark",
}) => {
  const sparks = useMemo(
    () => buildSparks(count, seed, width, height, centerX, centerY, hues),
    [count, seed, width, height, centerX, centerY, hues],
  );

  const ref = useCanvasPaint(
    (ctx) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      const t = (frame / period) * Math.PI * 2;
      for (const spark of sparks) {
        const drift = closedDrift(
          spark.key,
          frame,
          period,
          spark.driftAmp,
          spark.driftFreqX,
          spark.driftFreqY,
        );
        const pulse = 0.5 + 0.5 * Math.sin(t * spark.twinkle + spark.phase);
        const alpha = 0.1 + 0.6 * pulse * pulse;
        const r = spark.radius * (0.75 + 0.5 * pulse);
        const x = spark.x + drift.x;
        const y = spark.y + drift.y;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        grad.addColorStop(0, rgba(spark.hue, alpha));
        grad.addColorStop(0.25, rgba(spark.hue, alpha * 0.45));
        grad.addColorStop(1, rgba(spark.hue, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    [sparks, frame, period, width, height],
  );

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
