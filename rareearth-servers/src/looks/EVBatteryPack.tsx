import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { bySymbol } from "../data/elements";
import { EVBatteryRow } from "../data/versions";
import { studioEnv } from "../engine/env";
import { PostSettings } from "../engine/Post";
import { CameraPose, Stage } from "../engine/Stage";
import { Nugget, NuggetSpec, OreChips } from "../kit/ore";
import { Tile } from "../kit/tile";
import { clamp01, TAU } from "../lib/random";

const DURATION = 300;
export const TRAY_L = 2.2;
export const TRAY_W = 1.2;
const RIM_H = 0.13;
const FLOOR_Y = 0.035;
const COLS = 6;
const ROWS = 4;
const END_ZONE = 0.36; // junction-box end
const INSET = 0.07;
const BAY_X0 = -TRAY_L / 2 + END_ZONE;
const BAY_X1 = TRAY_L / 2 - INSET;
const BAY_Z0 = -TRAY_W / 2 + INSET;
const BAY_Z1 = TRAY_W / 2 - INSET;
const BAY_DX = (BAY_X1 - BAY_X0) / COLS;
const BAY_DZ = (BAY_Z1 - BAY_Z0) / ROWS;
export const bayCenter = (c: number, r: number): [number, number] => [
  BAY_X0 + (c + 0.5) * BAY_DX,
  BAY_Z0 + (r + 0.5) * BAY_DZ,
];

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function ringShape(w: number, h: number, r: number, t: number) {
  const s = roundedRect(w, h, r);
  s.holes.push(roundedRect(w - 2 * t, h - 2 * t, Math.max(0.01, r - t)) as unknown as THREE.Path);
  return s;
}

const extrudeUp = (shape: THREE.Shape, depth: number, bevel: number) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2);
  return g;
};

export const BatteryPack: React.FC = () => {
  const geos = useMemo(() => {
    const base = extrudeUp(roundedRect(TRAY_L, TRAY_W, 0.12), FLOOR_Y, 0.008);
    const rim = extrudeUp(ringShape(TRAY_L, TRAY_W, 0.12, INSET), RIM_H - 0.012, 0.012);
    return { base, rim };
  }, []);
  const graphite = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#3a3f48", metalness: 0.7, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    [],
  );
  const inner = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2a2e36", metalness: 0.7, roughness: 0.35 }),
    [],
  );
  const wall = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#59616b", metalness: 0.8, roughness: 0.4 }),
    [],
  );
  const cable = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#ff6a12", roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    [],
  );
  // HV cables leave the junction box through glands and run along the end
  // wall into the busbar that feeds the module rows
  const cables = useMemo(() => {
    const x0 = -TRAY_L / 2 + 0.18;
    const mk = (pts: [number, number, number][]) =>
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 64, 0.016, 10);
    return [
      mk([[x0 + 0.1, 0.16, -0.16], [x0 + 0.15, 0.12, -0.2], [BAY_X0 - 0.03, 0.075, -0.3], [BAY_X0 - 0.03, 0.065, -0.47]]),
      mk([[x0 + 0.1, 0.16, 0.16], [x0 + 0.15, 0.12, 0.2], [BAY_X0 - 0.03, 0.075, 0.3], [BAY_X0 - 0.03, 0.065, 0.47]]),
      mk([[x0 - 0.1, 0.15, 0.0], [x0 - 0.13, 0.1, 0.0], [x0 - 0.13, 0.07, 0.25], [x0 - 0.06, 0.06, 0.5]]),
    ];
  }, []);
  const ribGeo = useMemo(() => new RoundedBoxGeometry(0.026, RIM_H * 0.72, 0.016, 2, 0.004), []);
  const ribs = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = [];
    for (let x = -TRAY_L / 2 + 0.22; x <= TRAY_L / 2 - 0.2; x += 0.13) {
      out.push({ p: [x, RIM_H * 0.5, TRAY_W / 2 + 0.006], r: 0 });
      out.push({ p: [x, RIM_H * 0.5, -TRAY_W / 2 - 0.006], r: 0 });
    }
    for (let z = -TRAY_W / 2 + 0.2; z <= TRAY_W / 2 - 0.19; z += 0.13) {
      out.push({ p: [TRAY_L / 2 + 0.006, RIM_H * 0.5, z], r: Math.PI / 2 });
      out.push({ p: [-TRAY_L / 2 - 0.006, RIM_H * 0.5, z], r: Math.PI / 2 });
    }
    return out;
  }, []);
  const bolts = useMemo(() => {
    const out: [number, number, number][] = [];
    const y = RIM_H + 0.012;
    for (let x = -TRAY_L / 2 + 0.16; x <= TRAY_L / 2 - 0.15; x += 0.19) {
      out.push([x, y, TRAY_W / 2 - INSET / 2]);
      out.push([x, y, -TRAY_W / 2 + INSET / 2]);
    }
    for (let z = -TRAY_W / 2 + 0.2; z <= TRAY_W / 2 - 0.19; z += 0.2) {
      out.push([TRAY_L / 2 - INSET / 2, y, z]);
      out.push([-TRAY_L / 2 + INSET / 2, y, z]);
    }
    return out;
  }, []);
  const boltMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#9aa3ad", metalness: 1, roughness: 0.3 }),
    [],
  );
  // bay walls
  const walls: React.ReactNode[] = [];
  for (let c = 0; c <= COLS; c++) {
    const x = BAY_X0 + c * BAY_DX;
    walls.push(
      <mesh key={`c${c}`} position={[x, FLOOR_Y + 0.025, (BAY_Z0 + BAY_Z1) / 2]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[0.012, 0.05, BAY_Z1 - BAY_Z0]} />
      </mesh>,
    );
  }
  for (let r = 0; r <= ROWS; r++) {
    const z = BAY_Z0 + r * BAY_DZ;
    walls.push(
      <mesh key={`r${r}`} position={[(BAY_X0 + BAY_X1) / 2, FLOOR_Y + 0.025, z]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[BAY_X1 - BAY_X0, 0.05, 0.012]} />
      </mesh>,
    );
  }
  return (
    <group>
      <mesh geometry={geos.base} material={graphite} castShadow receiveShadow />
      <mesh geometry={geos.rim} material={graphite} position={[0, 0.012, 0]} castShadow receiveShadow />
      {ribs.map((r, i) => (
        <mesh key={i} geometry={ribGeo} material={graphite} position={r.p} rotation={[0, r.r, 0]} castShadow receiveShadow />
      ))}
      {bolts.map((b, i) => (
        <mesh key={`b${i}`} position={b} material={boltMat} castShadow>
          <cylinderGeometry args={[0.011, 0.011, 0.008, 12]} />
        </mesh>
      ))}
      {/* busbar along the end of the module rows */}
      <mesh position={[BAY_X0 - 0.03, FLOOR_Y + 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.03, 0.02, BAY_Z1 - BAY_Z0]} />
        <meshStandardMaterial color="#b87a4b" metalness={1} roughness={0.35} />
      </mesh>
      {[-0.16, 0.16].map((z) => (
        <mesh key={`g${z}`} position={[-TRAY_L / 2 + 0.28, 0.16, z]} rotation={[0, 0, Math.PI / 2]} material={boltMat}>
          <cylinderGeometry args={[0.026, 0.026, 0.03, 16]} />
        </mesh>
      ))}
      {[-0.12, 0, 0.12].map((z) => (
        <mesh key={`c${z}`} position={[-TRAY_L / 2 + 0.18, 0.186, z * 0.8]} material={boltMat} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.012, 16]} />
        </mesh>
      ))}
      <mesh position={[0, FLOOR_Y + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} material={inner} receiveShadow>
        <planeGeometry args={[TRAY_L - 2 * INSET, TRAY_W - 2 * INSET]} />
      </mesh>
      {walls}
      {/* junction box */}
      <mesh position={[-TRAY_L / 2 + 0.18, 0.12, 0]} castShadow receiveShadow>
        <primitive object={new RoundedBoxGeometry(0.16, 0.1, 0.38, 3, 0.018)} attach="geometry" />
        <meshPhysicalMaterial color="#1e2328" metalness={0.6} roughness={0.35} clearcoat={0.4} />
      </mesh>
      <mesh position={[-TRAY_L / 2 + 0.18, 0.177, 0]} castShadow>
        <boxGeometry args={[0.12, 0.012, 0.3]} />
        <meshStandardMaterial color="#3d444c" metalness={0.8} roughness={0.3} />
      </mesh>
      {cables.map((g, i) => (
        <mesh key={i} geometry={g} material={cable} castShadow receiveShadow />
      ))}
    </group>
  );
};

// ---------- modules ----------
// Drop order: a diagonal wave from the junction-box corner.
const ORDER: { c: number; r: number }[] = (() => {
  const cells: { c: number; r: number }[] = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) cells.push({ c, r });
  return cells.sort((a, b) => a.c + a.r - (b.c + b.r) || a.r - b.r);
})();

const DROP_START = 30; // 1 s
const DROP_END = 180; // 6 s
const DROP_DUR = 20;
const STEP = (DROP_END - DROP_START - DROP_DUR) / (ORDER.length - 1);
const HANG_H = 0.95;

/** Module height above its bay and how lit it is, from the frame alone. */
export function moduleState(i: number, frame: number) {
  const start = DROP_START + i * STEP;
  const preHang = i < 4; // a few hang in the air from the first frame
  const appear = preHang ? 1 : clamp01((frame - (start - 14)) / 12);
  const u = clamp01((frame - start) / DROP_DUR);
  let y = HANG_H * (1 - Easing.in(Easing.quad)(u));
  if (frame < start) y = HANG_H + 0.02 * Math.sin((TAU * (frame + i * 7)) / 60);
  // tiny settle bounce after landing
  const since = frame - (start + DROP_DUR);
  if (since > 0) y = 0.022 * Math.exp(-since / 4) * Math.abs(Math.sin((since / 9) * Math.PI));
  const lit = clamp01((frame - (start + DROP_DUR - 3)) / 10);
  return { y, appear, lit };
}

// Module face: rows of cylindrical cells seen through the glass, with tab
// strips and a busbar, emissive so the cell structure glows from inside.
let modTex: THREE.Texture | null = null;
function moduleTexture() {
  if (modTex) return modTex;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8fb4f0";
  g.fillRect(0, 0, S, S);
  const n = 4;
  const cell = (S - 40) / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const cx = 20 + (x + 0.5) * cell;
      const cy = 20 + (y + 0.5) * cell;
      const grd = g.createRadialGradient(cx, cy, 2, cx, cy, cell * 0.44);
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(0.6, "#f2f8ff");
      grd.addColorStop(1, "#e2eeff");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, cell * 0.42, 0, Math.PI * 2);
      g.fill();
    }
  g.fillStyle = "rgba(200,220,255,0.4)";
  for (let y = 0; y < n; y++) g.fillRect(14, 20 + (y + 0.5) * cell - 4, S - 28, 8);
  g.strokeStyle = "#0e1a30";
  g.lineWidth = 10;
  g.strokeRect(5, 5, S - 10, S - 10);
  modTex = new THREE.CanvasTexture(c);
  modTex.colorSpace = THREE.SRGBColorSpace;
  modTex.generateMipmaps = true;
  modTex.minFilter = THREE.LinearMipmapLinearFilter;
  modTex.anisotropy = 8;
  modTex.needsUpdate = true;
  return modTex;
}

export const Modules: React.FC<{ color: string; frame: number }> = ({ color, frame }) => {
  const geo = useMemo(() => new RoundedBoxGeometry(BAY_DX - 0.035, 0.1, BAY_DZ - 0.035, 3, 0.012), []);
  const mats = useMemo(
    () =>
      ORDER.map(
        (_, i) =>
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#1a4fd0").lerp(new THREE.Color("#30d8ff"), ((i * 53) % 13) / 13),
            emissive: new THREE.Color("#1a4fd0").lerp(new THREE.Color("#30d8ff"), ((i * 53) % 13) / 13),
            emissiveMap: moduleTexture(),
            emissiveIntensity: 0.3,
            roughness: 0.12,
            metalness: 0,
            transmission: 0.4,
            thickness: 0.15,
            ior: 1.45,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            transparent: true,
          }),
      ),
    [color],
  );
  return (
    <>
      {ORDER.map((cell, i) => {
        const s = moduleState(i, frame);
        const [x, z] = bayCenter(cell.c, cell.r);
        const m = mats[i];
        const tall = (cell.c * 7 + cell.r * 3) % 3 === 0 ? 1.6 : (cell.c + cell.r) % 2 ? 1.25 : 1;
        const pulse = 1 + 0.12 * Math.sin((TAU * (frame + i * 9)) / 75) * clamp01((frame - 220) / 20);
        m.emissiveIntensity = (0.3 + 1.25 * s.lit) * pulse * (0.75 + 0.5 * ((i * 37) % 11) / 10);
        m.opacity = s.appear;
        m.visible = s.appear > 0.001;
        return (
          <mesh
            key={i}
            geometry={geo}
            material={m}
            position={[x, FLOOR_Y + 0.05 * tall + 0.003 + s.y, z]}
            scale={[1, tall, 1]}
            castShadow
            receiveShadow
          />
        );
      })}
    </>
  );
};

// ---------- scene ----------
const NUGGETS: NuggetSpec[] = [
  { seed: 101, position: [1.85, 0.12, 0.05], scale: 0.21, rotY: 0.3, squash: [1.4, 0.65, 0.95] },
  { seed: 113, position: [0.45, 0.11, 1.25], scale: 0.19, rotY: 1.2, squash: [1.45, 0.62, 0.9] },
  { seed: 127, position: [-1.2, 0.13, 1.0], scale: 0.24, rotY: 2.0, squash: [1.3, 0.75, 1.0] },
  { seed: 131, position: [-1.95, 0.12, -0.25], scale: 0.2, rotY: 2.8, squash: [1.2, 0.8, 1.0] },
  { seed: 149, position: [1.35, 0.14, -1.2], scale: 0.27, rotY: 3.6, squash: [1.4, 0.68, 1.0] },
  { seed: 157, position: [-1.7, 0.13, -1.25], scale: 0.25, rotY: 4.4, squash: [1.35, 0.7, 0.95] },
];

const POST: PostSettings = {
  focus: 4.2,
  focusRange: 0.7,
  nearRamp: 1.6,
  farRamp: 2.4,
  maxBlur: 0.007,
  aoStrength: 0.6,
  aoRadius: 0.12,
  bloomStrength: 0.55,
  bloomThreshold: 1.3,
  bloomRadius: 0.55,
  exposure: 1.0,
  vignette: 0.18,
  grain: 0.015,
  period: DURATION,
  contrast: 1.0,
  saturation: 1.0,
};

const Lighting: React.FC<{ module: string }> = ({ module }) => {
  const { gl, scene } = useThree();
  const env = useMemo(
    () =>
      studioEnv(gl, "white", "#c9d1de", 0.55, [
        { position: [0, 9, 2], size: [8, 6], color: "#ffffff", intensity: 3.2 },
        { position: [-8, 4, 4], size: [3, 6], color: "#f4f7ff", intensity: 2.4 },
        { position: [8, 3, -3], size: [3, 6], color: "#bcd0ff", intensity: 2.0 },
        { position: [3, 2, 8], size: [2, 2], color: "#ffffff", intensity: 5 },
      ]),
    [gl],
  );
  useLayoutEffect(() => {
    scene.userData.env = env;
  }, [scene, env]);
  return (
    <>
      <directionalLight
        position={[3.5, 6, -1.5]}
        intensity={2.2}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-radius={8}
        shadow-bias={-0.0005}
      />
      <hemisphereLight args={["#ffffff", "#aeb9cc", 0.25]} />
      <pointLight position={[0, 0.55, -0.6]} color="#ff8a2a" intensity={0.8} distance={1.6} decay={2} />
      
    </>
  );
};

export const EVBatteryPack: React.FC<{ row: EVBatteryRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  // slow push in for the whole story, plus a gentle drift
  const push = interpolate(frame, [0, DURATION], [0, 1], { easing: Easing.inOut(Easing.sin) });
  const dist = 4.15 - 0.3 * push;
  const az = 0.62 + 0.06 * push;
  const elev = (35 * Math.PI) / 180;
  const camera: CameraPose = {
    position: [dist * Math.cos(elev) * Math.sin(az), dist * Math.sin(elev), dist * Math.cos(elev) * Math.cos(az)],
    target: [-0.05, 0.05, 0.1],
    fov: 32,
  };
  const TILE_SIZE = 0.3;
  return (
    <Stage camera={camera} post={{ ...POST, focus: dist - 0.35 }} background="#c9ccdb">
      <Lighting module={row.module} />
      <fog attach="fog" args={["#c9ccdb", 10, 22]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshPhysicalMaterial color="#cdd1e2" roughness={0.55} sheen={0.4} sheenRoughness={0.6} sheenColor="#ffffff" />
      </mesh>
      <group position={[0, 0.06, 0]} rotation={[0, 0.0, 0]}>
        {/* the tray stands on low feet so it reads as a separate object */}
        <BatteryPack />
        <Modules color={row.module} frame={frame} />
        {row.tiles.map((sym, i) => {
          const start = 150 + i * 11;
          const u = clamp01((frame - start) / 30);
          const e = Easing.out(Easing.cubic)(u);
          const flash = Math.exp(-Math.pow((frame - start - 18) / 8, 2));
          const x = BAY_X0 + 0.12 + i * ((BAY_X1 - BAY_X0 - 0.24) / (row.tiles.length - 1));
          const y = RIM_H + 0.02 + TILE_SIZE * 0.5 + 0.03 * e;
          return (
            <Tile
              key={sym}
              el={bySymbol(sym)}
              color={row.tile}
              size={TILE_SIZE}
              intensity={6.5 + 3 * flash}
              shimmer={((frame / 150 + i * 0.2) % 1) * 3.2 - 1.1}
              opacity={e}
              fill={0.16}
              over
              position={[x, y - 0.12 * (1 - e), -TRAY_W / 2 + INSET * 0.5]}
              rotation={[0, 0, 0]}
            />
          );
        })}
      </group>
      {NUGGETS.map((n) => (
        <Nugget key={n.seed} spec={n} kind="silver" envIntensity={1.3} />
      ))}
      <OreChips
        kind="silver"
        envIntensity={1.3}
        scatter={{
          seed: 9191,
          count: 20,
          center: [0.7, 1.15],
          rMin: 0.2,
          rMax: 0.95,
          sizeMin: 0.02,
          sizeMax: 0.05,
          avoid: [
            ...NUGGETS.map((n) => ({ x: n.position[0], z: n.position[2], r: n.scale * 1.3 })),
            { x: 0, z: 0, r: 1.25 },
          ],
        }}
      />
    </Stage>
  );
};
