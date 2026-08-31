import React, { useMemo } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { HEIGHT, WIDTH } from "../layout";
import {
  buildDotMatrix,
  createOffscreen,
  traceLand,
  type LandGeometry,
} from "../geo";
import type { MapMode, Palette } from "../variants";

/** Screen pitch of the v2 dot matrix, in 4K pixels. */
const DOT_PITCH = 16;

const withAlpha = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Draws the land once, at construction, into a canvas the size of the frame.
 * Re-projecting 10,000 vertices on every one of 420 frames is the expensive
 * mistake this avoids; per frame the map costs a single drawImage.
 */
const renderLand = (
  land: LandGeometry,
  mode: MapMode,
  ink: string,
): HTMLCanvasElement => {
  const canvas = createOffscreen(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (mode === "filled") {
    // Low contrast on purpose: a backdrop that competes with the charts
    // would sink the piece.
    ctx.fillStyle = withAlpha(ink, 0.26);
    traceLand(ctx, land);
    ctx.fill("evenodd");
    ctx.strokeStyle = withAlpha(ink, 0.34);
    ctx.lineWidth = 2;
    ctx.stroke();
    return canvas;
  }

  if (mode === "outline") {
    ctx.strokeStyle = withAlpha(ink, 0.55);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    traceLand(ctx, land);
    ctx.stroke();
    return canvas;
  }

  const matrix = buildDotMatrix(land, DOT_PITCH);
  const inner = withAlpha(ink, 0.38);
  const edge = withAlpha(ink, 0.9);
  for (let row = 0; row < matrix.rows; row++) {
    for (let col = 0; col < matrix.cols; col++) {
      const index = row * matrix.cols + col;
      if (!matrix.land[index]) continue;
      const coastal = matrix.coastal[index] === 1;
      const size = coastal ? 7 : 6;
      ctx.fillStyle = coastal ? edge : inner;
      ctx.fillRect(
        Math.round(col * DOT_PITCH + (DOT_PITCH - size) / 2),
        Math.round(row * DOT_PITCH + (DOT_PITCH - size) / 2),
        size,
        size,
      );
    }
  }
  return canvas;
};

export type WorldBackdropProps = {
  land: LandGeometry | null;
  mode: MapMode;
  palette: Palette;
  frame: number;
  /** 0..1 timeline progress, shared with every other layer. */
  progress: number;
  /** Ramps the map up out of the dim opening. */
  dim: number;
  /** Colour of the mood wash, or null when the variant does not carry one. */
  moodWash: string | null;
};

/**
 * The deep ground, the slow light wash drifting behind everything, the
 * optional mood wash, and the continents themselves.
 */
export const WorldBackdrop: React.FC<WorldBackdropProps> = ({
  land,
  mode,
  palette,
  frame,
  progress,
  dim,
  moodWash,
}) => {
  const map = useMemo(
    () => (land ? renderLand(land, mode, palette.mapInk) : null),
    [land, mode, palette.mapInk],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = palette.backgroundDeep;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Two broad washes drifting at different rates; slow enough that the eye
    // reads it as light rather than as movement.
    const washes: Array<[number, number, number, number]> = [
      [
        WIDTH * (0.34 + 0.1 * Math.sin(frame * 0.0062)),
        HEIGHT * (0.36 + 0.07 * Math.cos(frame * 0.0048)),
        WIDTH * 0.62,
        0.45,
      ],
      [
        WIDTH * (0.72 + 0.09 * Math.cos(frame * 0.0039 + 1.7)),
        HEIGHT * (0.52 + 0.08 * Math.sin(frame * 0.0055 + 0.6)),
        WIDTH * 0.5,
        0.3,
      ],
    ];
    for (const [x, y, radius, alpha] of washes) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, withAlpha(palette.backgroundWash, alpha));
      gradient.addColorStop(1, withAlpha(palette.backgroundWash, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    if (moodWash) {
      // Grows as the series fall, strongest in the final third. It should
      // register as mood, not as an element.
      const strength = Math.max(0, (progress - 0.42) / 0.58) ** 1.6 * 0.2;
      if (strength > 0.001) {
        const x = WIDTH * 0.6;
        const y = HEIGHT * 0.62;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, WIDTH * 0.78);
        gradient.addColorStop(0, withAlpha(moodWash, strength));
        gradient.addColorStop(1, withAlpha(moodWash, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
    }

    if (map) {
      ctx.globalAlpha = dim;
      ctx.drawImage(map, 0, 0);
      ctx.globalAlpha = 1;
    }
  };

  return <CanvasLayer draw={draw} />;
};
