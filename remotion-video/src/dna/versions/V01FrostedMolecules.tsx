import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid, Dust } from "../Primitives";
import { useModels } from "../useModels";
import { frostedGlass } from "../materials";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-2200844203 — 14.0s.
 * Near-black navy field. Soft satin-glass molecules hold the left of frame
 * while the helix runs down the right, close enough to read clearly rather
 * than sitting at the edge of visibility. Depth of field is done by splitting
 * the scene across two canvases and blurring the far one in the compositor.
 */
export const V01FrostedMolecules: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna", "molecule"]);
  const t = frame / fps;

  const nearMaterial = useMemo(
    () =>
      frostedGlass({
        // Soft satin glass: high roughness keeps the highlights broad and
        // diffuse rather than the hard specular pinpoints of polished glass.
        color: "#cfe0f0",
        opacity: 0.5,
        roughness: 0.62,
        clearcoat: 0.45,
        envIntensity: 1.5,
        emissive: "#1b3a58",
        emissiveIntensity: 0.3,
      }),
    [],
  );

  const midMaterial = useMemo(
    () =>
      frostedGlass({
        color: "#9db6cc",
        opacity: 0.38,
        roughness: 0.7,
        clearcoat: 0.3,
        envIntensity: 1.1,
      }),
    [],
  );

  const helixMaterial = useMemo(
    () =>
      frostedGlass({
        color: "#9fc2dd",
        opacity: 0.9,
        roughness: 0.4,
        envIntensity: 1.9,
        emissive: "#2a5680",
        emissiveIntensity: 0.55,
      }),
    [],
  );

  const camera: CameraState = {
    position: [
      drift(t * 0.22, 11) * 0.5,
      0.25 + drift(t * 0.19, 29) * 0.35,
      7.6 - t * 0.055,
    ],
    lookAt: [drift(t * 0.15, 71) * 0.3, drift(t * 0.13, 97) * 0.25, 0],
    fov: 38,
    roll: drift(t * 0.11, 53) * 1.6,
  };

  const env = {
    top: "#20344b",
    middle: "#0b1522",
    bottom: "#04070c",
    intensity: 1.5,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#03060b" }} />;

  const spin = (speed: number, phase: number): [number, number, number] => [
    t * speed * 0.42 + phase,
    t * speed * 0.63 + phase * 1.7,
    t * speed * 0.21,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#03060b" }}>
      {/* Far layer: the helix and out-of-focus molecules. */}
      <AbsoluteFill style={{ filter: `blur(${14 * resolutionScale}px)` }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearColor="#03060b"
          clearAlpha={0}
          toneMappingExposure={1.1}
        >
          <ambientLight intensity={0.35} color="#2a4d6b" />
          <directionalLight position={[4, 6, 5]} intensity={1.5} color="#cfe3ff" />
          <directionalLight position={[-6, -2, -4]} intensity={0.7} color="#2b4a72" />

          {/* The strand holds the right of frame, closer in and far more
              present than before. */}
          <Solid
            geometry={geo.dna}
            material={helixMaterial}
            rotationOrder="ZYX"
            position={[2.6, -0.1, -2.6]}
            rotation={[t * 0.22, 0, degrees(-24)]}
            scale={3.6}
          />
          <Solid
            geometry={geo.dna}
            material={midMaterial}
            rotationOrder="ZYX"
            position={[3.4, 1.9, -5.0]}
            rotation={[t * 0.18 + 2.1, 0, degrees(-30)]}
            scale={3.0}
          />
          <Solid
            geometry={geo.molecule}
            material={midMaterial}
            position={[-3.4, -1.6, -2.6]}
            rotation={spin(0.8, 5.3)}
            scale={1.25}
          />
        </Stage>
      </AbsoluteFill>

      {/* Near layer: the sharp glass molecules. */}
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearColor="#000000"
          clearAlpha={0}
          toneMappingExposure={1.15}
          glow={{ blur: 16, opacity: 0.4, scale: 0.3, saturate: 1.1 }}
        >
          <ambientLight intensity={0.4} color="#33506f" />
          <directionalLight position={[3, 5, 6]} intensity={2.1} color="#e8f2ff" />
          <directionalLight position={[-5, -3, 2]} intensity={0.9} color="#35608f" />
          <pointLight position={[0, 0, 3]} intensity={12} color="#a8c8ea" distance={14} />

          <Solid
            geometry={geo.molecule}
            material={nearMaterial}
            position={[-2.05 + drift(t * 0.2, 5) * 0.22, 0.25, 0.4]}
            rotation={spin(1, 0)}
            scale={1.5}
          />
          <Solid
            geometry={geo.molecule}
            material={nearMaterial}
            position={[-0.55, -1.35 + drift(t * 0.24, 17) * 0.28, -0.6]}
            rotation={spin(0.9, 3.4)}
            scale={1.1}
          />

          <Dust
            count={140}
            seed={101}
            bounds={[7, 4.5, 4]}
            size={26}
            colorA="#7d9fc6"
            colorB="#cfe0f2"
            opacity={0.35}
            time={t}
            speed={0.18}
          />
        </Stage>
      </AbsoluteFill>

      {/* Lens vignette, matching the reference's falloff into the corners. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 72% 68% at 50% 48%, rgba(0,0,0,0) 40%, rgba(2,4,9,0.82) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
