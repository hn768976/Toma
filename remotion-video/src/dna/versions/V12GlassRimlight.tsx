import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid } from "../Primitives";
import { useModels } from "../useModels";
import { fresnelGlow, glossyGlass, matteCeramic } from "../materials";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-467724646 — 20.0s.
 * A dark plate built almost entirely out of rim light: a glossy translucent
 * helix catches a hard blue key from behind, over a soft blue band through the
 * middle of frame. The hero layer holds the glass strand alone — the solid one
 * that used to sit beside it is gone; only the defocused strands remain behind.
 */
export const V12GlassRimlight: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const glass = useMemo(
    () =>
      glossyGlass({
        color: "#6ea6d4",
        opacity: 0.5,
        roughness: 0.08,
        envIntensity: 2.6,
        emissive: "#0d2c4c",
        emissiveIntensity: 0.3,
      }),
    [],
  );

  const rim = useMemo(
    () =>
      fresnelGlow({
        colorA: "#06203c",
        colorB: "#8fdcff",
        power: 2.4,
        intensity: 1.25,
        opacity: 0.9,
      }),
    [],
  );

  const silhouette = useMemo(
    () => matteCeramic({ color: "#0a1420", roughness: 0.75, envIntensity: 0.5 }),
    [],
  );

  const camera: CameraState = {
    position: [
      drift(t * 0.09, 401) * 0.25,
      0.1 + drift(t * 0.08, 419) * 0.18,
      5.0 - Math.sin(t * 0.1) * 0.25,
    ],
    lookAt: [0, 0, 0],
    fov: 40,
    roll: drift(t * 0.07, 433) * 0.8,
  };

  const env = { top: "#2f6d9e", middle: "#0a1c30", bottom: "#02060c", intensity: 1.8 };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#01040a" }} />;

  const tilt = degrees(-20);
  const spin = (speed: number, phase: number): [number, number, number] => [
    t * speed + phase,
    0,
    tilt,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#01040a" }}>
      {/* The blue band the reference runs through the middle of frame. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 72% 26% at 54% 40%, rgba(32,96,160,0.75) 0%, rgba(10,34,62,0.35) 45%, rgba(1,4,10,0) 78%)",
        }}
      />

      {/* Silhouette strands behind, out of focus. */}
      <AbsoluteFill style={{ filter: `blur(${9 * resolutionScale}px)` }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.05}
        >
          <ambientLight intensity={0.35} color="#1d4a78" />
          <directionalLight position={[0, 2, -6]} intensity={2.2} color="#8fd4ff" />
          <Solid
            geometry={geo.dna}
            material={silhouette}
            rotationOrder="ZYX"
            position={[2.6, 1.4, -3.6]}
            rotation={spin(0.22, 2.4)}
            scale={2.4}
          />
          <Solid
            geometry={geo.dna}
            material={silhouette}
            rotationOrder="ZYX"
            position={[-2.8, -1.3, -2.8]}
            rotation={spin(0.26, 5.0)}
            scale={2.1}
          />
        </Stage>
      </AbsoluteFill>

      {/* Hero strand with a hard back key. */}
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.12}
          glow={{ blur: 20, opacity: 0.55, scale: 0.3, saturate: 1.25 }}
        >
          <ambientLight intensity={0.2} color="#16385c" />
          {/* Key from behind the subject — this is what draws the rim. */}
          <directionalLight position={[-2, 3, -7]} intensity={3.4} color="#a8e2ff" />
          <directionalLight position={[5, -2, 3]} intensity={0.7} color="#2a5c8e" />
          <pointLight position={[0, 0.5, -3]} intensity={26} color="#5fbdff" distance={12} />

          <Solid
            geometry={geo.dna}
            material={glass}
            rotationOrder="ZYX"
            position={[0.15, -0.05, 0.5]}
            rotation={spin(0.34, 0)}
            scale={3.5}
          />
          <Solid
            geometry={geo.dna}
            material={rim}
            rotationOrder="ZYX"
            position={[0.15, -0.05, 0.5]}
            rotation={spin(0.34, 0)}
            scale={3.507}
          />
        </Stage>
      </AbsoluteFill>

      {/*
        The vignette is tinted with the background's own colour and ramped over
        several stops. Darkening toward a *different* colour than the backdrop
        is what made the old one read as an ellipse sitting on top of the frame
        rather than as falloff.
      */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 96% 92% at 50% 48%, rgba(1,4,10,0) 35%, rgba(1,4,10,0.25) 58%, rgba(1,4,10,0.6) 78%, rgba(1,4,10,0.88) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
