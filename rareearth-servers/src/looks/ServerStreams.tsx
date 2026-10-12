import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ServerStreamsRow } from "../data/versions";
import { studioEnv } from "../engine/env";
import { PostSettings } from "../engine/Post";
import { CameraPose, Stage } from "../engine/Stage";
import { SoftReflection } from "../kit/floor";
import { flowMaterial, mergeLines, tubeLine } from "../kit/flow";
import { GlowDecal } from "../kit/tile";
import { hash2, mulberry32, TAU } from "../lib/random";

const LOOP = 600;
const RW = 0.6;
const RH = 1.9;
const RD = 1.0;
const UNITS = 16;
const U0 = 0.14; // bottom of the unit stack
const UH = 0.1; // unit height
const FACE_W = 0.5;

// ---------- rack front face (static texture) ----------
type UnitKind = "vent" | "drives" | "blank" | "switch";
const rackRnd = mulberry32(2293641004);
const UNIT_KINDS: UnitKind[] = Array.from({ length: UNITS }, (_, i) =>
  i === 0 ? "vent" : (["vent", "drives", "drives", "switch", "blank"] as UnitKind[])[Math.floor(rackRnd() * 5)],
);

let faceTex: THREE.Texture | null = null;
function rackFaceTexture() {
  if (faceTex) return faceTex;
  const PX = 1024 / FACE_W; // px per metre
  const w = 1024;
  const h = Math.round(UNITS * UH * PX);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0c1626";
  g.fillRect(0, 0, w, h);
  const uh = h / UNITS;
  UNIT_KINDS.forEach((k, i) => {
    const y = h - (i + 1) * uh;
    // panel
    const grad = g.createLinearGradient(0, y, 0, y + uh);
    grad.addColorStop(0, "#5a6f93");
    grad.addColorStop(0.1, "#3e5072");
    grad.addColorStop(1, "#24324c");
    g.fillStyle = grad;
    g.fillRect(6, y + 4, w - 12, uh - 8);
    g.fillStyle = "#0a111d";
    g.fillRect(6, y + uh - 6, w - 12, 3);
    // ears / handles
    g.fillStyle = "#8a9cbc";
    g.fillRect(14, y + 12, 22, uh - 24);
    g.fillRect(w - 36, y + 12, 22, uh - 24);
    g.fillStyle = "#c4d0e4";
    g.fillRect(14, y + 12, 22, 3);
    g.fillRect(w - 36, y + 12, 22, 3);
    if (k === "vent") {
      g.fillStyle = "#0b1220";
      for (let x = 70; x < w - 260; x += 18) g.fillRect(x, y + 18, 9, uh - 36);
    } else if (k === "drives") {
      for (let x = 60; x < w - 220; x += 76) {
        g.fillStyle = "#121c2e";
        g.fillRect(x, y + 14, 68, uh - 28);
        g.fillStyle = "#6f82a6";
        g.fillRect(x + 6, y + uh / 2 - 3, 56, 6);
      }
    } else if (k === "switch") {
      g.fillStyle = "#0e1726";
      g.fillRect(60, y + 16, w - 300, uh - 32);
      g.fillStyle = "#2d3d58";
      for (let x = 70; x < w - 260; x += 34) {
        g.fillRect(x, y + 22, 24, (uh - 50) / 2);
        g.fillRect(x, y + uh / 2 + 3, 24, (uh - 50) / 2);
      }
    } else {
      g.fillStyle = "#24324b";
      g.fillRect(60, y + uh / 2 - 2, w - 300, 4);
    }
  });
  faceTex = new THREE.CanvasTexture(c);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.generateMipmaps = true;
  faceTex.minFilter = THREE.LinearMipmapLinearFilter;
  faceTex.anisotropy = 16;
  faceTex.needsUpdate = true;
  return faceTex;
}

// ---------- LEDs: seeded hold schedule, periods divide the loop ----------
const HOLDS = [10, 12, 15, 20, 25, 30, 40, 50, 60];
type Led = { x: number; y: number; color: THREE.Color; hold: number; duty: number; id: number };
const LEDS: Led[] = (() => {
  const out: Led[] = [];
  const palette = [
    { c: "#ffffff", w: 0.25 },
    { c: "#58b4ff", w: 0.25 },
    { c: "#ff3b30", w: 0.12 },
    { c: "#ff9a2a", w: 0.38 },
  ];
  let id = 0;
  for (let u = 0; u < UNITS; u++) {
    const n = 5 + Math.floor(rackRnd() * 6);
    for (let k = 0; k < n; k++) {
      let r = rackRnd();
      let col = palette[0].c;
      for (const p of palette) {
        if (r < p.w) { col = p.c; break; }
        r -= p.w;
      }
      out.push({
        x: FACE_W / 2 - 0.035 - k * 0.026 - (k > 5 ? 0.03 : 0),
        y: U0 + (u + 0.5) * UH + (rackRnd() < 0.5 ? -0.018 : 0.018),
        color: new THREE.Color(col),
        hold: HOLDS[Math.floor(rackRnd() * HOLDS.length)],
        duty: 0.45 + rackRnd() * 0.5,
        id: id++,
      });
    }
  }
  return out;
})();

export function ledOn(l: Led, frame: number) {
  const slots = LOOP / l.hold;
  const slot = Math.floor((((frame % LOOP) + LOOP) % LOOP) / l.hold) % slots;
  return hash2(l.id, slot) < l.duty;
}

const Leds: React.FC<{ frame: number }> = ({ frame }) => {
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.011, 0.007);
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    const m = new THREE.InstancedMesh(geo, mat, LEDS.length);
    LEDS.forEach((l, i) => {
      m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(l.x, l.y, RD / 2 + 0.0175));
    });
    m.instanceMatrix.needsUpdate = true;
    m.setColorAt(0, new THREE.Color());
    return m;
  }, []);
  const col = new THREE.Color();
  LEDS.forEach((l, i) => {
    const on = ledOn(l, frame);
    col.copy(l.color).multiplyScalar(on ? 10 : 0.2);
    mesh.setColorAt(i, col);
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return <primitive object={mesh} />;
};

const UnitBox: React.FC<{ index: number }> = ({ index }) => {
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(FACE_W, UH - 0.006, 0.02);
    // map the front face (group 4) to this unit's slice of the face texture
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const v0 = index / UNITS;
    const v1 = (index + 1) / UNITS;
    for (let i = 16; i < 20; i++) uv.setY(i, uv.getY(i) > 0.5 ? v1 : v0);
    return g;
  }, [index]);
  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: "#2a3a58", metalness: 0.7, roughness: 0.35 });
    const front = new THREE.MeshStandardMaterial({ map: rackFaceTexture(), metalness: 0.55, roughness: 0.4 });
    return [side, side, side, side, front, side];
  }, []);
  return (
    <mesh
      geometry={geo}
      material={mats}
      position={[0.02, U0 + (index + 0.5) * UH, RD / 2 + 0.006]}
      castShadow
      receiveShadow
    />
  );
};

let sideTex: THREE.Texture | null = null;
function sidePanelTexture() {
  if (sideTex) return sideTex;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 512, 1024);
  g.fillStyle = "#9aa6ba";
  g.fillRect(0, 340, 512, 4);
  g.fillRect(0, 680, 512, 4);
  g.fillRect(250, 0, 3, 1024);
  sideTex = new THREE.CanvasTexture(c);
  sideTex.colorSpace = THREE.SRGBColorSpace;
  sideTex.generateMipmaps = true;
  sideTex.minFilter = THREE.LinearMipmapLinearFilter;
  sideTex.anisotropy = 16;
  sideTex.needsUpdate = true;
  return sideTex;
}

export const ServerRack: React.FC<{ frame: number; strip: string }> = ({ frame, strip }) => {
  const geos = useMemo(
    () => ({
      body: new RoundedBoxGeometry(RW, RH - 0.08, RD, 3, 0.012),
      cap: new RoundedBoxGeometry(RW + 0.02, 0.07, RD + 0.02, 2, 0.006),
      plinth: new RoundedBoxGeometry(RW - 0.02, 0.1, RD - 0.04, 2, 0.006),
    }),
    [],
  );
  const stripCol = useMemo(() => new THREE.Color(strip).multiplyScalar(3.4), [strip]);
  return (
    <group>
      <mesh geometry={geos.plinth} position={[0, 0.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1a2a44" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={geos.body} position={[0, 0.04 + (RH - 0.08) / 2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#4c6ea8" metalness={0.35} roughness={0.42} clearcoat={0.25} clearcoatRoughness={0.4} />
      </mesh>
      <mesh geometry={geos.cap} position={[0, RH - 0.035, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#cdd8ea" metalness={0.85} roughness={0.24} clearcoat={0.5} clearcoatRoughness={0.15} />
      </mesh>
      {/* recessed front frame + unit face */}
      {/* units: each a shallow box standing proud of the frame, faced with its slice of the texture */}
      {UNIT_KINDS.map((_, i) => (
        <UnitBox key={i} index={i} />
      ))}
      <mesh position={[0.02, U0 + (UNITS * UH) / 2, RD / 2 - 0.004]}>
        <planeGeometry args={[FACE_W + 0.02, UNITS * UH + 0.02]} />
        <meshStandardMaterial color="#05090f" roughness={0.8} />
      </mesh>
      {/* side panel seams */}
      {[-1, 1].map((sg) => (
        <mesh key={sg} position={[sg * (RW / 2 + 0.0008), RH / 2, 0]} rotation={[0, sg * Math.PI / 2, 0]}>
          <planeGeometry args={[RD - 0.06, RH - 0.2]} />
          <meshPhysicalMaterial map={sidePanelTexture()} color="#4c6ea8" metalness={0.35} roughness={0.42} clearcoat={0.25} />
        </mesh>
      ))}
      <group position={[0.02, 0, 0]}>
        <Leds frame={frame} />
      </group>
      {/* vertical light strip on the front edge */}
      <mesh position={[-RW / 2 + 0.03, 0.06 + (RH - 0.16) / 2, RD / 2 + 0.004]}>
        <boxGeometry args={[0.012, RH - 0.2, 0.006]} />
        <meshBasicMaterial color={stripCol} toneMapped={false} />
      </mesh>
      <pointLight position={[-RW / 2 + 0.05, 1.0, RD / 2 + 0.12]} color={strip} intensity={0.25} distance={1.2} decay={2} />
    </group>
  );
};

// ---------- data lines ----------
const lineRnd = mulberry32(4004);
const LINE_PERIODS = [20, 24, 25, 30, 40, 50];
const N_LINES = 40;

// In: two tight, nearly straight ribbons come in high from off-frame left,
// run past the rack's left side and turn into the front panel.
function inCurve(i: number): THREE.CatmullRomCurve3 {
  const band = i % 2;
  const j = Math.floor(i / 2) / (N_LINES / 2 - 1); // 0..1 across the ribbon
  const y0 = (band ? 2.75 : 2.05) + (j - 0.5) * 0.16;
  const z0 = (band ? -0.9 : -0.3) + (j - 0.5) * 0.18;
  const yEnd = U0 + 0.15 + (band ? 0.55 + j * 0.4 : 0.1 + j * 0.4) * (UNITS * UH - 0.3);
  // they run into the rack's left side, close to the front edge, so they never cross its faces
  const zEnd = RD / 2 - 0.12 - j * 0.15;
  const xEnd = -RW / 2 - 0.003;
  return new THREE.CatmullRomCurve3([
    // from screen upper-left: world (-0.5, 0, -1.3) for this camera
    new THREE.Vector3(-3.6, y0 + 0.2, z0 - 3.6),
    new THREE.Vector3(-2.0, (y0 * 2 + yEnd) / 3, z0 * 0.5 - 0.9),
    new THREE.Vector3(-0.9, (y0 + yEnd * 2) / 3, zEnd - 0.2),
    new THREE.Vector3(xEnd - 0.08, yEnd, zEnd),
    new THREE.Vector3(xEnd, yEnd, zEnd),
  ]);
}

// Out: one ribbon leaves the right of the front panel and fans gently
// across the floor toward the right edge of frame.
function outCurve(i: number): THREE.CatmullRomCurve3 {
  const k = i / (N_LINES - 1);
  const yStart = U0 + 0.15 + (0.1 + 0.8 * ((i * 7) % N_LINES) / N_LINES) * (UNITS * UH - 0.3);
  const spread = (k - 0.5) * 2;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(FACE_W / 2 - 0.02, yStart, RD / 2 + 0.005),
    new THREE.Vector3(FACE_W / 2 + 0.2, yStart * 0.95, RD / 2 + 0.1),
    // screen "down-right" for this camera is roughly world (+0.5, 0, +1.3)
    new THREE.Vector3(1.3 + spread * 0.06, 0.55 + yStart * 0.3, RD / 2 + 0.6 - spread * 0.03),
    new THREE.Vector3(2.3 + spread * 0.22, 0.3 + k * 0.15, 2.3 - spread * 0.1),
    new THREE.Vector3(3.6 + spread * 0.75, 0.05 + k * 0.06, 6.0 - spread * 0.3),
  ]);
}

const LINES = (() => {
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < N_LINES; i++) {
    gs.push(
      tubeLine(inCurve(i), 0.0024, 160, {
        period: LINE_PERIODS[Math.floor(lineRnd() * LINE_PERIODS.length)],
        phase: lineRnd(),
        bright: 0.5 + lineRnd() * 0.6,
      }),
    );
  }
  for (let i = 0; i < N_LINES; i++) {
    gs.push(
      tubeLine(outCurve(i), 0.0024, 160, {
        period: LINE_PERIODS[Math.floor(lineRnd() * LINE_PERIODS.length)],
        phase: lineRnd(),
        bright: 0.5 + lineRnd() * 0.6,
      }),
    );
  }
  return gs;
})();

const DataLines: React.FC<{ color: string; frame: number }> = ({ color, frame }) => {
  const geo = useMemo(() => mergeLines(LINES), []);
  const mat = useMemo(
    () => flowMaterial({ color, headColor: "#ffd9a8", base: 0.38, pulse: 5, seg: 0.04, fadeIn: 0.05, fadeOut: 0.15 }),
    [color],
  );
  mat.uniforms.frame.value = frame;
  return <mesh geometry={geo} material={mat} renderOrder={6} frustumCulled={false} />;
};

// ---------- room ----------
function tileFloorTexture(base: string) {
  const s = 512;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  g.fillStyle = "rgba(0,0,0,0.42)";
  g.fillRect(0, 0, s, 4);
  g.fillRect(0, 0, 4, s);
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.fillRect(0, 5, s, 2);
  g.fillRect(5, 0, 2, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 16;
  t.needsUpdate = true;
  return t;
}

const Room: React.FC<{ room: string }> = ({ room }) => {
  const wallGlow = useMemo(() => new THREE.Color(room).multiplyScalar(0.6), [room]);
  const floorCol = useMemo(() => {
    const c = new THREE.Color(room);
    return "#" + c.clone().lerp(new THREE.Color("#6a84b0"), 0.45).getHexString();
  }, [room]);
  const floorTex = useMemo(() => {
    const t = tileFloorTexture(floorCol);
    t.repeat.set(40 / 0.6, 40 / 0.6);
    return t;
  }, [floorCol]);
  const wallTex = useMemo(() => {
    const t = tileFloorTexture("#" + new THREE.Color(room).getHexString());
    t.repeat.set(30 / 1.2, 8 / 1.2);
    return t;
  }, [room]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial map={floorTex} roughness={0.38} metalness={0.25} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[0, 4, -2.4]} receiveShadow>
        <planeGeometry args={[30, 8]} />
        <meshStandardMaterial map={wallTex} roughness={0.6} metalness={0.2} color="#c8d2e6" emissive={wallGlow} />
      </mesh>

    </>
  );
};

const POST: PostSettings = {
  focus: 5.1,
  focusRange: 1.2,
  nearRamp: 2.0,
  farRamp: 2.5,
  maxBlur: 0.012,
  aoStrength: 0.6,
  aoRadius: 0.15,
  bloomStrength: 0.75,
  bloomThreshold: 0.9,
  bloomRadius: 0.55,
  exposure: 1.45,
  vignette: 0.65,
  grain: 0.015,
  period: LOOP,
  contrast: 0.9,
  saturation: 1.0,
  lift: [0.012, 0.03, 0.065],
};

const Lighting: React.FC<{ row: ServerStreamsRow }> = ({ row }) => {
  const { gl, scene } = useThree();
  const env = useMemo(
    () =>
      studioEnv(gl, `streams-${row.room}`, row.room, 2.0, [
        { position: [-2, 9, 2], size: [8, 4], color: "#d8e6ff", intensity: 2.2 },
        { position: [6, 3, 4], size: [3, 5], color: row.lines, intensity: 0.8 },
        { position: [-6, 2, 6], size: [4, 3], color: row.lines, intensity: 0.5 },
      ]),
    [gl, row.room, row.lines],
  );
  useLayoutEffect(() => {
    scene.userData.env = env;
  }, [scene, env]);
  return (
    <>
      <hemisphereLight args={[new THREE.Color(row.lines).lerp(new THREE.Color("#ffffff"), 0.5), row.room, 1.4]} />
      <directionalLight
        position={[-3, 7, 3]}
        intensity={1.8}
        color="#cfe0ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-radius={10}
        shadow-bias={-0.0005}
      />

    </>
  );
};

export const ServerStreams: React.FC<{ row: ServerStreamsRow }> = ({ row }) => {
  // wrapped, so frame 600 is exactly frame 0 (seamless loop)
  const frame = useCurrentFrame() % LOOP;
  const t = (TAU * frame) / LOOP;
  const m = row.mirrored ? -1 : 1;
  const fogCol = "#" + new THREE.Color(row.room).lerp(new THREE.Color("#5a7aa8"), 0.18).getHexString();
  const dist = 5.3;
  const elev = (35 * Math.PI) / 180 + 0.025 * Math.sin(2 * t);
  const az = -0.42 + (5 * Math.PI) / 180 * Math.sin(t);
  const target: [number, number, number] = [m * 0.75, 0.85, 0.3];
  const camera: CameraPose = {
    position: [
      m * dist * Math.cos(elev) * Math.sin(az),
      dist * Math.sin(elev) + 0.75,
      dist * Math.cos(elev) * Math.cos(az),
    ],
    target,
    fov: 32,
  };
  return (
    <Stage camera={camera} post={POST} background={fogCol}>
      <fogExp2 attach="fog" args={[fogCol, 0.05]} />
      <Lighting row={row} />
      <SoftReflection size={40} strength={0.5} blur={0.01} resolution={1024} fadeDist={7} />
      {/* the mirrored version flips the whole set; the camera is mirrored to match */}
      <group scale={[m, 1, 1]}>
        <Room room={row.room} />
        <ServerRack frame={frame} strip={row.lines} />
        <GlowDecal color={row.lines} intensity={0.35} position={[3.2, 0.004, 2.6]} scale={[6, 4.5]} rotationY={-0.5} />
        <GlowDecal color={row.lines} intensity={0.45} position={[-0.25, 0.004, 0.65]} scale={[1.1, 1.1]} />
        <DataLines color={row.lines} frame={frame} />
      </group>
    </Stage>
  );
};
