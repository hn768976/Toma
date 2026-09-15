import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { SurfacePoints, Dust } from "../Primitives";
import { useModels } from "../useModels";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-1372447337 — 11.1s.
 * Two vertical particle helices in a deep blue starfield: a hot amber strand
 * held right of centre, and a cooler blue one hanging far back on the left.
 * Both are point clouds sampled from the same mesh.
 */
export const V07DualDust: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const upright = degrees(90);

  const camera: CameraState = {
    position: [0.55 + drift(t * 0.13, 43) * 0.14, drift(t * 0.11, 89) * 0.14, 3.7],
    lookAt: [0.55, 0, 0],
    fov: 42,
    roll: drift(t * 0.09, 17) * 0.6,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#04101f" }} />;

  return (
    <AbsoluteFill style={{ backgroundColor: "#030c19" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 24% 50%, rgba(18,58,108,0.6) 0%, rgba(3,12,25,0) 72%), radial-gradient(ellipse 45% 60% at 68% 46%, rgba(72,38,16,0.35) 0%, rgba(3,12,25,0) 70%)",
        }}
      />

      {/* Far blue strand, out of focus. */}
      <AbsoluteFill style={{ filter: `blur(${8 * resolutionScale}px)`, opacity: 0.8 }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
        >
          <SurfacePoints
            geometry={geo.dna}
            count={11000}
            seed={701}
            size={3.6}
            colorA="#2062ad"
            colorB="#89c4f0"
            opacity={0.5}
            time={t}
            twinkle={0.55}
            position={[-1.9, 0.1, -2.6]}
            rotation={[0, t * 0.42 + 1.3, upright]}
            scale={2.2}
          />
        </Stage>
      </AbsoluteFill>

      {/* Hero amber strand, sharp. */}
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
          glow={{ blur: 22, opacity: 0.75, scale: 0.3, saturate: 1.35 }}
        >
          <SurfacePoints
            geometry={geo.dna}
            count={30000}
            seed={702}
            size={1.9}
            colorA="#d9631f"
            colorB="#ffd9a0"
            opacity={0.95}
            time={t}
            twinkle={0.75}
            jitter={0.007}
            core={0.19}
            position={[0.95, 0, 0.2]}
            rotation={[0, t * 0.5, upright]}
            scale={2.05}
          />
          {/* A third strand far behind, barely there. */}
          <SurfacePoints
            geometry={geo.dna}
            count={4500}
            seed={703}
            size={2.4}
            colorA="#12467f"
            colorB="#3d82c4"
            opacity={0.3}
            time={t}
            twinkle={0.6}
            position={[-3.4, -0.2, -5.2]}
            rotation={[0, t * 0.33 + 4.2, upright]}
            scale={2.6}
          />

          <Dust
            count={420}
            seed={704}
            bounds={[6, 4, 3.5]}
            size={10}
            colorA="#5b9ad8"
            colorB="#ffe2bb"
            opacity={0.55}
            time={t}
            speed={0.2}
          />
        </Stage>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 78% at 50% 50%, rgba(0,0,0,0) 46%, rgba(2,8,18,0.86) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
