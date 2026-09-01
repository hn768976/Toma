import { useLayoutEffect, type RefObject } from "react";
import { CENTRE, CURVE, SPARKS } from "../config";
import { chance, randRange, randSigned, TAU } from "../random";
import { clear2d } from "../scratch";
import { rgba, type PlasmaTheme } from "../theme";

/**
 * The scatter of bright points thrown outward from the core at ignition. They
 * decelerate, trail, and persist into the decay phase — still drifting and
 * dimming after the filaments have gone.
 */

type Spark = {
  readonly angle: number;
  readonly speed: number;
  readonly drag: number;
  readonly birth: number;
  readonly life: number;
  readonly width: number;
  readonly white: boolean;
  readonly driftAngle: number;
  readonly drift: number;
  readonly curl: number;
  readonly flickerPhase: number;
};

const SPARK_LIST: readonly Spark[] = Array.from({ length: SPARKS.count }, (_, i) => {
  const seed = `spark-${i}`;
  return {
    angle: randRange(`${seed}-angle`, 0, TAU),
    // Biased towards the slower end so the field has a dense core and outliers.
    speed: randRange(`${seed}-speed`, SPARKS.speedMin, SPARKS.speedMax) ** 1,
    drag: randRange(`${seed}-drag`, SPARKS.dragMin, SPARKS.dragMax),
    birth: CURVE.blackHoldEnd + randRange(`${seed}-birth`, 0, SPARKS.birthSpread),
    life: randRange(`${seed}-life`, SPARKS.lifeMin, SPARKS.lifeMax),
    width: randRange(`${seed}-width`, SPARKS.widthMin, SPARKS.widthMax),
    white: chance(`${seed}-white`, SPARKS.whiteFraction),
    driftAngle: randRange(`${seed}-drift-a`, 0, TAU),
    drift: randRange(`${seed}-drift`, 0, SPARKS.driftSpeed),
    curl: randSigned(`${seed}-curl`, SPARKS.curl),
    flickerPhase: randRange(`${seed}-flicker`, 0, TAU),
  };
});

/** Distance travelled after `age` frames under exponential deceleration. */
const travelled = (spark: Spark, age: number): number =>
  age <= 0 ? 0 : (spark.speed * (1 - Math.exp(-spark.drag * age))) / spark.drag;

/**
 * Position at a given age. The heading rotates slowly with age, so a spark
 * curves away from the core instead of running dead straight down a radius —
 * without that they line up into something closer to a lens flare than a
 * scatter of ejecta.
 */
const positionAt = (spark: Spark, age: number, cx: number, cy: number, scale: number) => {
  const angle = spark.angle + spark.curl * age;
  const distance = travelled(spark, age) * scale;
  return {
    x: cx + Math.cos(angle) * distance + Math.cos(spark.driftAngle) * spark.drift * age * scale,
    y: cy + Math.sin(angle) * distance + Math.sin(spark.driftAngle) * spark.drift * age * scale,
  };
};

export const SparkLayer: React.FC<{
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly frame: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly theme: PlasmaTheme;
  readonly gate: number;
}> = ({ canvasRef, frame, width, height, scale, theme, gate }) => {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = clear2d(canvas);
    if (gate <= 0) {
      return;
    }

    const cx = width * CENTRE.x;
    const cy = height * CENTRE.y;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    for (const spark of SPARK_LIST) {
      const age = frame - spark.birth;
      if (age <= 0 || age > spark.life) {
        continue;
      }

      const head = positionAt(spark, age, cx, cy, scale);
      const tail = positionAt(spark, Math.max(0, age - SPARKS.trailFrames), cx, cy, scale);

      const t = age / spark.life;
      const flicker = 0.75 + 0.25 * Math.sin(spark.flickerPhase + age * 0.9);
      const alpha = (1 - t) ** 1.6 * flicker * gate;
      if (alpha <= 0.004) {
        continue;
      }

      const colour = spark.white ? theme.coreWhite : theme.sparkPale;
      const lineWidth = spark.width * scale * (0.45 + 0.55 * (1 - t));

      // Streak.
      // Tapered: transparent at the tail, full at the head. An even-alpha line
      // reads as a scratch on the frame; a tapered one reads as a moving spark.
      const streak = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      streak.addColorStop(0, rgba(colour, 0));
      streak.addColorStop(1, rgba(colour, alpha * 0.75));
      ctx.strokeStyle = streak;
      ctx.lineWidth = lineWidth * 0.8;
      ctx.shadowBlur = 9 * scale;
      ctx.shadowColor = rgba(theme.plasmaCyan, alpha);
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();

      // Bright head.
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(colour, alpha);
      ctx.beginPath();
      ctx.arc(head.x, head.y, lineWidth * 0.7, 0, TAU);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }, [canvasRef, frame, width, height, scale, theme, gate]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={{ display: "none" }} />
  );
};
