import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid, SurfacePoints, Wire } from "../Primitives";
import { useModels } from "../useModels";
import { helixTiles } from "../model";
import { hologram } from "../materials";
import { useStage } from "../scene";
import { drift } from "../random";
import { Hud } from "../Hud";
import "../hudFont";

/**
 * Reference: istockphoto-2228757112 — 15.0s.
 * A horizontal cyan hologram helix running the full width of frame, read
 * through a sci-fi analysis interface. The strand is the same mesh drawn three
 * ways at once: a translucent scanline hologram body, its edges as neon wire to
 * carry the structure, and a light surface point cloud for the sparkle. Copies
 * tile at exact spacing so the strand reads as one continuous run.
 */
export const V05GenomeHud: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  const holo = useMemo(
    () =>
      hologram({
        color: "#2ea8e8",
        hot: "#cdf4ff",
        scanFreq: 52,
        scanSpeed: 3.2,
        intensity: 1.3,
        opacity: 0.72,
      }),
    [],
  );
  holo.uniforms.uTime.value = t;

  const camera: CameraState = {
    position: [drift(t * 0.1, 31) * 0.12, drift(t * 0.09, 67) * 0.1, 3.35],
    lookAt: [0, 0, 0],
    fov: 44,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#03121f" }} />;

  // Three repeats laid end to end read as one continuous sequence, and a slow
  // sideways crawl keeps the strand travelling through frame.
  // Exact tile spacing, so the copies read as one continuous strand.
  const spinX = t * 0.55;
  const repeats = helixTiles(6, 1, t * 0.09);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03111d" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(10,52,86,0.75) 0%, rgba(3,17,29,0) 78%)",
        }}
      />
      {/* Faint data grid behind the strand. */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(60,160,220,0.07) ${Math.max(
            1,
            resolutionScale,
          )}px, transparent ${Math.max(1, resolutionScale)}px), linear-gradient(90deg, rgba(60,160,220,0.07) ${Math.max(
            1,
            resolutionScale,
          )}px, transparent ${Math.max(1, resolutionScale)}px)`,
          backgroundSize: `${64 * resolutionScale}px ${64 * resolutionScale}px`,
          opacity: 0.8,
        }}
      />

      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
          glow={{ blur: 24, opacity: 0.8, scale: 0.3, saturate: 1.4 }}
        >
          {repeats.map((offset, i) => {
            const pos: [number, number, number] = [offset, 0, 0];
            // Every copy shares one rotation, which is what keeps the joins
            // continuous while the whole strand spins.
            const rot: [number, number, number] = [spinX, 0, 0];
            return (
              <React.Fragment key={i}>
                <Solid
                  geometry={geo.dna}
                  material={holo}
                  position={pos}
                  rotation={rot}
                  scale={1}
                />
                <Wire
                  geometry={geo.dna}
                  color="#8febff"
                  opacity={0.6}
                  thresholdAngle={26}
                  position={pos}
                  rotation={rot}
                  scale={1.002}
                />
                <SurfacePoints
                  geometry={geo.dna}
                  count={3200}
                  seed={500 + i}
                  size={1.5}
                  colorA="#5fd4ff"
                  colorB="#eafcff"
                  opacity={0.55}
                  time={t}
                  twinkle={0.8}
                  position={pos}
                  rotation={rot}
                  scale={1.008}
                />
              </React.Fragment>
            );
          })}
        </Stage>
      </AbsoluteFill>

      <Hud frame={frame} fps={fps} scale={resolutionScale} />

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 82% at 50% 50%, rgba(0,0,0,0) 52%, rgba(2,10,20,0.7) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
