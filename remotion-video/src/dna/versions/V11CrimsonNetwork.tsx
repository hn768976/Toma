import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage, type CameraState } from "../Stage";
import { Solid, SurfacePoints, Wire } from "../Primitives";
import { useModels } from "../useModels";
import { bandGlow, fresnelGlow } from "../materials";
import { useStage } from "../scene";
import { drift } from "../random";
import { MoleculeGlyphs, Plexus } from "../Plexus";
import "../hudFont";

/**
 * Reference: istockphoto-2245117899 — 18.0s.
 * The hottest plate of the set: a red horizontal helix burning across a deep
 * crimson field, over a plexus network, a technical grid and drifting skeletal
 * formula marks.
 */
export const V11CrimsonNetwork: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, resolutionScale } = useStage();
  const geo = useModels(["dna", "molecule"]);
  const t = frame / fps;

  const rim = useMemo(
    () =>
      fresnelGlow({
        colorA: "#8c1206",
        colorB: "#ff8a3a",
        power: 1.9,
        intensity: 1.35,
        core: 0.1,
        coreColor: "#c22a10",
        opacity: 1,
      }),
    [],
  );

  const pulse = useMemo(
    () =>
      bandGlow({
        color: "#ff9a3c",
        repeat: 0.46,
        width: 0.2,
        speed: 0.22,
        intensity: 0.95,
        fresnel: 1.1,
      }),
    [],
  );
  pulse.uniforms.uTime.value = t;

  const camera: CameraState = {
    position: [drift(t * 0.09, 313) * 0.14, drift(t * 0.08, 331) * 0.1, 3.5],
    lookAt: [0, 0, 0],
    fov: 44,
  };

  if (!geo) return <AbsoluteFill style={{ backgroundColor: "#200504" }} />;

  const crawl = ((t * 0.07) % 1) * 1.92;
  const repeats = [-1.92, 0, 1.92, 3.84];

  return (
    <AbsoluteFill style={{ backgroundColor: "#1b0403" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 62% at 48% 48%, rgba(140,22,10,0.85) 0%, rgba(70,10,6,0.6) 42%, rgba(23,4,3,1) 88%)",
        }}
      />

      {/* Technical grid. */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(255,120,70,0.09) ${Math.max(
            1,
            resolutionScale,
          )}px, transparent ${Math.max(1, resolutionScale)}px), linear-gradient(90deg, rgba(255,120,70,0.09) ${Math.max(
            1,
            resolutionScale,
          )}px, transparent ${Math.max(1, resolutionScale)}px)`,
          backgroundSize: `${48 * resolutionScale}px ${48 * resolutionScale}px`,
          transform: `translateX(${-(t * 6 * resolutionScale) % (48 * resolutionScale)}px)`,
        }}
      />

      <MoleculeGlyphs
        frame={frame}
        fps={fps}
        seed={1102}
        count={15}
        color="#ffd2b0"
        opacity={0.42}
        scale={resolutionScale}
      />

      <Plexus
        frame={frame}
        fps={fps}
        seed={1101}
        nodes={46}
        linkDistance={0.24}
        color="#ff8f5e"
        lineOpacity={0.26}
        dotOpacity={0.5}
        dotRadius={1.8}
        strokeWidth={1}
        speed={0.7}
        scale={resolutionScale}
      />

      {/* Defocused molecules drifting in the haze. */}
      <AbsoluteFill style={{ filter: `blur(${10 * resolutionScale}px)`, opacity: 0.4 }}>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
        >
          <ambientLight intensity={0.6} color="#c04020" />
          <directionalLight position={[3, 4, 5]} intensity={2} color="#ffb070" />
          <Solid
            geometry={geo.molecule}
            material={rim}
            position={[-2.4, 1.3, -3.2]}
            rotation={[t * 0.3, t * 0.4, 0]}
            scale={1.1}
          />
          <Solid
            geometry={geo.molecule}
            material={rim}
            position={[2.6, -1.2, -3.8]}
            rotation={[t * 0.25, t * 0.35 + 2, 0]}
            scale={0.95}
          />
        </Stage>
      </AbsoluteFill>

      {/* Hero helix. */}
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          resolutionScale={resolutionScale}
          camera={camera}
          clearAlpha={0}
          glow={{ blur: 28, opacity: 0.6, scale: 0.3, saturate: 1.45 }}
        >
          {repeats.map((offset, i) => {
            const pos: [number, number, number] = [offset - crawl, 0, 0];
            const rot: [number, number, number] = [t * 0.45, 0, 0];
            return (
              <React.Fragment key={i}>
                <Solid geometry={geo.dna} material={rim} position={pos} rotation={rot} />
                <Solid
                  geometry={geo.dna}
                  material={pulse}
                  position={pos}
                  rotation={rot}
                  scale={1.004}
                />
                <Wire
                  geometry={geo.dna}
                  color="#ffd0a0"
                  opacity={0.22}
                  thresholdAngle={38}
                  position={pos}
                  rotation={rot}
                  scale={1.006}
                />
                <SurfacePoints
                  geometry={geo.dna}
                  count={5000}
                  seed={1110 + i}
                  size={1.8}
                  colorA="#ff6a28"
                  colorB="#ffd49a"
                  opacity={0.8}
                  time={t}
                  twinkle={0.85}
                  position={pos}
                  rotation={rot}
                  scale={1.01}
                />
              </React.Fragment>
            );
          })}
        </Stage>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 82% 78% at 50% 50%, rgba(0,0,0,0) 46%, rgba(18,3,2,0.86) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
