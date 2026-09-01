import { useLayoutEffect, type RefObject } from "react";
import { CENTRE, CURVE, SPARKS } from "../config";
import { chance, randRange, randSigned, TAU } from "../random";
import { clear2d } from "../scratch";
import { rgba, type PlasmaTheme } from "../theme";

/**
 * The scatter of bright points thrown outward from the core at ignition. They
 * decelerate and persist into the decay phase — still drifting and dimming
 * after the filaments have gone.
 *
 * Each spark is a soft radial point and nothing else. A trailing streak drawn
 * as a stroke reads as a straight scratch across the frame however short or
 * however tapered it is, and a hundred of them radiating from one origin read
 * as rain or a lens flare rather than as ejecta.
 */

type Spark = {
  readonly angle: number;
  readonly speed: number;
  readonly drag: number;
  readonly birth: number;
  readonly life: number;
  readonly radius: number;
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
    speed: randRange(`${seed}-speed`, SPARKS.speedMin, SPARKS.speedMax),
    drag: randRange(`${seed}-drag`, SPARKS.dragMin, SPARKS.dragMax),
    birth: CURVE.blackHoldEnd + randRange(`${seed}-birth`, 0, SPARKS.birthSpread),
    life: randRange(`${seed}-life`, SPARKS.lifeMin, SPARKS.lifeMax),
    radius: randRange(`${seed}-radius`, SPARKS.radiusMin, SPARKS.radiusMax),
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

/** Position at a given age. The heading rotates slowly as the spark travels. */
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

    for (const spark of SPARK_LIST) {
      const age = frame - spark.birth;
      if (age <= 0 || age > spark.life) {
        continue;
      }

      const t = age / spark.life;
      const flicker = 0.75 + 0.25 * Math.sin(spark.flickerPhase + age * 0.9);
      const alpha = (1 - t) ** 1.6 * flicker * gate * SPARKS.brightness;
      if (alpha <= 0.004) {
        continue;
      }

      const head = positionAt(spark, age, cx, cy, scale);
      const colour = spark.white ? theme.coreWhite : theme.sparkPale;
      const radius = spark.radius * scale * (0.45 + 0.55 * (1 - t));

      // A radial falloff rather than a filled disc: a spark should have no
      // edge either, only a bright centre fading into the frame.
      const gradient = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, radius);
      gradient.addColorStop(0, rgba(colour, alpha));
      gradient.addColorStop(0.16, rgba(colour, alpha * 0.62));
      gradient.addColorStop(0.44, rgba(theme.plasmaCyan, alpha * 0.22));
      gradient.addColorStop(0.72, rgba(theme.plasmaMid, alpha * 0.06));
      gradient.addColorStop(1, rgba(theme.plasmaMid, 0));

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(head.x, head.y, radius, 0, TAU);
      ctx.fill();
    }

  }, [canvasRef, frame, width, height, scale, theme, gate]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={{ display: "none" }} />
  );
};
