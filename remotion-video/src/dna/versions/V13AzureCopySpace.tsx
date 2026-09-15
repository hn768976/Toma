import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { SurfacePoints, Dust } from "../Primitives";
import { useModels } from "../useModels";
import { degrees, useStage } from "../scene";
import { drift } from "../random";
import { Plexus } from "../Plexus";

/**
 * Reference: istockphoto-1264115405 — 12.0s.
 * A bright azure field with the particle helix held hard to the left, leaving
 * the right two-thirds of frame as clean copy space. Plexus lines run behind
 * the strand.
 */
export const V13AzureCopySpace: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const upright = degrees(90);

  const camera: CameraState = {
    position: [-1.25 + drift(t * 0.12, 503) * 0.1, drift(t * 0.1, 521) * 0.12, 3.4],
    lookAt: [-1.25, 0, 0],
    fov: 42,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#0a5fae" }} />;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 86% 82% at 72% 26%, #2e8fd8 0%, #1470bd 38%, #064b8e 74%, #03356a 100%)",
      }}
    >
      <Plexus
        frame={frame}
        fps={fps}
        seed={1301}
        nodes={40}
        linkDistance={0.22}
        color="#cfe8ff"
        lineOpacity={0.18}
        dotOpacity={0.35}
        dotRadius={1.6}
        strokeWidth={0.9}
        speed={0.6}
        scale={resolutionScale}
      />

      {/* A softer strand well behind the hero. */}
      <AbsoluteFill style={{ filter: `blur(${7 * resolutionScale}px)`, opacity: 0.55 }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
        >
          <SurfacePoints
            geometry={geo.dna}
            count={7000}
            seed={1302}
            size={3.2}
            colorA="#8ecbf5"
            colorB="#ffffff"
            opacity={0.45}
            time={t}
            twinkle={0.5}
            position={[-2.6, 0.2, -3.0]}
            rotation={[0, t * 0.38 + 2.1, upright]}
            scale={2.1}
          />
        </Stage>
      </AbsoluteFill>

      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
          glow={{ blur: 18, opacity: 0.6, scale: 0.3, saturate: 1.2 }}
        >
          <SurfacePoints
            geometry={geo.dna}
            count={28000}
            seed={1303}
            size={1.9}
            colorA="#bfe4ff"
            colorB="#ffffff"
            opacity={0.95}
            time={t}
            twinkle={0.7}
            jitter={0.006}
            core={0.2}
            position={[-1.25, 0, 0.2]}
            rotation={[0, t * 0.46, upright]}
            scale={2.25}
          />
          <Dust
            count={260}
            seed={1304}
            bounds={[6, 4, 3]}
            size={9}
            colorA="#dff0ff"
            colorB="#ffffff"
            opacity={0.4}
            time={t}
            speed={0.16}
          />
        </Stage>
      </AbsoluteFill>

      {/* Light bloom in the upper right, matching the reference's key. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 46% 42% at 78% 18%, rgba(190,226,255,0.45) 0%, rgba(20,112,189,0) 72%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 84% 80% at 52% 48%, rgba(0,0,0,0) 54%, rgba(2,40,84,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
