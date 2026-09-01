import { useLayoutEffect, type RefObject } from "react";
import { CENTRE, CORE_FLASH } from "../config";
import { randRange, TAU } from "../random";
import { clear2d } from "../scratch";
import { rgba, type PlasmaTheme } from "../theme";

/**
 * The hottest centre. At ignition it flashes to pure white and blows out; it
 * burns down faster than the master curve, so the web is still writhing after
 * the white has gone.
 *
 * Built from overlapping blobs rather than one circle so the blown-out shape is
 * irregular, and re-seeded along with the filament web so it writhes too.
 */
export const CoreFlash: React.FC<{
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly frame: number;
  readonly width: number;
  readonly height: number;
  readonly theme: PlasmaTheme;
  readonly energy: number;
  readonly seedIndex: number;
}> = ({ canvasRef, frame, width, height, theme, energy, seedIndex }) => {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = clear2d(canvas);
    if (energy <= 0.002) {
      return;
    }

    const cx = width * CENTRE.x;
    const cy = height * CENTRE.y;
    const unit = Math.min(width, height);
    ctx.globalCompositeOperation = "lighter";

    // The soft halo the blown-out centre sits in.
    const haloRadius = unit * CORE_FLASH.haloRadius * (0.7 + 0.3 * energy);
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloRadius);
    halo.addColorStop(0, rgba(theme.coreWhite, CORE_FLASH.haloAlpha * energy));
    halo.addColorStop(0.2, rgba(theme.plasmaCyan, 0.3 * energy));
    halo.addColorStop(0.55, rgba(theme.plasmaMid, 0.17 * energy));
    halo.addColorStop(1, rgba(theme.plasmaDeep, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, haloRadius, 0, TAU);
    ctx.fill();

    for (let i = 0; i < CORE_FLASH.blobCount; i++) {
      const seed = `core-${seedIndex}-${i}`;
      // Spread evenly around the centre rather than seeded freely, so a
      // handful of blobs cannot clump the flash into a teardrop.
      const angle =
        (i / CORE_FLASH.blobCount) * TAU + randRange(`${seed}-a`, -0.5, 0.5);
      const distance = randRange(`${seed}-d`, unit * 0.02, unit * 0.16) * (0.45 + 0.55 * energy);
      const radius =
        unit *
        randRange(`${seed}-r`, CORE_FLASH.blobRadiusMin, CORE_FLASH.blobRadiusMax) *
        (0.35 + 0.65 * energy);

      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      const alpha = randRange(`${seed}-alpha`, 0.09, 0.25) * energy;

      // Stretched and tilted, like the cloud blobs, so the blown-out centre has
      // an irregular edge rather than reading as a disc.
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, rgba(theme.coreWhite, alpha));
      gradient.addColorStop(0.35, rgba(theme.coreWhite, alpha * 0.5));
      gradient.addColorStop(0.68, rgba(theme.plasmaCyan, alpha * 0.26));
      gradient.addColorStop(1, rgba(theme.plasmaMid, 0));

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(randRange(`${seed}-tilt`, 0, TAU));
      ctx.scale(1, randRange(`${seed}-aspect`, 0.5, 1));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }, [canvasRef, frame, width, height, theme, energy, seedIndex]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={{ display: "none" }} />
  );
};
