// Tiny bright points scattered among the bokeh — far smaller than any
// disc. They fill the gaps between the larger elements and keep the frame
// from feeling empty. All twinkle periods divide 240 so the whole layer
// closes with the loop.

import {
  DURATION_IN_FRAMES,
  SPARK_COUNT,
  SPARK_FLASH_FRACTION,
  SPARK_FLASH_FRAMES,
  SPARK_FLASH_GAIN,
  SPARK_PERIODS,
  SPARK_SIZE_RANGE,
} from "./config";
import { createCanvas, TAU } from "./canvas";
import { rand, randInt, randPick, randRange } from "./rand";
import { lighten, rgba, type Theme } from "./theme";

export type SparkTone = "spark" | "cream" | "white";

export type Spark = {
  id: number;
  x: number;
  y: number;
  /** Core diameter, px. */
  size: number;
  tone: SparkTone;
  baseAlpha: number;
  /** Twinkle period in frames; always divides 240. */
  period: number;
  phase: number;
  /** Frame within the loop at which this spark flashes; -1 for never. */
  flashFrame: number;
};

/** `scale` converts the 4K-quoted lengths in config.ts to composition px. */
export const generateSparks = (
  width: number,
  height: number,
  scale: number,
): Spark[] => {
  const sparks: Spark[] = [];
  for (let id = 0; id < SPARK_COUNT; id++) {
    sparks.push({
      id,
      x: randRange(`spark-x-${id}`, -0.02, 1.02) * width,
      y: randRange(`spark-y-${id}`, -0.02, 1.02) * height,
      size:
        randRange(
          `spark-size-${id}`,
          SPARK_SIZE_RANGE[0],
          SPARK_SIZE_RANGE[1],
        ) * scale,
      tone:
        rand(`spark-tone-${id}`) < 0.55
          ? "spark"
          : rand(`spark-tone2-${id}`) < 0.55
            ? "cream"
            : "white",
      baseAlpha: randRange(`spark-alpha-${id}`, 0.4, 1),
      period: randPick(`spark-period-${id}`, SPARK_PERIODS),
      phase: randRange(`spark-phase-${id}`, 0, TAU),
      flashFrame:
        rand(`spark-flashes-${id}`) < SPARK_FLASH_FRACTION
          ? randInt(`spark-flashframe-${id}`, 0, DURATION_IN_FRAMES - 1)
          : -1,
    });
  }
  return sparks;
};

/** Brightness multiplier for a spark at `frame`, including any flash. */
export const sparkBrightness = (spark: Spark, frame: number) => {
  const twinkle =
    0.42 +
    0.58 * (0.5 + 0.5 * Math.sin((TAU * frame) / spark.period + spark.phase));
  if (spark.flashFrame < 0) return twinkle;

  const since =
    (((frame - spark.flashFrame) % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) %
    DURATION_IN_FRAMES;
  if (since >= SPARK_FLASH_FRAMES) return twinkle;

  // Hits hard on the first frame and falls away over the next three.
  const decay = 1 - since / SPARK_FLASH_FRAMES;
  return twinkle * (1 + (SPARK_FLASH_GAIN - 1) * decay);
};

const sparkHex = (theme: Theme, tone: SparkTone) =>
  tone === "spark"
    ? theme.spark
    : tone === "cream"
      ? theme.bokeh.cream
      : theme.bokeh.white;

/**
 * One sprite per tone, drawn large and blitted down. The sprite is a hot
 * white core inside a wide soft halo, which is what gives the sparks their
 * bloom without a per-spark blur.
 */
export const SPARK_SPRITE_RADIUS = 64;
/** Halo reach as a multiple of the spark's core radius. */
export const SPARK_HALO_FACTOR = 5.5;

export const buildSparkSprite = (
  theme: Theme,
  tone: SparkTone,
): HTMLCanvasElement | null => {
  const side = SPARK_SPRITE_RADIUS * 2;
  const canvas = createCanvas(side, side);
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;

  const hex = sparkHex(theme, tone);
  const c = SPARK_SPRITE_RADIUS;
  const core = SPARK_SPRITE_RADIUS / SPARK_HALO_FACTOR;

  const halo = ctx.createRadialGradient(c, c, 0, c, c, SPARK_SPRITE_RADIUS);
  halo.addColorStop(0, lighten(hex, 0.6, 1));
  halo.addColorStop(core / SPARK_SPRITE_RADIUS, rgba(hex, 0.55));
  halo.addColorStop(0.32, rgba(hex, 0.12));
  halo.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, side, side);

  return canvas;
};
