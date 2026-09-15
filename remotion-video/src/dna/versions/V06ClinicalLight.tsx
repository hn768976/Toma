import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid } from "../Primitives";
import { useModels } from "../useModels";
import { bandGlow, frostedGlass, matteCeramic } from "../materials";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-1439818670 — 10.0s.
 * A bright clinical plate: pale studio background, a blue glass helix running
 * diagonally with warm red accents pulsing through its base pairs, and pale
 * ball-and-stick molecules receding out of focus behind it.
 *
 * This is the one look where a screen-blend glow would only wash the frame
 * out, so the stage runs without a glow pass.
 */
export const V06ClinicalLight: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna", "molecule"]);
  const t = frame / fps;

  const glass = useMemo(
    () =>
      frostedGlass({
        color: "#4a7ba8",
        opacity: 0.84,
        roughness: 0.16,
        clearcoat: 1,
        envIntensity: 1.7,
      }),
    [],
  );

  const accents = useMemo(
    () =>
      bandGlow({
        color: "#e8483a",
        repeat: 0.62,
        width: 0.075,
        speed: 0.16,
        intensity: 1.15,
        fresnel: 0.55,
      }),
    [],
  );
  accents.uniforms.uTime.value = t;

  const moleculeNear = useMemo(
    () => matteCeramic({ color: "#7d9cba", roughness: 0.42, envIntensity: 1.2 }),
    [],
  );
  const moleculeFar = useMemo(
    () => matteCeramic({ color: "#93afc8", roughness: 0.58, envIntensity: 1.0 }),
    [],
  );

  const camera: CameraState = {
    position: [
      drift(t * 0.16, 37) * 0.22,
      0.05 + drift(t * 0.14, 59) * 0.16,
      4.4 - t * 0.02,
    ],
    lookAt: [0, 0, 0],
    fov: 40,
    roll: drift(t * 0.1, 73) * 1.1,
  };

  // A bright, high-key environment is what makes the glass read as glass here.
  const env = { top: "#ffffff", middle: "#dae8f4", bottom: "#9fb6c8", intensity: 2.2 };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#e3edf4" }} />;

  const tilt = degrees(-32);
  // "ZYX": spin about the helix's own axis first, then tilt into frame.
  const spin = (speed: number, phase: number): [number, number, number] => [
    t * speed + phase,
    0,
    tilt,
  ];
  const tumble = (speed: number, phase: number): [number, number, number] => [
    t * speed * 0.4 + phase,
    t * speed * 0.6 + phase * 1.6,
    t * speed * 0.2,
  ];

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 80% 78% at 44% 34%, #f4f9fc 0%, #dde9f2 46%, #c6d8e6 100%)",
      }}
    >
      {/* Far molecules, well out of focus. */}
      <AbsoluteFill style={{ filter: `blur(${7 * resolutionScale}px)`, opacity: 0.9 }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.05}
        >
          <ambientLight intensity={1.5} color="#e8f2fa" />
          <directionalLight position={[3, 6, 5]} intensity={2.0} color="#ffffff" />
          <Solid
            geometry={geo.molecule}
            material={moleculeFar}
            position={[-3.5, 1.2, -4.0]}
            rotation={tumble(0.8, 1.1)}
            scale={1.7}
          />
          <Solid
            geometry={geo.molecule}
            material={moleculeFar}
            position={[3.6, -1.5, -4.6]}
            rotation={tumble(0.7, 3.9)}
            scale={1.5}
          />
          <Solid
            geometry={geo.molecule}
            material={moleculeFar}
            position={[1.4, 2.4, -5.4]}
            rotation={tumble(0.6, 5.7)}
            scale={1.2}
          />
        </Stage>
      </AbsoluteFill>

      {/* Mid molecules, softly defocused. */}
      <AbsoluteFill style={{ filter: `blur(${2.2 * resolutionScale}px)` }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.0}
        >
          <ambientLight intensity={1.4} color="#e4eff8" />
          <directionalLight position={[2, 5, 6]} intensity={2.2} color="#ffffff" />
          <Solid
            geometry={geo.molecule}
            material={moleculeNear}
            position={[-2.2, -1.25, -1.5]}
            rotation={tumble(0.9, 0.4)}
            scale={1.15}
          />
          <Solid
            geometry={geo.molecule}
            material={moleculeNear}
            position={[2.5, 1.35, -1.8]}
            rotation={tumble(0.85, 2.6)}
            scale={0.95}
          />
        </Stage>
      </AbsoluteFill>

      {/* Hero glass helix. */}
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={0.92}
        >
          <ambientLight intensity={1.1} color="#dfecf7" />
          <directionalLight position={[3, 6, 6]} intensity={2.6} color="#ffffff" />
          <directionalLight position={[-4, -2, 3]} intensity={1.0} color="#bcd6ea" />
          <pointLight position={[-2, 1.5, 3]} intensity={14} color="#ffffff" distance={14} />

          <Solid
            geometry={geo.dna}
            material={glass}
            rotationOrder="ZYX"
            position={[0.1, -0.1, 0.4]}
            rotation={spin(0.36, 0)}
            scale={3.3}
          />
          <Solid
            geometry={geo.dna}
            material={accents}
            rotationOrder="ZYX"
            position={[0.1, -0.1, 0.4]}
            rotation={spin(0.36, 0)}
            scale={3.31}
          />
        </Stage>
      </AbsoluteFill>

      {/* Gentle corner falloff; the reference stays bright in the middle. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 88% 86% at 46% 40%, rgba(255,255,255,0) 55%, rgba(150,175,197,0.35) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
