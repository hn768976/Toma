import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ChipOnOreRow } from "../data/versions";
import { studioEnv } from "../engine/env";
import { PostSettings } from "../engine/Post";
import { CameraPose, Stage } from "../engine/Stage";
import { SoftReflection } from "../kit/floor";
import { flowMaterial, mergeLines, ribbonLine } from "../kit/flow";
import { Nugget, NuggetSpec, OreChips } from "../kit/ore";
import { GlowDecal } from "../kit/tile";
import { mulberry32, TAU } from "../lib/random";

const LOOP = 600;
const CHIP = 1.0; // package edge length
const CHIP_T = 0.035;
const CHIP_ROT = 0.5;

// ---------- chip ----------
const padTexCache = new Map<string, { map: THREE.Texture; emissive: THREE.Texture }>();
function padTextures(glow: string) {
  const hit = padTexCache.get(glow);
  if (hit) return hit;
  const S = 2048;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    return c;
  };
  const base = mk();
  const em = mk();
  const b = base.getContext("2d")!;
  const e = em.getContext("2d")!;
  b.fillStyle = "#0c1a1f";
  b.fillRect(0, 0, S, S);
  // substrate: faint fibre-glass mottling and routing under the solder mask
  const sr = mulberry32(73);
  for (let i = 0; i < 2600; i++) {
    b.fillStyle = `rgba(${40 + sr() * 40},${70 + sr() * 50},${70 + sr() * 40},0.05)`;
    b.fillRect(sr() * S, sr() * S, 6 + sr() * 30, 2 + sr() * 4);
  }
  e.fillStyle = "#000";
  e.fillRect(0, 0, S, S);
  const N = 40;
  const m = S * 0.05;
  const cell = (S - 2 * m) / N;
  const pad = cell * 0.56;
  const core0 = 16;
  const core1 = 24;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const inCore = x >= core0 && x < core1 && y >= core0 && y < core1;
      if (inCore) continue;
      const px = m + x * cell + (cell - pad) / 2;
      const py = m + y * cell + (cell - pad) / 2;
      b.fillStyle = "#b89a62";
      b.fillRect(px, py, pad, pad);
      b.fillStyle = "#e4cf9c";
      b.fillRect(px, py, pad, pad * 0.25);
      e.fillStyle = "#ffffff";
      e.fillRect(px, py, pad, pad);
    }
  // dark centre field with a faint outline, and a thin glowing border
  b.fillStyle = "#1a2638";
  b.fillRect(m + core0 * cell, m + core0 * cell, (core1 - core0) * cell, (core1 - core0) * cell);
  e.strokeStyle = "rgba(255,255,255,0.35)";
  e.lineWidth = cell * 0.18;
  e.strokeRect(m + core0 * cell, m + core0 * cell, (core1 - core0) * cell, (core1 - core0) * cell);
  e.strokeStyle = "rgba(255,255,255,0.9)";
  e.lineWidth = S * 0.006;
  e.strokeRect(S * 0.012, S * 0.012, S * 0.976, S * 0.976);
  const toTex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 16;
    t.needsUpdate = true;
    return t;
  };
  const out = { map: toTex(base, true), emissive: toTex(em, true) };
  padTexCache.set(glow, out);
  return out;
}

export const Chip: React.FC<{ glow: string; emissive: number; position?: [number, number, number]; rotY?: number }> = ({
  glow,
  emissive,
  position = [0, 0, 0],
  rotY = 0,
}) => {
  const geo = useMemo(() => new RoundedBoxGeometry(CHIP, CHIP_T, CHIP, 3, 0.012), []);
  const tex = padTextures(glow);
  const glowCol = useMemo(() => new THREE.Color(glow), [glow]);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={geo} position={[0, CHIP_T / 2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#0d1626" roughness={0.38} metalness={0.4} clearcoat={0.6} clearcoatRoughness={0.2} />
      </mesh>
      <mesh position={[0, CHIP_T + 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CHIP * 0.985, CHIP * 0.985]} />
        <meshStandardMaterial
          map={tex.map}
          emissiveMap={tex.emissive}
          emissive={glowCol}
          emissiveIntensity={emissive}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
    </group>
  );
};

// ---------- traces ----------
const traceRnd = mulberry32(2253118973);
const PERIODS = [100, 120, 150, 200, 300];
type Trace = { pts: THREE.Vector3[]; end: THREE.Vector3 };
const TRACES: Trace[] = (() => {
  const out: Trace[] = [];
  const half = CHIP / 2;
  const sides = [
    { out: new THREE.Vector3(1, 0, 0), along: new THREE.Vector3(0, 0, 1) },
    { out: new THREE.Vector3(-1, 0, 0), along: new THREE.Vector3(0, 0, 1) },
    { out: new THREE.Vector3(0, 0, 1), along: new THREE.Vector3(1, 0, 0) },
    { out: new THREE.Vector3(0, 0, -1), along: new THREE.Vector3(1, 0, 0) },
  ];
  const rot = new THREE.Matrix4().makeRotationY(CHIP_ROT);
  sides.forEach((sd) => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const o = ((i + 0.5) / n - 0.5) * CHIP * 0.86;
      const p0 = sd.out.clone().multiplyScalar(half + 0.02).addScaledVector(sd.along, o);
      const d1 = 0.06 + traceRnd() * 0.2;
      const p1 = p0.clone().addScaledVector(sd.out, d1);
      const turn = (traceRnd() < 0.5 ? -1 : 1) * Math.sign(o || 1);
      const d2 = traceRnd() < 0.3 ? 0 : 0.06 + traceRnd() * 0.2;
      const p2 = p1.clone().addScaledVector(sd.along, turn * d2);
      const d3 = 0.05 + traceRnd() * 0.22;
      const p3 = p2.clone().addScaledVector(sd.out, d3);
      const pts = [p0, p1, p2, p3].map((p) => p.setY(0.0025).applyMatrix4(rot));
      // densify so the ribbon has clean right-angle corners
      const dense: THREE.Vector3[] = [];
      for (let k = 0; k < pts.length - 1; k++) {
        const seg = pts[k].distanceTo(pts[k + 1]);
        const steps = Math.max(1, Math.ceil(seg / 0.05));
        for (let j = 0; j < steps; j++) dense.push(pts[k].clone().lerp(pts[k + 1], j / steps));
      }
      dense.push(pts[3].clone());
      out.push({ pts: dense, end: pts[3].clone() });
    }
  });
  return out;
})();
const TRACE_ATTRS = TRACES.map(() => ({
  period: PERIODS[Math.floor(traceRnd() * PERIODS.length)],
  phase: traceRnd(),
  bright: 0.6 + traceRnd() * 0.5,
}));

const Traces: React.FC<{ color: string; frame: number }> = ({ color, frame }) => {
  const geo = useMemo(
    () =>
      mergeLines(TRACES.map((t, i) => ribbonLine(t.pts, 0.009, new THREE.Vector3(0, 1, 0), TRACE_ATTRS[i]))),
    [],
  );
  const mat = useMemo(
    () => flowMaterial({ color, headColor: "#e8f6ff", base: 0.55, pulse: 5, seg: 0.2, fadeOut: 0.45 }),
    [color],
  );
  mat.uniforms.frame.value = frame;
  const vias = useMemo(() => new THREE.RingGeometry(0.012, 0.022, 20), []);
  const viaCol = useMemo(() => new THREE.Color(color).multiplyScalar(0.5), [color]);
  return (
    <>
      <mesh geometry={geo} material={mat} renderOrder={4} />
      {TRACES.map((t, i) => (
        <mesh key={i} geometry={vias} position={[t.end.x, 0.003, t.end.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <meshBasicMaterial color={viaCol} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
};

// ---------- scene ----------
const NUGGETS: NuggetSpec[] = [
  { seed: 51, position: [0.0, 0.24, -0.78], scale: 0.42, rotY: 0.8, squash: [1.35, 0.66, 1.0], parts: 14 },
  { seed: 63, position: [-0.98, 0.2, 0.3], scale: 0.38, rotY: 2.2, squash: [1.3, 0.64, 1.05], parts: 14 },
  { seed: 77, position: [0.92, 0.2, 0.22], scale: 0.38, rotY: 4.0, squash: [1.3, 0.66, 1.0], parts: 14 },
];

const POST: PostSettings = {
  focus: 3.85,
  focusRange: 0.35,
  nearRamp: 1.0,
  farRamp: 1.6,
  maxBlur: 0.012,
  aoStrength: 0.55,
  aoRadius: 0.1,
  bloomStrength: 0.65,
  bloomThreshold: 1.1,
  bloomRadius: 0.55,
  exposure: 1.0,
  vignette: 0.6,
  grain: 0.015,
  period: LOOP,
  contrast: 0.97,
  saturation: 1.05,
  lift: [0.004, 0.012, 0.035],
};

const Lighting: React.FC<{ frame: number; glow: string }> = ({ frame, glow }) => {
  const { gl, scene } = useThree();
  const env = useMemo(
    () =>
      studioEnv(gl, "chip", "#121826", 0.5, [
        { position: [0, 10, 1], size: [6, 3], color: "#ffffff", intensity: 2.5 },
        { position: [6, 1.5, 6], size: [3, 1.2], color: "#cfe6ff", intensity: 2.2 },
        { position: [-6, 1.5, 6], size: [3, 1.2], color: "#ffd6f0", intensity: 2.2 },
        { position: [8, 1.2, -2], size: [3, 1.2], color: "#fff0d8", intensity: 2.2 },
        { position: [-8, 1.2, -2], size: [3, 1.2], color: "#d8e0ff", intensity: 2.2 },
        { position: [0, 8, -7], size: [9, 4], color: "#ffd9a8", intensity: 4 },
        { position: [4, 6, -5], size: [2, 2], color: "#ffcf9a", intensity: 6 },
        { position: [-5, 5, -4], size: [2, 2], color: "#ffe2c0", intensity: 5 },
        { position: [0, 1, 8], size: [10, 1.5], color: glow, intensity: 0.6 },
        { position: [-7, 2, 2], size: [2, 4], color: "#b9a0ff", intensity: 0.6 },
      ]),
    [gl, glow],
  );
  useLayoutEffect(() => {
    scene.userData.env = env;
  }, [scene, env]);
  scene.environmentRotation.set(0, 0.25 * Math.sin((TAU * frame) / LOOP), 0);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.1, 0);
    return o;
  }, []);
  return (
    <>
      <primitive object={target} />
      <spotLight
        position={[0.4, 3.6, -3.4]}
        target={target}
        color="#ffd8a6"
        intensity={16}
        angle={0.4}
        penumbra={0.9}
        decay={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      <pointLight position={[0, 0.3, 0]} color={glow} intensity={1.2} distance={1.8} decay={2} />
    </>
  );
};

export const ChipOnOre: React.FC<{ row: ChipOnOreRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const t = (TAU * frame) / LOOP;
  const az = (12 * Math.PI) / 180 * Math.sin(t);
  const elev = (25 * Math.PI) / 180 + 0.02 * Math.sin(2 * t);
  const dist = 3.9;
  const camera: CameraPose = {
    position: [dist * Math.cos(elev) * Math.sin(az), dist * Math.sin(elev), dist * Math.cos(elev) * Math.cos(az)],
    target: [0, 0.05, -0.1],
    fov: 30,
  };
  return (
    <Stage camera={camera} post={POST} background="#020305">
      <Lighting frame={frame} glow={row.glow} />
      {/* a soft cyan rim around the package so it reads as the light source */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, CHIP_ROT]} renderOrder={3}>
        <ringGeometry args={[0.5, 0.56, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color={new THREE.Color(row.glow).multiplyScalar(1.6)} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#03050a" roughness={0.7} metalness={0} envMapIntensity={0} />
      </mesh>
      <SoftReflection size={30} strength={0.35} blur={0.012} resolution={1024} fadeDist={5} />
      <GlowDecal color={row.glow} intensity={0.55} position={[0, 0.001, 0]} scale={[2.6, 2.6]} rotationY={CHIP_ROT} />
      <Chip glow={row.glow} emissive={2.4} rotY={CHIP_ROT} />
      <Traces color={row.glow} frame={frame} />
      {NUGGETS.map((n) => (
        <Nugget key={n.seed} spec={n} kind="iridescent" envIntensity={1.7} />
      ))}
      <OreChips
        kind="iridescent"
        envIntensity={2.2}
        scatter={{
          seed: 7373,
          count: 44,
          center: [0, 0.4],
          rMin: 0.55,
          rMax: 2.2,
          sizeMin: 0.035,
          sizeMax: 0.08,
          avoid: [
            ...NUGGETS.map((n) => ({ x: n.position[0], z: n.position[2], r: n.scale * 1.2 })),
            { x: 0, z: 0, r: 0.75 },
          ],
        }}
      />
    </Stage>
  );
};
