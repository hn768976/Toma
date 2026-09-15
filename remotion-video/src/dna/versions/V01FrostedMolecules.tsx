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
 * Near-black navy field. Frosted glass ball-and-stick molecules drift through
 * the foreground while a faint helix arcs through a heavily defocused
 * background. Depth of field is done by splitting the scene across two
 * canvases and blurring the far one in the compositor.
 */
export const V01FrostedMolecules: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna", "molecule"]);
  const t = frame / fps;

  const nearMaterial = useMemo(
    () =>
      frostedGlass({
        color: "#c9dcef",
        opacity: 0.72,
        roughness: 0.28,
        envIntensity: 2.1,
        emissive: "#16324e",
        emissiveIntensity: 0.35,
      }),
    [],
  );

  const midMaterial = useMemo(
    () =>
      frostedGlass({
        color: "#8fa8c0",
        opacity: 0.5,
        roughness: 0.45,
        envIntensity: 1.4,
      }),
    [],
  );

  const helixMaterial = useMemo(
    () =>
      frostedGlass({
        color: "#6f90ab",
        opacity: 0.62,
        roughness: 0.5,
        envIntensity: 1.1,
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

          <Solid
            geometry={geo.dna}
            material={helixMaterial}
            position={[-0.4, -0.2, -5.2]}
            rotation={[degrees(14), t * 0.1, degrees(-18)]}
            scale={5.0}
          />
          <Solid
            geometry={geo.molecule}
            material={midMaterial}
            position={[3.1, 1.4, -3.4]}
            rotation={spin(1, 2.1)}
            scale={1.5}
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
            position={[-1.15 + drift(t * 0.2, 5) * 0.25, 0.1, 0.4]}
            rotation={spin(1, 0)}
            scale={1.5}
          />
          <Solid
            geometry={geo.molecule}
            material={nearMaterial}
            position={[1.9, -1.0 + drift(t * 0.24, 17) * 0.3, -0.6]}
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
