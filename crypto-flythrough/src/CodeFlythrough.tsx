import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Grain } from "./Grain";
import { Scene } from "./scene/Scene";
import { useCodeTextures } from "./textures";
import { VARIANTS, type VariantName } from "./variants";

export type CodeFlythroughProps = {
  readonly variant: VariantName;
};

/**
 * Remotion's `--scale` flag works by changing Chrome's device scale factor, so
 * matching the WebGL drawing buffer to it renders exactly the pixels that end
 * up in the file instead of a 4K buffer that is then thrown away.
 */
const devicePixelRatio = () =>
  typeof window === "undefined"
    ? 1
    : Math.max(0.25, Math.min(2, window.devicePixelRatio || 1));

export const CodeFlythrough: React.FC<CodeFlythroughProps> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  const config = VARIANTS[variant];
  const textures = useCodeTextures(config.palette, config.streamAxis);

  return (
    <AbsoluteFill style={{ backgroundColor: config.palette.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        gl={{ antialias: false, alpha: false }}
        dpr={devicePixelRatio()}
        flat
        linear={false}
      >
        {textures ? <Scene config={config} textures={textures} /> : null}
      </ThreeCanvas>
      <Grain />
    </AbsoluteFill>
  );
};
