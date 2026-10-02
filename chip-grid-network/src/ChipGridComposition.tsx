import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { ALL_COMPS } from "./compositions/defs";
import { ChipGridScene } from "./scene/ChipGridScene";
import { useHdri } from "./scene/useHdri";

export const ChipGridComposition: React.FC<{ compId: string }> = ({ compId }) => {
  // Props are serialised by Remotion, so pass the id and look up the
  // definition (which holds the camera functions) here.
  const def = ALL_COMPS.find((c) => c.id === compId);
  if (!def) throw new Error(`Unknown composition ${compId}`);
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const hdri = useHdri();
  // Compositions are 3840x2160. When rendering, Remotion's --scale sets the
  // device pixel ratio (0.5 -> 1080p, 1.5625 -> 6000x3375); use it as-is so
  // the WebGL drawing buffer matches the output exactly. In the Studio,
  // render at quarter resolution to keep the preview responsive.
  const dpr = typeof window === "undefined" ? 1 : isRendering ? window.devicePixelRatio : 0.35;

  return (
    <AbsoluteFill style={{ backgroundColor: "#121821" }}>
      {hdri ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          shadows
          camera={{ fov: 30, near: 0.5, far: 400, position: [0, 50, 0] }}
          gl={{
            antialias: false,
            alpha: false,
            stencil: false,
            depth: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.type = THREE.PCFShadowMap;
          }}
        >
          <ChipGridScene def={def} hdri={hdri} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
