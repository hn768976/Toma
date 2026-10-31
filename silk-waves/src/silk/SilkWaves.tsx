import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { ShaderCanvas } from "./ShaderCanvas";
import { SILK_FRAGMENT_SHADER } from "./silkShader";
import { CHAMPAGNE_GOLD, MIDNIGHT_NAVY } from "./palettes";

export const silkWavesSchema = z.object({
  palette: z.enum(["midnight-navy", "champagne-gold"]),
});

type Props = z.infer<typeof silkWavesSchema>;

const PALETTES = {
  "midnight-navy": MIDNIGHT_NAVY,
  "champagne-gold": CHAMPAGNE_GOLD,
} as const;

/** Strands sweep from lower-left to upper-right at ~20 degrees. */
const STRAND_ANGLE = (20 * Math.PI) / 180;

export const SilkWaves: React.FC<Props> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = PALETTES[palette];

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ShaderCanvas
        fragmentShader={SILK_FRAGMENT_SHADER}
        uniforms={{
          u_time: frame / fps,
          // The whole clip is one seamless loop.
          u_loop: durationInFrames / fps,
          u_frame: frame,
          u_angle: STRAND_ANGLE,
          u_bgCenter: p.bgCenter,
          u_bgEdge: p.bgEdge,
          u_veil: p.veil,
          u_sheen: p.sheen,
          u_fiber: p.fiber,
          u_exposure: p.exposure,
        }}
      />
    </AbsoluteFill>
  );
};
