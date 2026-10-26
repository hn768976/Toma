import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { ShaderCanvas } from "../gl/ShaderCanvas";
import { PAPER_FRAGMENT_SHADER } from "./paperShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const crumpledGridPaperSchema = z.object({
  paperColor: rgb,
  lineColor: rgb,
  shadowTint: rgb,
  gridColumns: z.number(),
});

export type CrumpledGridPaperProps = z.infer<typeof crumpledGridPaperSchema>;

// The reference is a stop-motion loop: 8 crumple states, each held for
// 0.12 s (3 frames at 25 fps), cycling every 0.96 s. State changes are
// timed in seconds so the cadence is identical at 30 fps.
export const STATE_COUNT = 8;
export const STATE_HOLD_SECONDS = 0.12;

// Small exposure differences between the photographed states.
const STATE_EXPOSURE = [0.97, 1.03, 0.99, 0.985, 0.98, 1.01, 1.0, 1.04];

export const CrumpledGridPaper: React.FC<CrumpledGridPaperProps> = ({
  paperColor,
  lineColor,
  shadowTint,
  gridColumns,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // Small epsilon guards against float error exactly on a state boundary.
  const state = Math.floor(frame / fps / STATE_HOLD_SECONDS + 1e-6) % STATE_COUNT;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ShaderCanvas
        fragmentShader={PAPER_FRAGMENT_SHADER}
        width={width}
        height={height}
        uniforms={{
          uState: state,
          uExposure: STATE_EXPOSURE[state],
          uPaperColor: paperColor,
          uLineColor: lineColor,
          uShadowTint: shadowTint,
          uGridColumns: gridColumns,
        }}
      />
    </AbsoluteFill>
  );
};
