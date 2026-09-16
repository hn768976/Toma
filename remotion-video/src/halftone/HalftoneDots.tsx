import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  PALETTE_BLUE,
  PALETTE_MONO,
  RADIUS_MAX,
  RADIUS_MIN,
  ROWS,
  type HalftonePalette,
} from "./constants";
import { halftoneField, loopTheta } from "./field";

export const halftoneDotsSchema = z.object({
  variant: z.enum(["mono", "blue"]),
});

export type HalftoneDotsProps = z.infer<typeof halftoneDotsSchema>;

export const halftoneDotsDefaults: HalftoneDotsProps = { variant: "mono" };

const PALETTES: Record<HalftoneDotsProps["variant"], HalftonePalette> = {
  mono: PALETTE_MONO,
  blue: PALETTE_BLUE,
};

/** Lattice geometry for a given frame size - static for the whole clip. */
const useLattice = (width: number, height: number) => {
  return useMemo(() => {
    const pitch = height / ROWS;
    // One spare column so the lattice always bleeds past both vertical edges.
    const cols = Math.ceil(width / pitch) + 1;
    const originX = (width - (cols - 1) * pitch) / 2;
    const originY = pitch / 2;
    return { pitch, cols, originX, originY };
  }, [width, height]);
};

export const HalftoneDots: React.FC<HalftoneDotsProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const { pitch, cols, originX, originY } = useLattice(width, height);
  const palette = PALETTES[variant];

  const theta = loopTheta(frame, durationInFrames);

  const dots = useMemo(() => {
    const out: string[] = [];
    for (let row = 0; row < ROWS; row++) {
      const y = originY + row * pitch;
      const ny = (y - height / 2) / height;
      for (let col = 0; col < cols; col++) {
        const x = originX + col * pitch;
        const nx = (x - width / 2) / height;
        const v = halftoneField(nx, ny, theta);
        const r = pitch * (RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * v);
        // One path per dot, as two arcs - cheaper to parse than <circle> nodes
        // and it keeps the whole lattice in a single painted element.
        out.push(
          `M${(x - r).toFixed(2)} ${y.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(r * 2).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-r * 2).toFixed(2)} 0`,
        );
      }
    }
    return out.join("");
  }, [theta, pitch, cols, originX, originY, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
      >
        <path d={dots} fill={palette.dot} shapeRendering="geometricPrecision" />
      </svg>
    </AbsoluteFill>
  );
};
