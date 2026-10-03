import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { hex } from "../shared/color";
import { FullscreenShader } from "../shared/FullscreenShader";
import { loopFrame, Stage } from "../shared/stage";
import { FOIL_FRAG } from "./shader";

export type FrostedFoilProps = {
  /** Render 601 frames for the loop check (frame 600 must equal frame 0). */
  loopCheck?: boolean;
  light: string;
  mid: string;
  dark: string;
};

export const FrostedFoil: React.FC<FrostedFoilProps> = ({ light, mid, dark }) => {
  const frame = useCurrentFrame();
  const c = useMemo(() => ({ l: hex(light), m: hex(mid), d: hex(dark) }), [light, mid, dark]);
  return (
    <AbsoluteFill style={{ backgroundColor: mid }}>
      <Stage>
        <FullscreenShader
          fragmentShader={FOIL_FRAG}
          uniforms={{
            uLoopFrame: loopFrame(frame),
            uLight: c.l,
            uMid: c.m,
            uDark: c.d,
            uFrostCells: 46,
          }}
        />
      </Stage>
    </AbsoluteFill>
  );
};
