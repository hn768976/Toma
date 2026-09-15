import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid, SurfacePoints, Wire } from "../Primitives";
import { useModels } from "../useModels";
import { fresnelGlow } from "../materials";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-2166967985 — 8.3s.
 * Pure black, with the helix reading as neon light streaks: the mesh's sharp
 * edges drawn additively in cyan, a magenta rim shell over the same geometry,
 * and hot points picking out the base pairs.
 */
export const V08NeonWire: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const rim = useMemo(
    () =>
      fresnelGlow({
        colorA: "#1590c8",
        colorB: "#8f3fd8",
        power: 2.2,
        intensity: 1.25,
        opacity: 0.85,
      }),
    [],
  );

  const camera: CameraState = {
    position: [drift(t * 0.15, 5) * 0.2, drift(t * 0.13, 101) * 0.14, 2.7],
    lookAt: [0, 0, 0],
    fov: 44,
    roll: drift(t * 0.11, 29) * 1.4,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

  const tilt = degrees(18);
  // "ZYX" keeps the spin on the strand's own axis under the screen-plane tilt.
  const rot: [number, number, number] = [t * 0.52, 0, tilt];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearColor="#000000"
          clearAlpha={0}
          glow={{ blur: 26, opacity: 0.85, scale: 0.3, saturate: 1.5 }}
        >
          {/* A dim strand behind, to give the black some depth. */}
          <Wire
            geometry={geo.dna}
            color="#1b5f9e"
            opacity={0.14}
            thresholdAngle={40}
            position={[1.2, -0.9, -4.2]}
            rotation={[0, t * 0.4 + 2.4, tilt]}
            scale={2.4}
          />

          <Solid
            geometry={geo.dna}
            material={rim}
            rotationOrder="ZYX"
            position={[0, 0, 0]}
            rotation={rot}
            scale={4.1}
          />
          <Wire
            geometry={geo.dna}
            color="#49d8ff"
            opacity={0.8}
            thresholdAngle={34}
            rotationOrder="ZYX"
            position={[0, 0, 0]}
            rotation={rot}
            scale={4.11}
          />
          <SurfacePoints
            geometry={geo.dna}
            count={16000}
            seed={801}
            size={2.3}
            colorA="#4ae0ff"
            colorB="#e070ff"
            opacity={0.85}
            time={t}
            twinkle={0.9}
            jitter={0.005}
            core={0.16}
            rotationOrder="ZYX"
            position={[0, 0, 0]}
            rotation={rot}
            scale={4.12}
          />
        </Stage>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 82% 80% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.9) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
