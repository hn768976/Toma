import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid, SurfacePoints, Dust } from "../Primitives";
import { useModels } from "../useModels";
import { helixTiles } from "../model";
import { fresnelGlow, frostedGlass } from "../materials";
import { degrees, useStage } from "../scene";
import { drift } from "../random";

/**
 * Reference: istockphoto-2245145050 — 10.0s.
 * A vertical helix held to the right of frame against a very deep navy field.
 * The strand is lit hottest at the top and falls away into darkness, with
 * sparkle points crawling along its surface.
 */
const HERO_SCALE = 2.3;
const BACK_SCALE = 3.4;

export const V02NavySparkle: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna"]);
  const t = frame / fps;

  // The helix is authored along X, so a quarter turn on Z stands it upright.
  const upright = degrees(90);

  const body = useMemo(
    () =>
      frostedGlass({
        color: "#15406e",
        opacity: 0.55,
        roughness: 0.34,
        envIntensity: 1.5,
        emissive: "#0a2a48",
        emissiveIntensity: 0.5,
      }),
    [],
  );

  const rim = useMemo(
    () =>
      fresnelGlow({
        colorA: "#0a1f3d",
        colorB: "#3fa9ff",
        power: 2.0,
        intensity: 1.35,
        opacity: 0.95,
      }),
    [],
  );

  const camera: CameraState = {
    position: [0.35 + drift(t * 0.18, 13) * 0.1, drift(t * 0.15, 41) * 0.16, 3.6],
    lookAt: [0.35, 0, 0],
    fov: 46,
    roll: drift(t * 0.1, 77) * 0.8,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#01050e" }} />;

  // A slow continuous spin plus a gentle vertical crawl.
  const spin: [number, number, number] = [0, t * 0.5, upright];
  // The strand stands upright, so the tiles run along Y and spacing has to
  // follow the rendered scale. Both strands are scaled so a single tile more
  // than covers the visible band at its own depth, and the run does not scroll,
  // which keeps every join comfortably outside frame — the strand reads as one
  // unbroken helix with nothing overlapping on screen.
  const heroTiles = helixTiles(3, HERO_SCALE, 0);
  const backTiles = helixTiles(3, BACK_SCALE, 0);

  return (
    <AbsoluteFill style={{ backgroundColor: "#01050e" }}>
      {/* Volumetric haze behind the strand. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 34% 62% at 62% 18%, rgba(24,74,140,0.55) 0%, rgba(6,20,44,0.25) 45%, rgba(1,5,14,0) 75%)",
        }}
      />

      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          env={{ top: "#1d4f86", middle: "#08182e", bottom: "#01050e", intensity: 1.4 }}
          clearColor="#000000"
          clearAlpha={0}
          toneMappingExposure={1.05}
          glow={{ blur: 22, opacity: 0.45, scale: 0.3, saturate: 1.3 }}
        >
          <ambientLight intensity={0.25} color="#2a5c96" />
          <directionalLight position={[2, 8, 4]} intensity={2.4} color="#8fd0ff" />
          <directionalLight position={[-4, -3, 2]} intensity={0.5} color="#12325c" />
          <pointLight position={[1.6, 3.2, 1.5]} intensity={22} color="#59b6ff" distance={9} />

          {/* Two repeats stacked end to end so the strand runs past the top
              and bottom of frame, as it does in the reference. Each is drawn
              as a solid body, an additive rim shell and a sparkle cloud over
              the same untouched geometry. */}
          {heroTiles.map((offset, i) => (
            <React.Fragment key={i}>
              <Solid
                geometry={geo.dna}
                material={body}
                position={[1.3, offset, 0]}
                rotation={spin}
                scale={HERO_SCALE}
              />
              <Solid
                geometry={geo.dna}
                material={rim}
                position={[1.3, offset, 0]}
                rotation={spin}
                scale={HERO_SCALE * 1.004}
              />
              <SurfacePoints
                geometry={geo.dna}
                count={7000}
                seed={202 + i}
                size={2.1}
                colorA="#7fd4ff"
                colorB="#ffffff"
                opacity={0.9}
                time={t}
                twinkle={0.85}
                jitter={0.004}
                position={[1.3, offset, 0]}
                rotation={spin}
                scale={HERO_SCALE * 1.008}
              />
            </React.Fragment>
          ))}

          {/* A second, far dimmer strand behind, as in the reference. */}
          {backTiles.map((offset, i) => (
            <Solid
              key={`back-${i}`}
              geometry={geo.dna}
              material={rim}
              position={[-1.4, offset, -3.6]}
              rotation={[0, t * 0.4 + 1.9, upright]}
              scale={BACK_SCALE}
            />
          ))}

          <Dust
            count={220}
            seed={303}
            bounds={[5, 3.5, 3]}
            size={16}
            colorA="#4f9ede"
            colorB="#dceeff"
            opacity={0.5}
            time={t}
            speed={0.22}
          />
        </Stage>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 74% at 55% 45%, rgba(0,0,0,0) 45%, rgba(1,3,10,0.88) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
