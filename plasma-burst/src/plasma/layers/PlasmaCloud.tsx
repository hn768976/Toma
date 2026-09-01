import { useLayoutEffect, type RefObject } from "react";
import { CENTRE, CLOUD, TIMING } from "../config";
import { chance, clamp, randRange, TAU } from "../random";
import { clear2d, getScratch } from "../scratch";
import { rgba, type PlasmaTheme } from "../theme";

/**
 * The soft volumetric cloud the filaments sit inside. Without it they read as
 * wire on black.
 *
 * Many overlapping radial blobs composited with 'lighter' at very low alpha,
 * then heavily blurred so no blob edge is discernible. Computed at 1/8
 * resolution and upscaled with imageSmoothingQuality 'high' — it is all soft
 * gradient, so nothing is lost and it costs roughly a quarter as much.
 */

type Blob = {
  readonly angle: number;
  readonly radius: number;
  readonly size: number;
  readonly alpha: number;
  readonly knot: boolean;
  readonly bright: boolean;
  readonly driftAngle: number;
  readonly driftSpeed: number;
  /** Orientation and aspect of the blob's ellipse. */
  readonly tilt: number;
  readonly aspect: number;
  readonly pulsePhase: number;
  readonly pulseRate: number;
};

const BLOBS: readonly Blob[] = Array.from({ length: CLOUD.blobCount }, (_, i) => {
  const seed = `cloud-${i}`;
  // Cluster bias > 1 pulls blobs towards the centre, so the cloud thins outward.
  // A shell rather than a pile: blobs surround the discharge instead of
  // stacking on it, which is what leaves voids for the filaments to show through.
  const u =
    CLOUD.innerHole + (1 - CLOUD.innerHole) * randRange(`${seed}-u`, 0, 1) ** CLOUD.clusterBias;

  return {
    angle: randRange(`${seed}-angle`, 0, TAU),
    radius: u,
    size: randRange(`${seed}-size`, CLOUD.radiusMin, CLOUD.radiusMax),
    alpha: randRange(`${seed}-alpha`, 0.45, 1),
    knot: chance(`${seed}-knot`, CLOUD.knotFraction),
    bright: chance(`${seed}-bright`, 0.4),
    driftAngle: randRange(`${seed}-drift-a`, 0, TAU),
    driftSpeed: randRange(`${seed}-drift-s`, 0.1, 0.5),
    pulsePhase: randRange(`${seed}-pulse-p`, 0, TAU),
    pulseRate: randRange(`${seed}-pulse-r`, 0.06, 0.2),
    tilt: randRange(`${seed}-tilt`, 0, TAU),
    aspect: randRange(`${seed}-aspect`, CLOUD.eccentricity, 1),
  };
});

export const PlasmaCloud: React.FC<{
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly frame: number;
  readonly width: number;
  readonly height: number;
  readonly theme: PlasmaTheme;
  readonly energy: number;
  readonly ignition: number;
}> = ({ canvasRef, frame, width, height, theme, energy, ignition }) => {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = clear2d(canvas);
    if (energy <= 0) {
      return;
    }

    const divisor = CLOUD.resolutionDivisor;
    const w = Math.max(1, Math.round(width / divisor));
    const h = Math.max(1, Math.round(height / divisor));
    const lo = clear2d(getScratch("cloud-lo", w, h));

    const cx = w * CENTRE.x;
    const cy = h * CENTRE.y;
    const unit = Math.min(w, h);
    const life = frame / TIMING.durationInFrames;

    // The cloud punches outward at ignition, then keeps creeping slowly.
    const expansion =
      0.6 + CLOUD.ignitionExpansion * ignition + CLOUD.driftExpansion * life;
    const swirl = CLOUD.swirl * life;

    lo.globalCompositeOperation = "lighter";

    for (const blob of BLOBS) {
      const angle = blob.angle + swirl + blob.driftAngle * 0.02;
      const radius =
        blob.radius * CLOUD.spread * unit * expansion +
        Math.cos(blob.driftAngle + life * TAU * blob.driftSpeed) * unit * 0.015;

      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const size = blob.size * unit * (blob.knot ? 0.5 : 1);

      // A slow seeded pulse so the cloud breathes rather than sitting still.
      const pulse = 0.78 + 0.22 * Math.sin(blob.pulsePhase + frame * blob.pulseRate);

      // Temperature falls off with distance from the discharge: bright knots
      // and cyan near the core, the plasma body through the middle, deep indigo
      // at the outer reaches. That gradient is what makes it read as volume
      // rather than as a flat wash.
      const inner =
        blob.radius < 0.4
          ? blob.knot
            ? theme.plasmaBright
            : theme.plasmaMid
          : blob.radius < 0.72
            ? blob.knot
              ? theme.plasmaMid
              : theme.plasmaDeep
            : theme.plasmaDeep;
      const outerColour = blob.radius < 0.55 ? theme.plasmaMid : theme.plasmaDeep;

      // Near the core the cloud is dense; further out it thins away.
      const falloff = 1 - 0.22 * blob.radius;
      const alpha = clamp(
        blob.alpha *
          CLOUD.baseAlpha *
          CLOUD.density *
          energy *
          pulse *
          falloff *
          (blob.knot ? 1.35 : 1),
        0,
        1,
      );

      // Elliptical, tilted blobs. Perfect circles average out into a flat disc;
      // stretched ones leave the wisps and voids that read as turbulence.
      const gradient = lo.createRadialGradient(0, 0, 0, 0, 0, size);
      gradient.addColorStop(0, rgba(inner, alpha));
      gradient.addColorStop(0.4, rgba(outerColour, alpha * 0.55));
      gradient.addColorStop(1, rgba(outerColour, 0));

      lo.save();
      lo.translate(x, y);
      lo.rotate(blob.tilt + swirl);
      lo.scale(1, blob.aspect);
      lo.fillStyle = gradient;
      lo.beginPath();
      lo.arc(0, 0, size, 0, TAU);
      lo.fill();
      lo.restore();
    }

    // Blur in the reduced space, then let the 8x upscale do the rest — between
    // them no blob edge survives.
    const blurred = clear2d(getScratch("cloud-blur", w, h));
    blurred.filter = `blur(${CLOUD.blurRadius}px)`;
    blurred.drawImage(lo.canvas, 0, 0);
    blurred.filter = "none";

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(blurred.canvas, 0, 0, w, h, 0, 0, width, height);
  }, [canvasRef, frame, width, height, theme, energy, ignition]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={{ display: "none" }} />
  );
};
