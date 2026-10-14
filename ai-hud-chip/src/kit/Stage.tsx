import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, getRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useFontsReady } from "./fonts";

/**
 * ThreeCanvas wrapper.
 * - dpr follows Remotion's --scale exactly while rendering (0.333 → 1280×720,
 *   1 → 3840×2160, 1.5625 → 6000×3375). R3F's default dpr clamp [1,2] would
 *   otherwise render 4K and downsample for every preview.
 * - Nothing mounts until the OFL fonts are loaded (delayRender), so canvas
 *   textures are built once with the right glyphs.
 */
export const Stage: React.FC<{ children: React.ReactNode; fov: number }> = ({ children, fov }) => {
  const { width, height } = useVideoConfig();
  const fontsReady = useFontsReady();
  const env = getRemotionEnvironment();
  const dpr = env.isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1) * 0.5;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {fontsReady ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          gl={{
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          camera={{ fov, near: 0.1, far: 200, position: [0, 0, 10] }}
        >
          {children}
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
