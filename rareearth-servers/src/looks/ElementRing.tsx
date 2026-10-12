import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { bySymbol } from "../data/elements";
import { ElementRingRow } from "../data/versions";
import { studioEnv } from "../engine/env";
import { PostSettings } from "../engine/Post";
import { CameraPose, Stage } from "../engine/Stage";
import { SoftReflection } from "../kit/floor";
import { Nugget, NuggetSpec, OreChips } from "../kit/ore";
import { GlowDecal, TILE_H, Tile } from "../kit/tile";
import { mulberry32, TAU } from "../lib/random";

const LOOP = 600;

// Module-level seeded layout: colour pattern and bob/shimmer phases.
const rnd = mulberry32(20253118983);
const COLOR_PATTERN = (() => {
  const a = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
})();
const PHASES = Array.from({ length: 12 }, () => rnd());
const SHIMMER = Array.from({ length: 12 }, () => rnd());

export const NUGGETS_RING: NuggetSpec[] = [
  { seed: 11, position: [0.05, 0.34, -0.62], scale: 0.62, rotY: 0.4, squash: [1.25, 0.74, 1.0], parts: 12 },
  { seed: 23, position: [-0.74, 0.31, 0.5], scale: 0.58, rotY: 1.9, squash: [1.2, 0.72, 1.05], parts: 12 },
  { seed: 37, position: [0.78, 0.31, 0.48], scale: 0.59, rotY: 3.1, squash: [1.2, 0.74, 1.0], parts: 12 },
];

const RING_R = 1.78; // ≈ 1.6 × the ore pile width / 2
const TILE_SIZE = 0.44;

const POST: PostSettings = {
  focus: 4.35,
  focusRange: 0.5,
  nearRamp: 1.2,
  farRamp: 2.2,
  maxBlur: 0.005,
  aoStrength: 0.55,
  aoRadius: 0.12,
  bloomStrength: 0.6,
  bloomThreshold: 1.1,
  bloomRadius: 0.55,
  exposure: 1.0,
  vignette: 0.55,
  grain: 0.015,
  period: LOOP,
  contrast: 0.97,
  saturation: 1.05,
  lift: [0, 0.004, 0.012],
};

const Lighting: React.FC<{ frame: number; row: ElementRingRow }> = ({ frame, row }) => {
  const { gl, scene } = useThree();
  const env = useMemo(
    () =>
      studioEnv(gl, "ring", "#141a26", 0.35, [
        { position: [-4, 4, 5], size: [2.5, 2.5], color: "#ff9ad8", intensity: 3.5 },
        { position: [4, 5, 4], size: [2.5, 2.5], color: "#a89aff", intensity: 3.5 },
        { position: [0, 9, -6], size: [8, 4], color: "#fff1dc", intensity: 4 },
        { position: [0, 10, 2], size: [6, 3], color: "#ffffff", intensity: 3 },
        { position: [6, 1.5, 6], size: [3, 1.2], color: "#cfe6ff", intensity: 2.2 },
        { position: [-6, 1.5, 6], size: [3, 1.2], color: "#ffd6f0", intensity: 2.2 },
        { position: [8, 1.2, -2], size: [3, 1.2], color: "#fff0d8", intensity: 2.2 },
        { position: [-8, 1.2, -2], size: [3, 1.2], color: "#d8e0ff", intensity: 2.2 },
        { position: [-7, 3, 3], size: [3, 6], color: row.colorA, intensity: 1.2 },
        { position: [7, 3, 3], size: [3, 6], color: row.colorB, intensity: 1.2 },
        { position: [0, 2, 9], size: [10, 1.2], color: "#c8d8ff", intensity: 0.7 },
        { position: [5, 7, -4], size: [2, 2], color: "#ffd2b0", intensity: 5 },
        { position: [-5, 6, -5], size: [2, 1.5], color: "#ffe6cc", intensity: 4 },
      ]),
    [gl, row.colorA, row.colorB],
  );
  const sweep = Math.sin((TAU * frame) / LOOP);
  useLayoutEffect(() => {
    scene.userData.env = env;
  }, [scene, env]);
  scene.environmentRotation.set(0, 0.55 * sweep, 0);
  const keyTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0.05, 0.85, -0.55);
    return o;
  }, []);
  return (
    <>
      <primitive object={keyTarget} />
      <spotLight
        position={[0.6 * sweep, 3.6, -3.4]}
        target={keyTarget}
        color="#fff4e6"
        intensity={80}
        angle={0.13}
        penumbra={0.9}
        decay={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-radius={6}
        shadow-camera-near={1}
        shadow-camera-far={12}
      />
      <directionalLight position={[-3, 2.5, 4]} intensity={0.12} color="#9fb8ff" />
    </>
  );
};

const Scene: React.FC<{ row: ElementRingRow }> = ({ row }) => {
  // wrapped, so frame 600 is exactly frame 0 (seamless loop)
  const frame = useCurrentFrame() % LOOP;
  const t = frame / LOOP;
  const ringRot = TAU * t; // exactly one turn per loop
  const colors = [row.colorA, row.colorB];
  return (
    <>
      <Lighting frame={frame} row={row} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#010205" roughness={0.9} metalness={0} envMapIntensity={0} />
      </mesh>
      <SoftReflection size={30} strength={0.16} blur={0.016} resolution={1024} fadeDist={5} />
      {/* broad ring-shaped floor glow under the tiles */}
      <GlowDecal color={row.floorGlow} intensity={0.22} position={[0, 0.002, 0]} scale={[RING_R * 3.0, RING_R * 3.0]} />
      <GlowDecal color={row.colorB} intensity={0.18} position={[0, 0.0015, 0]} scale={[RING_R * 3.6, RING_R * 3.6]} />
      {NUGGETS_RING.map((n) => (
        <Nugget key={n.seed} spec={n} kind="iridescent" envIntensity={1.7} />
      ))}
      <OreChips
        kind="iridescent"
        envIntensity={2.2}
        scatter={{
          seed: 4242,
          count: 38,
          center: [0, 0.35],
          rMin: 1.95,
          rMax: 2.7,
          sizeMin: 0.045,
          sizeMax: 0.085,
          avoid: NUGGETS_RING.map((n) => ({ x: n.position[0], z: n.position[2], r: n.scale * 1.15 })),
        }}
      />
      {row.elements.map((sym, i) => {
        const a = (i / row.elements.length) * TAU + ringRot;
        const x = RING_R * Math.sin(a);
        const z = RING_R * Math.cos(a);
        const bob = 0.015 * TILE_H * TILE_SIZE * Math.sin(TAU * (2 * t + PHASES[i]));
        const y = TILE_H * TILE_SIZE * 0.5 + 0.06 + bob;
        const color = colors[COLOR_PATTERN[i]];
        const shimmer = ((t * 3 + SHIMMER[i]) % 1) * 3.2 - 1.1;
        return (
          <group key={sym}>
            <Tile
              el={bySymbol(sym)}
              color={color}
              size={TILE_SIZE}
              intensity={4.2}
              shimmer={shimmer}
              fill={0.32}
              position={[x, y, z]}
              rotation={[0, a, 0]}
            />
            <pointLight position={[x * 0.97, y, z * 0.97]} color={color} intensity={0.25} distance={1.4} decay={2} />
            <GlowDecal
              color={color}
              intensity={0.12}
              position={[x, 0.003, z]}
              scale={[0.85, 0.85]}
            />
          </group>
        );
      })}
    </>
  );
};

export const ElementRing: React.FC<{ row: ElementRingRow }> = ({ row }) => {
  // wrapped, so frame 600 is exactly frame 0 (seamless loop)
  const frame = useCurrentFrame() % LOOP;
  const t = (TAU * frame) / LOOP;
  const dist = 5.9;
  const elev = (30 * Math.PI) / 180 + 0.015 * Math.sin(t);
  const az = 0.045 * Math.sin(t + 0.6);
  const camera: CameraPose = {
    position: [dist * Math.cos(elev) * Math.sin(az), dist * Math.sin(elev), dist * Math.cos(elev) * Math.cos(az)],
    target: [0, 0.38, 0.1],
    fov: 30,
  };
  return (
    <Stage camera={camera} post={POST} background="#020305">
      <Scene row={row} />
    </Stage>
  );
};
