import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { hex } from "../shared/color";
import { FullscreenShader } from "../shared/FullscreenShader";
import { loopFrame, Stage } from "../shared/stage";
import { FLUTED_FRAG } from "./shader";

export type FlutedGlassProps = {
  /** Render 601 frames for the loop check (frame 600 must equal frame 0). */
  loopCheck?: boolean;
  /** Seven gradient colours, '#RRGGBB'. */
  colors: string[];
  /** Presence of each colour in the gradient (1 = normal). */
  weights: number[];
  ribs: number;
  background: string;
};

export const FlutedGlass: React.FC<FlutedGlassProps> = ({ colors, weights, ribs, background }) => {
  const frame = useCurrentFrame();
  const cols = useMemo(() => colors.map(hex), [colors]);
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <Stage>
        <FullscreenShader
          fragmentShader={FLUTED_FRAG}
          uniforms={{
            uLoopFrame: loopFrame(frame),
            uCols: cols,
            uWeights: weights,
            uRibs: ribs,
            uLens: 9.0,
            uGrain: 0.02,
            uHighlight: 0.95,
            uShadow: 0.16,
          }}
        />
      </Stage>
    </AbsoluteFill>
  );
};
