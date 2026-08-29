import React from "react";
import { interpolate, spring } from "remotion";
import { CELL_RADIUS, CELL_SIZE, type PlacedElement } from "./layout";
import { breatheAt, type CellTiming } from "./motion";
import { FONT_FAMILY } from "./fonts";
import type { CellPaint, Variant } from "./variants";

/** Split so the bloom filter can be applied to the ink only. */
export type CellLayer = "body" | "ink";

export const glowGradientId = (color: string): string =>
  `cell-glow-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

const HALO_SCALE = 2.3;
const HALO_BASE_OPACITY = 0.55;
const BORDER_WIDTH = 3;
const FLASH_FRAMES = 4;
const FADE_IN_FRAMES = 12;
const SYMBOL_SIZE = 62;
const NUMBER_SIZE = 24;
const NUMBER_INSET = 15;

export const ElementCell: React.FC<{
  element: PlacedElement;
  paint: CellPaint;
  variant: Variant;
  timing: CellTiming;
  frame: number;
  fps: number;
  layer: CellLayer;
  /** Extra glow from the scattered brighten pass, 0-1. */
  spark: number;
  /** Category highlight intensity, 0-1. */
  intensity: number;
}> = ({
  element,
  paint,
  variant,
  timing,
  frame,
  fps,
  layer,
  spark,
  intensity,
}) => {
  const local = frame - timing.start;
  if (local < 0) {
    // Nothing exists before its own start frame - frame 0 is empty by design.
    return null;
  }

  const progress = spring({
    frame: local,
    fps,
    config: { damping: 15, stiffness: 90 },
    durationInFrames: timing.travel,
  });

  const travelled = Math.max(0, Math.min(1, progress));
  const dx = interpolate(progress, [0, 1], [timing.fromX, element.x]) - element.x;
  const dy = interpolate(progress, [0, 1], [timing.fromY, element.y]) - element.y;

  // Bow the path sideways, perpendicular to the direction of travel.
  const pathX = element.x - timing.fromX;
  const pathY = element.y - timing.fromY;
  const pathLength = Math.sqrt(pathX * pathX + pathY * pathY) || 1;
  const bowAmount = timing.bow * Math.sin(travelled * Math.PI);
  const bowX = (-pathY / pathLength) * bowAmount;
  const bowY = (pathX / pathLength) * bowAmount;

  const rotation = interpolate(progress, [0, 1], [timing.fromRotation, 0]);
  const opacity = interpolate(local, [0, FADE_IN_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const flash =
    frame < timing.land
      ? 0
      : interpolate(frame, [timing.land, timing.land + FLASH_FRAMES], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const glowStrength =
    breatheAt(frame, element.atomicNumber) *
    (1 + spark * 0.9 + flash * 1.2) *
    intensity;

  const transform = `translate(${dx + bowX} ${dy + bowY}) rotate(${rotation} ${element.cx} ${element.cy})`;

  if (layer === "body") {
    const haloSize = CELL_SIZE * HALO_SCALE;
    return (
      <g transform={transform} opacity={opacity}>
        <rect
          x={element.cx - haloSize / 2}
          y={element.cy - haloSize / 2}
          width={haloSize}
          height={haloSize}
          fill={`url(#${glowGradientId(paint.glow)})`}
          opacity={Math.min(1, HALO_BASE_OPACITY * glowStrength)}
        />
        <rect
          x={element.x}
          y={element.y}
          width={CELL_SIZE}
          height={CELL_SIZE}
          rx={CELL_RADIUS}
          ry={CELL_RADIUS}
          fill={paint.fill}
          opacity={0.35 + 0.65 * intensity}
        />
      </g>
    );
  }

  return (
    <g transform={transform} opacity={opacity}>
      <rect
        x={element.x}
        y={element.y}
        width={CELL_SIZE}
        height={CELL_SIZE}
        rx={CELL_RADIUS}
        ry={CELL_RADIUS}
        fill="none"
        stroke={paint.border}
        strokeWidth={BORDER_WIDTH}
        opacity={0.35 + 0.65 * intensity}
      />
      {flash > 0 ? (
        <rect
          x={element.x}
          y={element.y}
          width={CELL_SIZE}
          height={CELL_SIZE}
          rx={CELL_RADIUS}
          ry={CELL_RADIUS}
          fill="none"
          stroke={variant.flashColor}
          strokeWidth={BORDER_WIDTH + 2.5 * flash}
          opacity={flash}
        />
      ) : null}
      <text
        x={element.x + NUMBER_INSET}
        y={element.y + NUMBER_INSET}
        fontFamily={FONT_FAMILY}
        fontSize={NUMBER_SIZE}
        fontWeight={400}
        fill={variant.numberColor}
        dominantBaseline="hanging"
        opacity={0.4 + 0.6 * intensity}
      >
        {element.atomicNumber}
      </text>
      <text
        x={element.cx}
        y={element.cy + 10}
        fontFamily={FONT_FAMILY}
        fontSize={SYMBOL_SIZE}
        fontWeight={700}
        fill={variant.symbolColor}
        textAnchor="middle"
        dominantBaseline="middle"
        opacity={0.4 + 0.6 * intensity}
      >
        {element.symbol}
      </text>
    </g>
  );
};
