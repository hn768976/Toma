import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid } from "../Primitives";
import { useModels } from "../useModels";
import { matteCeramic } from "../materials";
import { useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-1406187247 — 22.0s.
 * The slowest plate of the set. A horizontal helix sits in a misty blue-grey
 * volume, lit brightly from above and swallowed by fog toward the edges of
 * frame. Scene fog does the heavy lifting here rather than a blur.
 */
export const V10DeepFog: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const body = useMemo(
    () =>
      matteCeramic({
        color: "#9db4c6",
        roughness: 0.6,
        envIntensity: 1.35,
        sheen: "#dbe9f4",
      }),
    [],
  );

  const camera: CameraState = {
    position: [drift(t * 0.07, 61) * 0.18, drift(t * 0.06, 173) * 0.12, 3.9],
    lookAt: [0, 0, 0],
    fov: 44,
    roll: drift(t * 0.05, 197) * 0.5,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#8fa6b6" }} />;

  // A long slow crawl along the axis; three repeats keep frame edges filled.
  const crawl = ((t * 0.035) % 1) * 1.92;

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #cfe2ee 0%, #b7cddc 32%, #7e97a8 72%, #5d7484 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 60% 42% at 50% 16%, rgba(226,240,249,0.9) 0%, rgba(183,205,220,0) 70%)",
        }}
      />

      <AbsoluteFill style={{ filter: `blur(${1.5 * resolutionScale}px)` }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={{ top: "#f0f7fc", middle: "#b9cedd", bottom: "#6d8494", intensity: 1.7 }}
          fog={{ color: "#a6bccb", near: 2.2, far: 7.5 }}
          clearAlpha={0}
          toneMappingExposure={1.15}
        >
          <ambientLight intensity={1.2} color="#dcebf5" />
          <directionalLight position={[0, 7, 3]} intensity={2.3} color="#ffffff" />
          <directionalLight position={[-4, -3, 2]} intensity={0.6} color="#7f98aa" />

          {[-1.92, 0, 1.92, 3.84].map((offset, i) => (
            <Solid
              key={i}
              geometry={geo.dna}
              material={body}
              position={[offset - crawl, -0.05, 0]}
              rotation={[t * 0.22, 0, 0]}
              scale={1}
            />
          ))}
        </Stage>
      </AbsoluteFill>

      {/* Fog sheets in front, drifting slowly across. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 55% 30% at 30% 62%, rgba(186,206,220,0.55) 0%, rgba(186,206,220,0) 70%)",
          transform: `translateX(${Math.sin(t * 0.09) * 40 * resolutionScale}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 45% 26% at 74% 40%, rgba(214,231,241,0.5) 0%, rgba(214,231,241,0) 72%)",
          transform: `translateX(${Math.cos(t * 0.07) * -50 * resolutionScale}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(63,82,96,0.45) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
