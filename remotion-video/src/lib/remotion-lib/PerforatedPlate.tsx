/**
 * A dark perforated metal plate filling the frame.
 *
 * Three things stacked: a regular grid of punched holes, each with a lighter
 * rim along its upper edge as though catching light from above; broad
 * irregular tonal patches suggesting uneven wear; and a soft directional light
 * gradient, brightest toward the upper left.
 *
 * The perforation grid is over ten thousand small draws, so the plate is
 * rendered once into an offscreen canvas and blitted thereafter. Only the
 * light gradient moves, drifting very slowly on a closed path — everything
 * else is static, which is what a metal plate should be.
 */

import React, { useMemo } from "react";
import { TAU } from "./math";
import { createLayer, hexToRgb, rgba } from "./canvas";
import { rand01, randRange } from "./seededRandom";

export interface PlateLook {
  /** Base tone of the metal. */
  base: string;
  /** The lighter worn patches, and the holes' upper rims. */
  patch: string;
  /** The perforations themselves. */
  hole: string;
}

export interface PlateMetrics {
  /** Centre-to-centre spacing of the perforations, in pixels. */
  pitch: number;
  /** Radius of each perforation, in pixels. */
  holeRadius: number;
  /**
   * Whole cycles per loop for the light's drift. Integers keep the plate's
   * only moving part closing with the loop.
   */
  lightCyclesX: number;
  lightCyclesY: number;
}

const buildPlateTexture = (
  width: number,
  height: number,
  look: PlateLook,
  metrics: PlateMetrics,
  seed: string,
): HTMLCanvasElement => {
  const { canvas, ctx } = createLayer(width, height);

  ctx.fillStyle = look.base;
  ctx.fillRect(0, 0, width, height);

  // Broad, irregular wear: large soft patches a little lighter and a little
  // darker than the base tone.
  const patch = hexToRgb(look.patch);
  const base = hexToRgb(look.base);
  const patchCount = 46;
  for (let i = 0; i < patchCount; i++) {
    const x = rand01(`${seed}-px-${i}`) * width;
    const y = rand01(`${seed}-py-${i}`) * height;
    const radius = randRange(`${seed}-pr-${i}`, width * 0.06, width * 0.24);
    const lighter = rand01(`${seed}-pk-${i}`) > 0.42;
    const colour = lighter ? patch : base;
    const peak = lighter ? 0.5 : 0.55;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(lighter ? colour : [0, 0, 0], peak));
    gradient.addColorStop(1, rgba(lighter ? colour : [0, 0, 0], 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // The perforations. Rows are offset by half a pitch, which is how punched
  // sheet is actually laid out and reads as denser than a square grid.
  const holeColour = look.hole;
  const rimColour = rgba(patch, 0.55);
  const { pitch, holeRadius } = metrics;
  const rows = Math.ceil(height / pitch) + 2;
  const columns = Math.ceil(width / pitch) + 2;
  for (let row = 0; row < rows; row++) {
    const y = row * pitch - pitch;
    const offset = row % 2 === 0 ? 0 : pitch / 2;
    for (let column = 0; column < columns; column++) {
      const x = column * pitch - pitch + offset;

      // Lighter rim on the upper edge only: light arrives from above.
      ctx.beginPath();
      ctx.arc(x, y - 0.9, holeRadius + 0.9, Math.PI * 1.08, Math.PI * 1.92);
      ctx.strokeStyle = rimColour;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, holeRadius, 0, TAU);
      ctx.fillStyle = holeColour;
      ctx.fill();
    }
  }

  return canvas;
};

export interface PerforatedPlateProps {
  ctx: CanvasRenderingContext2D;
  look: PlateLook;
  metrics: PlateMetrics;
  seed: string;
  width: number;
  height: number;
  /** Loop position in [0, 1). */
  t: number;
}

export const PerforatedPlate: React.FC<PerforatedPlateProps> = ({
  ctx,
  look,
  metrics,
  seed,
  width,
  height,
  t,
}) => {
  const texture = useMemo(
    () => buildPlateTexture(width, height, look, metrics, seed),
    [width, height, look, metrics, seed],
  );

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(texture, 0, 0);

  // The light is a neutral warm highlight and a black falloff rather than a
  // palette colour: it is the lighting on the plate, not the plate's own
  // tone, so it stays the same whatever palette the metal is given.
  // The only moving part of the plate: a very slow closed drift of the light.
  const driftX = Math.sin(TAU * metrics.lightCyclesX * t) * width * 0.035;
  const driftY = Math.sin(TAU * metrics.lightCyclesY * t + Math.PI / 3) * height * 0.03;
  const lightX = width * 0.26 + driftX;
  const lightY = height * 0.2 + driftY;
  const reach = Math.hypot(width, height) * 0.92;

  const gradient = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, reach);
  gradient.addColorStop(0, "rgba(255, 250, 226, 0.11)");
  gradient.addColorStop(0.34, "rgba(255, 248, 220, 0.03)");
  gradient.addColorStop(0.66, "rgba(0, 0, 0, 0.12)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  return null;
};
