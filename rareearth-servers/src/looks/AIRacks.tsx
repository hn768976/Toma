import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { AIRacksRow } from "../data/versions";
import { studioEnv } from "../engine/env";
import { PostSettings } from "../engine/Post";
import { CameraPose, Stage } from "../engine/Stage";
import { flowMaterial, mergeLines, ribbonLine } from "../kit/flow";
import { radialTexture } from "../kit/tile";
import { mulberry32, TAU } from "../lib/random";

const LOOP = 600;
const RACK_W = 0.66;
const RACK_H = 2.2;
const RACK_D = 0.9;
const GAP = 0.05;
const UNITS = 12;
const UNIT_H = 0.152;
const UNIT_TOP = RACK_H - 0.14;
const BADGE_UNIT = 2; // third unit from the top

type UnitKind = "vent" | "drives" | "leds" | "badge";
const unitRnd = mulberry32(2293641049);
const KINDS: UnitKind[][] = [0, 1, 2].map(() =>
  Array.from({ length: UNITS }, (_, i): UnitKind => {
    if (i === BADGE_UNIT) return "badge";
    const r = unitRnd();
    return r < 0.34 ? "vent" : r < 0.67 ? "drives" : "leds";
  }),
);

// ---------- unit face textures: map (sRGB) + emissive (LED dots) ----------
const faceCache = new Map<string, { map: THREE.Texture; em: THREE.Texture }>();
function unitFace(kind: UnitKind, seed: number) {
  const key = `${kind}:${seed}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const rnd = mulberry32(seed);
  const W = 1024;
  const H = Math.round((W * UNIT_H) / (RACK_W - 0.08));
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };
  const a = mk();
  const e = mk();
  const g = a.getContext("2d")!;
  const ge = e.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#c8d6ec");
  grad.addColorStop(0.08, "#9fb2d0");
  grad.addColorStop(0.92, "#7f93b4");
  grad.addColorStop(1, "#4e5f7c");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, W, H);
  // handles
  g.fillStyle = "#6e7a8f";
  g.fillRect(14, 14, 26, H - 28);
  g.fillRect(W - 40, 14, 26, H - 28);
  const dot = (x: number, y: number, w: number, h: number, col: string) => {
    ge.fillStyle = col;
    ge.fillRect(x, y, w, h);
  };
  if (kind === "vent" || kind === "badge") {
    // perforated grille: small round-ish holes, coarse enough not to moiré
    g.fillStyle = "#1c2433";
    const x0 = kind === "badge" ? 300 : 70;
    for (let y = 22; y < H - 26; y += 16)
      for (let x = x0 + ((y / 16) % 2) * 8; x < W - 330; x += 16) g.fillRect(x, y, 9, 9);
    g.fillStyle = "#2a3446";
    g.fillRect(W - 300, 24, 220, H - 48);
    for (let k = 0; k < 6; k++) dot(W - 280 + k * 34, H / 2 - 4, 14, 8, k % 3 === 0 ? "#ffffff" : "#38d8ff");
  } else if (kind === "drives") {
    for (let x = 60; x < W - 80; x += 88) {
      g.fillStyle = "#3a4558";
      g.fillRect(x, 18, 78, H - 36);
      g.fillStyle = "#1b2230";
      g.fillRect(x + 8, H / 2 - 5, 62, 10);
      if (rnd() < 0.7) {
        const r = rnd();
        dot(x + 60, 26, 10, 6, r < 0.45 ? "#38d8ff" : r < 0.7 ? "#ffb347" : "#ffffff");
      }
    }
  } else {
    g.fillStyle = "#273142";
    g.fillRect(60, 20, W - 120, H - 40);
    for (let row = 0; row < 2; row++)
      for (let x = 80; x < W - 90; x += 26) {
        if (rnd() < 0.55) {
          const r = rnd();
          dot(x, 34 + row * ((H - 80) / 1), 14, 9, r < 0.25 ? "#ffffff" : r < 0.4 ? "#ffb347" : "#38d8ff");
        }
      }
    ge.fillStyle = "#ff9a2a";
    ge.fillRect(W * 0.55, H / 2 - 18, 6, 36);
  }
  const toTex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 16;
    t.needsUpdate = true;
    return t;
  };
  const out = { map: toTex(a), em: toTex(e) };
  faceCache.set(key, out);
  return out;
}

// ---------- AI badge ----------
let badgeTex: THREE.Texture | null = null;
function badgeTexture() {
  if (badgeTex) return badgeTex;
  const S = 512;
  const draw = (ctx: CanvasRenderingContext2D, outline: boolean, text: boolean) => {
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 18;
    if (outline) {
      ctx.beginPath();
      ctx.roundRect(40, 40, S - 80, S - 80, 56);
      ctx.stroke();
    }
    if (text) {
      ctx.font = "700 230px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AI", S / 2, S / 2 + 12);
    }
  };
  const crisp = document.createElement("canvas");
  crisp.width = crisp.height = S;
  draw(crisp.getContext("2d")!, true, false);
  const txt = document.createElement("canvas");
  txt.width = txt.height = S;
  draw(txt.getContext("2d")!, false, true);
  const tt = txt.getContext("2d")!.getImageData(0, 0, S, S).data;
  const glow = document.createElement("canvas");
  glow.width = glow.height = S;
  const g2 = glow.getContext("2d")!;
  g2.filter = "blur(22px)";
  draw(g2, true, true);
  const out = document.createElement("canvas");
  out.width = out.height = S;
  const co = out.getContext("2d")!;
  const a = crisp.getContext("2d")!.getImageData(0, 0, S, S).data;
  const b = g2.getImageData(0, 0, S, S).data;
  const img = co.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = a[i + 3];
    img.data[i + 1] = Math.min(255, b[i + 3] * 1.5);
    img.data[i + 2] = tt[i + 3];
    img.data[i + 3] = 255;
  }
  co.putImageData(img, 0, 0);
  badgeTex = new THREE.CanvasTexture(out);
  badgeTex.colorSpace = THREE.NoColorSpace;
  badgeTex.generateMipmaps = true;
  badgeTex.minFilter = THREE.LinearMipmapLinearFilter;
  badgeTex.anisotropy = 8;
  badgeTex.needsUpdate = true;
  return badgeTex;
}

function badgeMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: badgeTexture() }, tint: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 tint; varying vec2 vUv;
      void main(){ vec3 t = texture2D(map, vUv).rgb;
        vec2 q = abs(vUv - 0.5) - (0.5 - 40.0/512.0 - 56.0/512.0);
        float sdf = length(max(q, 0.0)) - 56.0/512.0;
        float inside = 1.0 - smoothstep(-0.004, 0.004, sdf);
        vec3 fill = tint * tint * inside * (0.75 + 0.25 * (1.0 - vUv.y));
        vec3 c = fill * (1.0 - t.b) + vec3(0.92, 0.98, 1.0) * t.b * 1.5
               + tint * t.r * 1.3 + tint * t.g * 0.45;
        gl_FragColor = vec4(c, 1.0); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

const Rack: React.FC<{ index: number; x: number; row: AIRacksRow }> = ({ index, x, row }) => {
  const frameMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(row.rackTint).lerp(new THREE.Color("#ffffff"), 0.1),
        metalness: 0.75,
        roughness: 0.32,
        clearcoat: 0.4,
      }),
    [row.rackTint],
  );
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0d1524", metalness: 0.5, roughness: 0.6 }),
    [],
  );
  const unitGeo = useMemo(() => new RoundedBoxGeometry(RACK_W - 0.07, UNIT_H - 0.012, 0.05, 2, 0.006), []);
  const strip = useMemo(() => new THREE.Color(row.badge).multiplyScalar(1.6), [row.badge]);
  const tint = useMemo(() => new THREE.Color(row.rackTint).lerp(new THREE.Color("#ffffff"), 0.15), [row.rackTint]);
  const emCol = useMemo(() => new THREE.Color(row.badge).lerp(new THREE.Color("#ffffff"), 0.2), [row.badge]);
  const bMat = useMemo(() => badgeMaterial(row.badge), [row.badge]);
  const post = 0.035;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, RACK_H / 2, -RACK_D / 2]} material={bodyMat} receiveShadow>
        <boxGeometry args={[RACK_W, RACK_H, RACK_D]} />
      </mesh>
      {/* light metal frame: posts + top + bottom */}
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * (RACK_W / 2 - post / 2), RACK_H / 2, 0.01]} material={frameMat} castShadow>
          <primitive object={new RoundedBoxGeometry(post, RACK_H, 0.06, 2, 0.008)} attach="geometry" />
        </mesh>
      ))}
      <mesh position={[0, RACK_H - 0.04, 0.01]} material={frameMat} castShadow>
        <primitive object={new RoundedBoxGeometry(RACK_W, 0.08, 0.07, 2, 0.01)} attach="geometry" />
      </mesh>
      {/* edge light strips up each side */}
      {[-1, 1].map((sgn) => (
        <mesh key={`s${sgn}`} position={[sgn * (RACK_W / 2 + 0.004), RACK_H / 2 - 0.05, 0.03]}>
          <boxGeometry args={[0.014, RACK_H - 0.16, 0.012]} />
          <meshBasicMaterial color={strip} toneMapped={false} />
        </mesh>
      ))}
      {KINDS[index].map((kind, u) => {
        const y = UNIT_TOP - (u + 0.5) * UNIT_H;
        const tex = unitFace(kind, index * 100 + u + 1);
        return (
          <group key={u} position={[0, y, 0]}>
            <mesh geometry={unitGeo} castShadow receiveShadow>
              <meshStandardMaterial color="#8592a8" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.0255]}>
              <planeGeometry args={[RACK_W - 0.08, UNIT_H - 0.02]} />
              <meshStandardMaterial
                map={tex.map}
                color={tint}
                emissiveMap={tex.em}
                emissive={emCol}
                emissiveIntensity={3.2}
                metalness={0.3}
                roughness={0.5}
              />
            </mesh>
            {kind === "badge" && (
              <mesh position={[-RACK_W / 2 + 0.17, 0, 0.03]} material={bMat}>
                <planeGeometry args={[0.22, 0.22]} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};

// ---------- fibre streaks ----------
const streakRnd = mulberry32(5049);
const STREAK_PERIODS = [40, 50, 60, 75, 100, 120, 150];
const STREAKS = (() => {
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 120; i++) {
    const across = i % 4 === 0; // some sweep flatter, across the racks
    const z = across ? 0.25 + streakRnd() * 0.45 : 0.2 + streakRnd() * 0.9;
    // sweep from the lower centre / right up toward the upper right
    const p0 = new THREE.Vector3(-1.0 + streakRnd() * 1.4, 0.45 + streakRnd() * 0.6, z);
    const p2 = across
      ? new THREE.Vector3(0.9 + streakRnd() * 0.8, 1.3 + streakRnd() * 0.9, z)
      : new THREE.Vector3(0.0 + streakRnd() * 1.2, 2.3 + streakRnd() * 0.6, z);
    const mid = p0.clone().lerp(p2, 0.5);
    const p1 = mid.add(new THREE.Vector3(0.35 + streakRnd() * 0.4, -0.35 - streakRnd() * 0.35, 0));
    const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    const pts = curve.getPoints(80);
    gs.push(
      ribbonLine(pts, i % 12 === 0 ? 0.007 : 0.0025 + streakRnd() * 0.0035, new THREE.Vector3(0, 0, 1), {
        period: STREAK_PERIODS[Math.floor(streakRnd() * STREAK_PERIODS.length)],
        phase: streakRnd(),
        bright: 0.15 + Math.pow(streakRnd(), 4) * 1.4,
      }),
    );
  }
  return gs;
})();
const STREAK_LEN = STREAKS.map((g) => (g.getAttribute("aLen") as THREE.BufferAttribute).getX(0));
const MEAN_LEN = STREAK_LEN.reduce((a, b) => a + b, 0) / STREAK_LEN.length;

const Streaks: React.FC<{ row: AIRacksRow; frame: number }> = ({ row, frame }) => {
  const geo = useMemo(() => mergeLines(STREAKS), []);
  const mat = useMemo(
    () =>
      flowMaterial({
        color: row.streak,
        headColor: "#" + new THREE.Color(row.head).lerp(new THREE.Color(row.badge), 0.45).getHexString(),
        base: 0.06,
        pulse: 6,
        seg: MEAN_LEN * 0.15 * 1.4,
      }),
    [row.streak, row.head],
  );
  mat.uniforms.frame.value = frame;
  return <mesh geometry={geo} material={mat} renderOrder={8} frustumCulled={false} />;
};

// ---------- bokeh ----------
const bokehRnd = mulberry32(25);
const BOKEH = Array.from({ length: 25 }, () => ({
  x: 0.3 + bokehRnd() * 1.4,
  y: 0.9 + bokehRnd() * 1.4,
  z: 0.25 + bokehRnd() * 0.6,
  r: 0.008 + bokehRnd() * 0.022,
  k: 1 + Math.floor(bokehRnd() * 2),
  ph: bokehRnd(),
  amp: 0.04 + bokehRnd() * 0.08,
  b: 0.4 + bokehRnd() * 0.8,
}));

const Bokeh: React.FC<{ color: string; frame: number }> = ({ color, frame }) => {
  const t = frame / LOOP;
  const col = useMemo(() => new THREE.Color(color), [color]);
  return (
    <>
      {BOKEH.map((b, i) => (
        <mesh
          key={i}
          position={[
            b.x + b.amp * Math.sin(TAU * (b.k * t + b.ph)),
            b.y + b.amp * 0.6 * Math.cos(TAU * (b.k * t + b.ph)),
            b.z,
          ]}
          renderOrder={20}
        >
          <planeGeometry args={[b.r * 2, b.r * 2]} />
          <meshBasicMaterial
            map={radialTexture()}
            color={col.clone().multiplyScalar(b.b * 2.2)}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
    </>
  );
};

const POST: PostSettings = {
  focus: 1.8,
  focusRange: 0.35,
  nearRamp: 0.6,
  farRamp: 2.0,
  maxBlur: 0.008,
  aoStrength: 0.5,
  aoRadius: 0.06,
  bloomStrength: 0.85,
  bloomThreshold: 0.95,
  bloomRadius: 0.55,
  exposure: 1.05,
  vignette: 0.3,
  grain: 0.015,
  period: LOOP,
  contrast: 1.0,
  saturation: 1.22,
  lift: [0.004, 0.03, 0.07],
};

const Lighting: React.FC<{ row: AIRacksRow }> = ({ row }) => {
  const { gl, scene } = useThree();
  const env = useMemo(
    () =>
      studioEnv(gl, `racks-${row.streak}`, "#0e1a30", 1.0, [
        { position: [0, 8, 6], size: [10, 3], color: "#cfe0ff", intensity: 3.0 },
        { position: [0, 2, 9], size: [8, 4], color: "#9fbcff", intensity: 1.5 },
        { position: [-6, 2, 5], size: [2, 6], color: row.badge, intensity: 1.5 },
        { position: [6, 2, 5], size: [2, 6], color: row.streak, intensity: 1.5 },
      ]),
    [gl, row.streak, row.badge],
  );
  useLayoutEffect(() => {
    scene.userData.env = env;
  }, [scene, env]);
  return (
    <>
      <hemisphereLight args={["#a8c4ff", "#0a1222", 0.6]} />
      <directionalLight position={[1.5, 4, 4]} intensity={2.6} color="#d6e4ff" />
      <directionalLight position={[0, 1.5, 5]} intensity={1.2} color="#b8ccff" />
      <pointLight position={[0.6, 1.2, 0.8]} color={row.streak} intensity={1.6} distance={3} decay={2} />
    </>
  );
};

export const AIRacks: React.FC<{ row: AIRacksRow }> = ({ row }) => {
  // wrapped, so frame 600 is exactly frame 0 (seamless loop)
  const frame = useCurrentFrame() % LOOP;
  // slide a fixed distance and back, cosine-eased, one cycle per loop
  const slide = 0.5 * (1 - Math.cos((TAU * frame) / LOOP));
  // low three-quarter view from the left, racks receding to the right
  const x = 0.0 + 0.28 * slide;
  const camera: CameraPose = {
    position: [x - 0.38, 1.4, 1.62],
    target: [x - 0.36, 1.4 + 2.1 * Math.tan((5 * Math.PI) / 180), -0.5],
    fov: 46,
  };
  const pitch = RACK_W + GAP;
  return (
    <Stage camera={camera} post={POST} background="#050a16" shadows={false}>
      <fogExp2 attach="fog" args={["#07101f", 0.12]} />
      <Lighting row={row} />
      <mesh position={[0, 2, -2.5]}>
        <planeGeometry args={[20, 8]} />
        <meshStandardMaterial color="#0a1426" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0b1424" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* the row recedes to the right: nearest (largest) rack on the left */}
      <group position={[-0.72, 0, 0.1]} rotation={[0, 0.2, 0]}>
        {[0, 1, 2].map((k) => (
          <Rack key={k} index={k} x={k * pitch} row={row} />
        ))}
      </group>
      <Streaks row={row} frame={frame} />
      <Bokeh color={row.streak} frame={frame} />
    </Stage>
  );
};
