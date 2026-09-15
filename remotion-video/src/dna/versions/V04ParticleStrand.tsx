import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { SurfacePoints, Dust } from "../Primitives";
import { useModels } from "../useModels";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-1418962855 — 20.0s.
 * The helix is drawn entirely as glowing dots sampled from the mesh surface —
 * no solid body at all — climbing diagonally across a near-black navy field.
 */
export const V04ParticleStrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const camera: CameraState = {
    position: [
      drift(t * 0.12, 23) * 0.4,
      0.15 + drift(t * 0.1, 47) * 0.25,
      4.0 - Math.sin(t * 0.14) * 0.3,
    ],
    lookAt: [0, 0, 0],
    fov: 40,
    roll: drift(t * 0.08, 91) * 0.9,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#040a18" }} />;

  // Climbing diagonal, matching the reference's lower-left to upper-right run.
  const tilt = degrees(26);
  // "ZYX": the strand rolls about its own axis, then tilts into the diagonal.
  const rot = (speed: number, phase: number): [number, number, number] => [
    t * speed + phase,
    0,
    tilt,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#030814" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 66% 60% at 42% 52%, rgba(14,40,86,0.5) 0%, rgba(3,8,20,0) 72%)",
        }}
      />

      {/* Defocused strands stacked behind the hero. */}
      <AbsoluteFill style={{ filter: `blur(${7 * resolutionScale}px)`, opacity: 0.7 }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
        >
          <SurfacePoints
            geometry={geo.dna}
            count={5000}
            seed={411}
            size={3.4}
            colorA="#1b4f96"
            colorB="#5e9fe0"
            opacity={0.55}
            time={t}
            rotationOrder="ZYX"
            twinkle={0.5}
            position={[2.4, 1.5, -4.2]}
            rotation={rot(0.22, 2.2)}
            scale={3.6}
          />
          <SurfacePoints
            geometry={geo.dna}
            count={4000}
            seed={412}
            size={3.0}
            colorA="#13396f"
            colorB="#3f7cc0"
            opacity={0.4}
            time={t}
            rotationOrder="ZYX"
            twinkle={0.5}
            position={[-3.0, -1.7, -5.0]}
            rotation={rot(0.19, 5.1)}
            scale={3.3}
          />
        </Stage>
      </AbsoluteFill>

      {/* Hero particle strand. */}
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
          glow={{ blur: 20, opacity: 0.5, scale: 0.3, saturate: 1.5 }}
        >
          <SurfacePoints
            geometry={geo.dna}
            count={38000}
            seed={401}
            size={1.9}
            colorA="#1f6ec4"
            colorB="#7fc4f5"
            opacity={0.78}
            time={t}
            rotationOrder="ZYX"
            twinkle={0.7}
            jitter={0.006}
            core={0.2}
            position={[-0.15, -0.05, 0]}
            rotation={rot(0.26, 0)}
            scale={3.9}
          />
          <Dust
            count={260}
            seed={402}
            bounds={[6, 4, 3.5]}
            size={12}
            colorA="#3f7fc4"
            colorB="#cfe8ff"
            opacity={0.45}
            time={t}
            speed={0.14}
          />
        </Stage>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 76% at 48% 50%, rgba(0,0,0,0) 44%, rgba(2,5,14,0.85) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
