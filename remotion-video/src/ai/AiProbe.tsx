// Backdrop probe: inner red, outer green, no bloom, no vignette.
import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Backdrop } from "./layers/Backdrop";
import { Glow } from "./layers/Glow";

export const AiProbe: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 50, position: [0, 0, 5] }}>
        <Glow strength={0.0001} threshold={0.95} />
        <Backdrop
          inner="#ff0000"
          outer="#00ff00"
          aspect={width / height}
          radius={1.2}
          vignette={0}
          dither={0}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
