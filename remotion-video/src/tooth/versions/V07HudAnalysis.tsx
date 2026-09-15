import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, DARK_STUDIO } from "../environment";
import { FloorReflection, GlowShell, Halo, SceneBackdrop, mulberry32 } from "../parts";
import { ScaledDom, Stage, saw, useLoop, usePxScale, wave } from "../stage";
import { useLatticeMaterial } from "../shaders/materials";

/**
 * Version 07 - "HUD Analysis".
 *
 * Dark glass tooth with glowing panel lines, standing on a reflective floor
 * between two columns of analysis readouts. The readouts are deliberately
 * abstract bars rather than type: they should read as an interface at a glance
 * without ever claiming to say anything.
 */

const FLOOR_Y = -1.25;

const Scene: React.FC = () => {
  const { t } = useLoop();
  const px = usePxScale();
  const { full } = useToothAssets();

  const lattice = useLatticeMaterial({
    toneMapped: false,
    uColor: "#84dcff",
    uScanColor: "#ffffff",
    uRings: 17,
    uSegments: 27,
    uThickness: 0.8,
    uOpacity: 0.8,
    uPx: px,
    uScanY: -99,
    uScanWidth: 0.1,
    uScanStrength: 0,
  });

  const spin = t * Math.PI * 2;
  const lift = 0.02 + wave(t, 1) * 0.02;

  return (
    <>
      <SceneBackdrop
        colors={["#102a52", "#0a1c3a", "#050f22", "#01050e"]}
        stops={[0, 0.3, 0.62, 1]}
        center={[0.5, 0.56]}
        radius={[1.05, 0.9]}
      />
      <StudioEnvironment spec={DARK_STUDIO} intensity={1.6} />
      <directionalLight position={[4, 4, 4]} intensity={1.1} color="#9fd8ff" />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color="#5f8cff" />

      <Halo color="#11447f" size={6} opacity={0.4} power={2.4} position={[0, 0.1, -2.4]} />
      <Halo color="#1a5fa8" size={2.6} squash={0.35} opacity={0.5} power={2} position={[0, FLOOR_Y + 0.02, -0.3]} />

      <group rotation-y={spin} position-y={lift}>
        <mesh geometry={full} scale={1.24}>
          <meshPhysicalMaterial
            color="#123e73"
            roughness={0.07}
            metalness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.04}
            iridescence={1}
            iridescenceIOR={1.8}
            iridescenceThicknessRange={[180, 760]}
            envMapIntensity={3.1}
          />
        </mesh>
        <mesh geometry={full} material={lattice} scale={1.248} />
        <GlowShell geometry={full} color="#2e9fe0" strength={0.85} power={3.2} scale={1.3} />
      </group>

      <FloorReflection
        geometry={full}
        floorY={FLOOR_Y}
        depth={1.15}
        color="#2d7fc4"
        shade="#08203c"
        opacity={0.24}
        rotationY={spin}
        offsetY={lift}
        scale={1.24}
      />
    </>
  );
};

/* -------------------------------------------------------------------------- */

type Block = { readonly rows: number[]; readonly top: number; readonly cycles: number };

const useBlocks = (seed: number, count: number, spread: number) =>
  useMemo(() => {
    const random = mulberry32(seed);
    const blocks: Block[] = [];
    let top = 60;
    for (let i = 0; i < count; i++) {
      const rows = Array.from(
        { length: 4 + Math.floor(random() * 8) },
        () => 0.25 + random() * 0.75,
      );
      blocks.push({ rows, top, cycles: 1 + Math.floor(random() * 3) });
      top += rows.length * 9 + 46 + random() * spread;
    }
    return blocks;
  }, [seed, count, spread]);

const HudColumn: React.FC<{
  readonly seed: number;
  readonly side: "left" | "right";
  readonly t: number;
}> = ({ seed, side, t }) => {
  const blocks = useBlocks(seed, 5, 40);
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        [side]: 96,
        width: 250,
        height: 1080,
      }}
    >
      {blocks.map((block, i) => {
        // A window of attention travelling down the block.
        const focus = saw(t, block.cycles, i * 0.17) * block.rows.length;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: block.top,
              [side === "left" ? "left" : "right"]: 0,
              width: 250,
              opacity: 0.3 + 0.32 * (0.5 + 0.5 * Math.cos((t * (i + 2) + i * 0.3) * Math.PI * 2)),
            }}
          >
            <div
              style={{
                height: 1,
                width: 250,
                background: "rgba(110,190,255,0.34)",
                marginBottom: 8,
              }}
            />
            {block.rows.map((width, r) => {
              const hot = Math.abs(r - focus) < 1.2;
              return (
                <div
                  key={r}
                  style={{
                    height: 3,
                    marginBottom: 6,
                    width: `${width * 100}%`,
                    marginLeft: side === "right" ? `${(1 - width) * 100}%` : 0,
                    background: hot
                      ? "rgba(185,230,255,0.8)"
                      : "rgba(95,170,235,0.3)",
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const Hud: React.FC = () => {
  const { t } = useLoop();
  return (
    <ScaledDom>
      <HudColumn seed={3} side="left" t={t} />
      <HudColumn seed={19} side="right" t={t} />
      {/* Corner brackets. */}
      {[
        { top: 54, left: 54, borderTop: 1, borderLeft: 1 },
        { top: 54, right: 54, borderTop: 1, borderRight: 1 },
        { bottom: 54, left: 54, borderBottom: 1, borderLeft: 1 },
        { bottom: 54, right: 54, borderBottom: 1, borderRight: 1 },
      ].map((corner, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 42,
            height: 42,
            borderStyle: "solid",
            borderColor: "rgba(120,195,255,0.55)",
            borderWidth: 0,
            ...corner,
          }}
        />
      ))}
    </ScaledDom>
  );
};

export const V07HudAnalysis: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#01050e" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.6]} toneMapping={THREE.ACESFilmicToneMapping} exposure={1.0}>
        <Scene />
      </Stage>
    </WithToothAssets>
    <Hud />
  </AbsoluteFill>
);
