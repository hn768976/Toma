import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid } from "../Primitives";
import { useModels } from "../useModels";
import { matteCeramic } from "../materials";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-2289598230 — 12.0s.
 * A quiet studio plate: pale blue-grey seamless, matte ceramic ribbons at a
 * shallow diagonal, and a very shallow focal plane that leaves everything but
 * the middle strand soft.
 */
export const V09CeramicStudio: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const hero = useMemo(
    () =>
      matteCeramic({
        color: "#9fb6cb",
        roughness: 0.5,
        envIntensity: 1.5,
        sheen: "#e8f2fa",
      }),
    [],
  );
  const behind = useMemo(
    () => matteCeramic({ color: "#b3c6d6", roughness: 0.66, envIntensity: 1.2 }),
    [],
  );

  const camera: CameraState = {
    position: [
      drift(t * 0.12, 3) * 0.3,
      0.05 + drift(t * 0.1, 131) * 0.2,
      6.4 - t * 0.02,
    ],
    lookAt: [0, 0, 0],
    fov: 38,
    roll: drift(t * 0.08, 151) * 0.9,
  };

  const env = { top: "#ffffff", middle: "#d2e0ec", bottom: "#93a8bb", intensity: 1.9 };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#c4d3e0" }} />;

  const tilt = degrees(-16);
  const spin = (speed: number, phase: number): [number, number, number] => [
    t * speed + phase,
    0,
    tilt,
  ];

  const lights = (
    <>
      <ambientLight intensity={1.3} color="#e6eef6" />
      <directionalLight position={[2, 6, 5]} intensity={2.1} color="#ffffff" />
      <directionalLight position={[-5, -2, 2]} intensity={0.8} color="#a8bed2" />
    </>
  );

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 78% 72% at 40% 30%, #e6eef6 0%, #cbd9e6 44%, #a8bccd 100%)",
      }}
    >
      {/* Deep background strands, heavily defocused. */}
      <AbsoluteFill style={{ filter: `blur(${13 * resolutionScale}px)`, opacity: 0.85 }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.22}
        >
          {lights}
          <Solid
            geometry={geo.dna}
            material={behind}
            rotationOrder="ZYX"
            position={[-2.7, 1.9, -4.4]}
            rotation={spin(0.24, 1.7)}
            scale={2.3}
          />
          <Solid
            geometry={geo.dna}
            material={behind}
            rotationOrder="ZYX"
            position={[3.0, -2.0, -3.8]}
            rotation={spin(0.27, 4.9)}
            scale={2.0}
          />
          <Solid
            geometry={geo.dna}
            material={behind}
            rotationOrder="ZYX"
            position={[2.4, 2.2, -5.6]}
            rotation={spin(0.21, 3.1)}
            scale={1.8}
          />
        </Stage>
      </AbsoluteFill>

      {/* Mid strand, gently soft. */}
      <AbsoluteFill style={{ filter: `blur(${4.5 * resolutionScale}px)` }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.2}
        >
          {lights}
          <Solid
            geometry={geo.dna}
            material={behind}
            rotationOrder="ZYX"
            position={[-2.3, -1.5, -1.6]}
            rotation={spin(0.3, 2.2)}
            scale={1.85}
          />
        </Stage>
      </AbsoluteFill>

      {/* Hero strand, in focus. */}
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.18}
        >
          {lights}
          <pointLight position={[-1, 2, 4]} intensity={11} color="#ffffff" distance={14} />
          <Solid
            geometry={geo.dna}
            material={hero}
            rotationOrder="ZYX"
            position={[0.2 + drift(t * 0.18, 211) * 0.1, -0.15, 0.3]}
            rotation={spin(0.33, 0.6)}
            scale={3.5}
          />
          {/* A second strand running into the upper right corner. */}
          <Solid
            geometry={geo.dna}
            material={hero}
            rotationOrder="ZYX"
            position={[2.55, 1.95 + drift(t * 0.15, 307) * 0.08, -0.2]}
            rotation={[t * 0.3 + 2.4, 0, degrees(-38)]}
            scale={2.0}
          />
        </Stage>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 86% 84% at 44% 36%, rgba(255,255,255,0) 52%, rgba(126,150,172,0.42) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
