import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid } from "../Primitives";
import { useModels } from "../useModels";
import { iridescent } from "../materials";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-2257339429 — 8.4s.
 * The violet strand carries the frame alone — nothing sits behind it — with a
 * single second strand in the bottom-left corner. Lit magenta from the upper
 * right and deep blue from below, with an iridescent sheen rolling over the
 * ribbons as they turn.
 */
export const V03VioletCascade: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const hero = useMemo(
    () =>
      iridescent({
        base: "#4c3f8f",
        shiftA: "#2b4bb8",
        shiftB: "#ff5fa8",
        roughness: 0.2,
        envIntensity: 2.0,
      }),
    [],
  );

  const backdropStrand = useMemo(
    () =>
      iridescent({
        base: "#22306e",
        shiftA: "#1d3a86",
        shiftB: "#7b4fd0",
        roughness: 0.4,
        envIntensity: 1.2,
        opacity: 0.85,
      }),
    [],
  );

  const camera: CameraState = {
    position: [drift(t * 0.2, 19) * 0.22, 0.1 + drift(t * 0.17, 61) * 0.14, 3.1],
    lookAt: [0, 0, 0],
    fov: 42,
    roll: -4 + drift(t * 0.12, 83) * 1.2,
  };

  const env = { top: "#c04fd0", middle: "#3a3f9e", bottom: "#101a4a", intensity: 1.9 };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#0c1140" }} />;

  const tilt = degrees(-24);
  // "ZYX" so the strand spins about its own long axis and the tilt is applied
  // afterwards, in the plane of frame.
  const spin = (speed: number, phase: number): [number, number, number] => [
    t * speed + phase,
    0,
    tilt,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b1038" }}>
      {/* The reference's light field: magenta from upper right, blue below. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 72% 8%, rgba(190,72,150,0.75) 0%, rgba(70,48,140,0.35) 45%, rgba(11,16,56,0) 78%), radial-gradient(ellipse 70% 60% at 22% 88%, rgba(28,54,150,0.6) 0%, rgba(11,16,56,0) 70%)",
        }}
      />

      {/* The only other strand: one in the bottom-left corner. */}
      <AbsoluteFill style={{ filter: `blur(${3.5 * resolutionScale}px)` }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.05}
        >
          <ambientLight intensity={0.45} color="#5647a2" />
          <directionalLight position={[4, 5, 4]} intensity={1.9} color="#ff9ad0" />
          <directionalLight position={[-4, -3, 2]} intensity={1.2} color="#4a74e8" />
          <Solid
            geometry={geo.dna}
            material={backdropStrand}
            rotationOrder="ZYX"
            position={[-1.1, -1.5, -1.8]}
            rotation={spin(0.34, 2.7)}
            scale={4.0}
          />
        </Stage>
      </AbsoluteFill>

      {/* Hero strand. */}
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={env}
          clearAlpha={0}
          toneMappingExposure={1.1}
          glow={{ blur: 18, opacity: 0.45, scale: 0.3, saturate: 1.45 }}
        >
          <ambientLight intensity={0.4} color="#4e3f96" />
          <directionalLight position={[4, 6, 5]} intensity={2.4} color="#ffa0d6" />
          <directionalLight position={[-5, -3, 3]} intensity={1.4} color="#4f7bf0" />
          <pointLight position={[2.5, 2.5, 2]} intensity={16} color="#ff6fb4" distance={12} />

          <Solid
            geometry={geo.dna}
            material={hero}
            rotationOrder="ZYX"
            position={[0.35 + drift(t * 0.2, 7) * 0.12, 0.05, 0.2]}
            rotation={spin(0.38, 0)}
            scale={4.6}
          />
        </Stage>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 78% at 50% 50%, rgba(0,0,0,0) 48%, rgba(7,10,38,0.78) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
