import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid, SurfacePoints, Wire } from "../Primitives";
import { useModels } from "../useModels";
import { hologram } from "../materials";
import { useStage } from "../scene";
import { drift } from "../random";
import { Hud } from "../Hud";
import "../hudFont";

/**
 * Reference: istockphoto-2228757112 — 15.0s.
 * A horizontal cyan hologram helix running the full width of frame, read
 * through a sci-fi analysis interface. The strand is the same mesh drawn three
 * ways at once: a scanline hologram body, its sharp edges as neon wire, and a
 * surface point cloud for the sparkle.
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
        hot: "#bff0ff",
        scanFreq: 30,
        scanSpeed: 2.6,
        intensity: 1.15,
        opacity: 0.9,
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
  const crawl = ((t * 0.09) % 1) * 1.94;
  const spinX = t * 0.55;
  const repeats = [-1.94, 0, 1.94, 3.88];

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
            const pos: [number, number, number] = [offset - crawl, 0, 0];
            const rot: [number, number, number] = [spinX + i * 0.0, 0, 0];
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
                  color="#7fe4ff"
                  opacity={0.34}
                  thresholdAngle={38}
                  position={pos}
                  rotation={rot}
                  scale={1.002}
                />
                <SurfacePoints
                  geometry={geo.dna}
                  count={5200}
                  seed={500 + i}
                  size={1.7}
                  colorA="#4fc8ff"
                  colorB="#eafcff"
                  opacity={0.8}
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
