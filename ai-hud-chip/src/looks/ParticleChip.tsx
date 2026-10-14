import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import type { ParticleChipRow } from "../colorways";
import { buildBoardBackdrop, buildBoardFloor } from "../kit/board";
import { BokehSpec, makeBokeh } from "../kit/bokeh";
import { CameraRig } from "../kit/Camera";
import { CHIP, makePads } from "../kit/chip";
import { FONT_AI } from "../kit/fonts";
import { GLSL_HASH } from "../kit/glsl";
import { DofSettings, makeTexMaterial } from "../kit/materials";
import { canvasTexture, makeCanvas } from "../kit/painter";
import { Pipeline } from "../kit/Pipeline";
import { mulberry32, Rng } from "../kit/random";
import { Stage } from "../kit/Stage";

// ---------------------------------------------------------------------------
// Look 2 — Particle AI Chip. A processor chip drawn as ~40k glowing points
// with "AI" at its centre, data rain behind, blurred board + bokeh. 20 s loop.
// Every motion is periodic in LOOP frames with whole cycles, so frame 600
// equals frame 0 exactly.
// ---------------------------------------------------------------------------

const LOOP = 600;
const TWINKLE_BUCKET = 3; // frames per twinkle bucket; LOOP / 3 = 200 buckets

const H = 1.36; // chip half size (world)
const DEPTH = 0.16;
const CAM_DIST = 8.2;
const CHIP_POS: [number, number, number] = [0.78, 0.0, 0];

const DOF: DofSettings = { mode: 1, a: CAM_DIST, b: 14, c: 0, max: 46, min: 0 };

// -------------------------------------------------------- point set (module)
type PointSet = {
  pos: Float32Array;
  seed: Float32Array;
  bright: Float32Array;
  size: Float32Array;
  drift: Float32Array; // dir.xyz, cycles (0 = static)
  count: number;
};

const buildChipPoints = (): PointSet => {
  const rng = mulberry32(0x40c0);
  const pos: number[] = [];
  const bright: number[] = [];
  const size: number[] = [];
  const drift: number[] = [];
  const add = (x: number, y: number, z: number, b: number, s: number) => {
    pos.push(x, y, z);
    bright.push(b);
    size.push(s);
    drift.push(0, 0, 0, 0);
  };
  const jitter = (r: Rng, a: number) => (r() - 0.5) * a;
  const segment = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, spacing: number, b: number, s: number, j = 0.004) => {
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const n = Math.max(2, Math.round(len / spacing));
    for (let i = 0; i < n; i++) {
      const t = (i + rng() * 0.6) / n;
      add(x0 + (x1 - x0) * t + jitter(rng, j), y0 + (y1 - y0) * t + jitter(rng, j), z0 + (z1 - z0) * t + jitter(rng, j), b * (0.6 + 0.4 * rng()), s);
    }
  };
  const square = (h: number, z: number, spacing: number, b: number, s: number, j = 0.004) => {
    segment(-h, -h, z, h, -h, z, spacing, b, s, j);
    segment(h, -h, z, h, h, z, spacing, b, s, j);
    segment(h, h, z, -h, h, z, spacing, b, s, j);
    segment(-h, h, z, -h, -h, z, spacing, b, s, j);
  };

  // 1. pin grid — each pad a small cluster of points (dense dotted look)
  for (const p of makePads(46, 0x9ad)) {
    const cx = p.u * H;
    const cy = p.v * H;
    const r = p.s * H * 0.5;
    // patchy brightness (bands and gaps, like the reference's gritty face)
    const patch = 0.55 + 0.9 * Math.max(0, Math.sin(p.u * 7.0 + 1.3) * Math.cos(p.v * 5.0 - 0.4));
    add(cx, cy, 0.002, 1.6 * p.lum * patch, 16);
    for (let k = 0; k < 5; k++) add(cx + jitter(rng, r * 2.4), cy + jitter(rng, r * 2.4), 0.002, 0.5 * p.lum, 3.0);
  }
  // 2. package outline: double front edge, back edge, depth edges
  square(H, 0.004, 0.0014, 0.85, 3.8, 0.012);
  square(H * 0.975, 0.004, 0.0028, 0.6, 2.6);
  square(H, -DEPTH, 0.004, 0.45, 2.6);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) segment(sx * H, sy * H, 0, sx * H, sy * H, -DEPTH, 0.004, 0.6, 2.6);
  // 3. die frame (double square + round corner dots)
  square(H * CHIP.FRAME_OUT, 0.006, 0.0022, 1.0, 3.0);
  square(H * CHIP.FRAME_IN, 0.006, 0.0022, 0.9, 3.0);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = sx * H * CHIP.FRAME_IN * 0.88;
    const cy = sy * H * CHIP.FRAME_IN * 0.88;
    for (let i = 0; i < 320; i++) {
      const a = rng() * Math.PI * 2;
      const rr = H * 0.06 * Math.sqrt(rng());
      add(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.006, 0.8, 2.8);
    }
  }
  // 4. die interior: fine circuit grid
  const d = H * CHIP.DIE;
  square(d, 0.006, 0.003, 0.7, 2.6);
  for (let i = 1; i < 12; i++) {
    const t = -d + (2 * d * i) / 12;
    segment(t, -d, 0.005, t, d, 0.005, 0.01, 0.25, 2.4);
    segment(-d, t, 0.005, d, t, 0.005, 0.01, 0.25, 2.4);
  }
  // 4b. inner dot grid inside the die frame, around a dark window
  for (let j = 0; j < 22; j++)
    for (let i = 0; i < 22; i++) {
      const u = -0.33 + (0.66 * (i + 0.5)) / 22;
      const v = -0.33 + (0.66 * (j + 0.5)) / 22;
      if (Math.max(Math.abs(u), Math.abs(v)) < 0.2) continue;
      add(u * H, v * H, 0.006, 0.8, 7);
    }
  // 4c. scratchy streaks across the face
  for (let k = 0; k < 220; k++) {
    const x0 = jitter(rng, 2 * H);
    const y0 = jitter(rng, 2 * H);
    const a = rng() * Math.PI;
    const l = 0.04 + rng() * 0.25;
    segment(x0, y0, 0.003, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l, 0.003, 0.006, 0.5, 2.6, 0.003);
  }
  // 4d. frayed, glitchy fragments breaking off the outline
  for (let k = 0; k < 260; k++) {
    const e = Math.floor(rng() * 4);
    const t = jitter(rng, 2 * H);
    const o = (rng() - 0.3) * 0.12;
    const [x0, y0] = e === 0 ? [H + o, t] : e === 1 ? [-H - o, t] : e === 2 ? [t, H + o] : [t, -H - o];
    const horiz = e >= 2;
    const l = 0.02 + rng() * 0.12;
    segment(x0, y0, 0.004, x0 + (horiz ? l : jitter(rng, 0.03)), y0 + (horiz ? jitter(rng, 0.03) : l), 0.004, 0.005, 0.45, 2.4, 0.004);
  }
  // 4e. vertical digital smear streaks through the face
  for (let k = 0; k < 40; k++) {
    const x0 = jitter(rng, 2 * H);
    const y0 = jitter(rng, 2 * H);
    segment(x0, y0, 0.004, x0 + jitter(rng, 0.01), y0 + 0.2 + rng() * 0.6, 0.004, 0.004, 0.55, 2.6, 0.002);
  }
  // 5. sparkle dust across the face
  for (let i = 0; i < 6500; i++) add(jitter(rng, 2 * H), jitter(rng, 2 * H), 0.003, 0.12 + 0.25 * rng() * rng(), 2.4);
  // 6. side faces (thickness)
  for (let i = 0; i < 2600; i++) {
    const side = Math.floor(rng() * 4);
    const t = jitter(rng, 2 * H);
    const z = -rng() * DEPTH;
    const [x, y] = side === 0 ? [H, t] : side === 1 ? [-H, t] : side === 2 ? [t, H] : [t, -H];
    add(x, y, z, 0.25 + 0.3 * rng(), 2.4);
  }
  // 7. a line of solder points along the chip's base
  for (let i = 0; i < 1400; i++) add(jitter(rng, 2 * H * 1.04), -H - 0.02 - rng() * 0.05, jitter(rng, DEPTH * 2), 0.2 + 0.4 * rng(), 2.4);

  // 8. drifters: ~3% of all points, leave the edges and fade (closed paths)
  const staticCount = bright.length;
  const nDrift = Math.round(staticCount * 0.031);
  for (let i = 0; i < nDrift; i++) {
    const e = Math.floor(rng() * 4);
    const t = jitter(rng, 2 * H);
    const [x, y, nx, ny] = e === 0 ? [H, t, 1, 0] : e === 1 ? [-H, t, -1, 0] : e === 2 ? [t, H, 0, 1] : [t, -H, 0, -1];
    pos.push(x, y, jitter(rng, 0.1));
    bright.push(0.6 + 0.4 * rng());
    size.push(2.8);
    const sp = 0.25 + rng() * 0.55;
    drift.push((nx + jitter(rng, 0.8)) * sp, (ny + jitter(rng, 0.8)) * sp + 0.08, 0.2 + rng() * 0.4, 1 + Math.floor(rng() * 3));
  }
  const count = bright.length;
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) seed[i] = rng();
  return { pos: new Float32Array(pos), seed, bright: new Float32Array(bright), size: new Float32Array(size), drift: new Float32Array(drift), count };
};

const buildRain = (): PointSet => {
  const rng = mulberry32(0x5a1e);
  const pos: number[] = [];
  const bright: number[] = [];
  const size: number[] = [];
  const drift: number[] = [];
  const LINES = 150;
  // three bright lines pinned near the chip (one passes in front of it)
  const PINNED: [number, number][] = [[CHIP_POS[0] + H * 0.75, 0.6], [CHIP_POS[0] - H * 1.25, -1.0], [CHIP_POS[0] + H * 1.3, -0.5]];
  for (let l = 0; l < LINES; l++) {
    const pin = l < PINNED.length ? PINNED[l] : null;
    const z = pin ? pin[1] : rng() < 0.12 ? 1.2 + rng() * 1.8 : -1.5 - rng() * 12;
    const dist = CAM_DIST - z;
    const halfW = dist * 0.32 * (16 / 9);
    const x = pin ? pin[0] : (rng() * 2 - 1) * halfW;
    const span = dist * 0.36 * 2; // a little taller than the view
    const cycles = 1 + Math.floor(rng() * 3); // whole cycles per loop
    const strong = l < 3 || rng() < 0.16;
    const bLine = strong ? 1.0 + 0.6 * rng() : 0.08 + 0.22 * rng();
    // dots and dashes along the line (in 0..1 of span)
    let s = rng() * 0.05;
    while (s < 1) {
      const dash = rng() < (strong ? 0.85 : 0.4);
      const n = dash ? (strong ? 10 + Math.floor(rng() * 40) : 3 + Math.floor(rng() * 8)) : 1;
      for (let k = 0; k < n && s < 1; k++) {
        pos.push(x, s, z);
        bright.push(bLine * (0.5 + 0.5 * rng()));
        size.push(dash ? 4.2 : 5.0);
        drift.push(span, 0, 0, cycles);
        s += 0.0045;
      }
      s += strong ? 0.006 + rng() * 0.02 : 0.01 + rng() * 0.05;
    }
  }
  const count = bright.length;
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) seed[i] = rng();
  return { pos: new Float32Array(pos), seed, bright: new Float32Array(bright), size: new Float32Array(size), drift: new Float32Array(drift), count };
};

// Generated once per thread at module level (seeded): identical everywhere.
const CHIP_POINTS = buildChipPoints();
const RAIN_POINTS = buildRain();

// -------------------------------------------------------- point shaders
const POINT_VERT = /* glsl */ `
in float aSeed; in float aBright; in float aSize; in vec4 aDrift;
uniform float uPhase;        // frame / LOOP  (0..1)
uniform uint uBucket;        // twinkle bucket (mod NB)
uniform uint uBucketNext;
uniform float uBucketFrac;
uniform float uPxScale;
uniform float uTwinkle;
uniform float uRain;         // 1 = data rain mode
uniform float uGain;
uniform vec4 uDof;
uniform float uDofMax;
out float vAlpha;
out float vSharp;
${GLSL_HASH}
void main() {
  vec3 p = position;
  float a = aBright;
  if (uRain > 0.5) {
    // fall by whole cycles: y = top - fract(s + k·phase)·span
    float f = fract(p.y + aDrift.w * uPhase);
    p.y = aDrift.x * (0.5 - f);
    a *= smoothstep(0.0, 0.12, f) * smoothstep(1.0, 0.85, f);
  } else if (aDrift.w > 0.0) {
    float t = fract(aSeed * 7.0 + aDrift.w * uPhase);
    p += aDrift.xyz * t;
    a *= sin(3.14159265 * t) * (1.0 - t);
  }
  uint id = uint(gl_VertexID);
  float tw0 = h2(id, uBucket);
  float tw1 = h2(id, uBucketNext);
  float tw = mix(tw0, tw1, smoothstep(0.0, 1.0, uBucketFrac));
  a *= mix(1.0, 0.35 + 1.3 * tw * tw, uTwinkle);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float z = -mv.z;
  float coc = min(abs(1.0 / max(z, 0.05) - 1.0 / uDof.y) * uDof.z, 1.0) * uDofMax * uPxScale;
  float core = aSize * uPxScale;
  float s = max(core, coc);
  // keep tiny points from aliasing: never below 1.6 px, conserve energy
  float sz = max(s, 2.0);
  a *= (core * core) / (sz * sz); // energy-conserving growth (blur or min size)
  gl_PointSize = sz;
  vAlpha = a * uGain;
  vSharp = clamp(1.0 - (s - core) / max(s, 1e-3), 0.0, 1.0);
}
`;
const POINT_FRAG = /* glsl */ `
precision highp float;
in float vAlpha; in float vSharp; out vec4 fragColor;
uniform vec3 uColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(q, q);
  float gauss = exp(-d2 * 3.2);
  float disc = 1.0 - smoothstep(0.7, 1.0, sqrt(d2));
  float k = mix(disc * 0.9, gauss * 1.6, vSharp);
  fragColor = vec4(uColor * vAlpha * k, 1.0);
}
`;

const makePoints = (set: PointSet, color: string, rain: boolean, twinkle: number, gain: number, dof: DofSettings) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(set.pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(set.seed, 1));
  geo.setAttribute("aBright", new THREE.BufferAttribute(set.bright, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(set.size, 1));
  geo.setAttribute("aDrift", new THREE.BufferAttribute(set.drift, 4));
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: {
      uPhase: { value: 0 },
      uBucket: { value: 0 },
      uBucketNext: { value: 1 },
      uBucketFrac: { value: 0 },
      uPxScale: { value: 1 },
      uTwinkle: { value: twinkle },
      uRain: { value: rain ? 1 : 0 },
      uDof: { value: new THREE.Vector4(dof.mode, dof.a, dof.b, dof.c) },
      uDofMax: { value: dof.max },
      uGain: { value: gain },
      uColor: { value: new THREE.Color(color) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
};

// -------------------------------------------------------- textures
const buildCentre = (text: string) => {
  const { cv, ctx } = makeCanvas(1024, 1024);
  ctx.font = `600 300px "${FONT_AI}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(150,200,255,0.9)";
  ctx.shadowBlur = 16;
  ctx.fillText(text, 512, 530);
  ctx.shadowBlur = 0;
  ctx.fillText(text, 512, 530);
  return canvasTexture(cv, 8);
};

const buildFarText = (text: string) => {
  const { cv: raw, ctx } = makeCanvas(1024, 512);
  ctx.font = `600 340px "${FONT_AI}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 512, 270);
  const { cv, ctx: b } = makeCanvas(1024, 512);
  b.filter = "blur(18px)";
  b.drawImage(raw, 0, 0);
  return canvasTexture(cv, 4);
};

const buildFill = () => {
  const { cv, ctx } = makeCanvas(512, 512);
  const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 360);
  g.addColorStop(0, "rgba(16,30,56,0.8)");
  g.addColorStop(1, "rgba(6,12,26,0.94)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return canvasTexture(cv, 4);
};

const buildBokeh = (row: ParticleChipRow) => {
  const rng = mulberry32(0xb0b0);
  const specs: BokehSpec[] = [];
  const base = new THREE.Color(row.bokeh);
  for (let i = 0; i < 20; i++) {
    const z = -3 - rng() * 9;
    const dist = CAM_DIST - z;
    // clustered left-middle and low
    const x = rng() < 0.6 ? -dist * (0.15 + rng() * 0.4) : (rng() * 2 - 1) * dist * 0.55;
    const y = -dist * 0.22 + rng() * dist * 0.32;
    const c = base.clone().lerp(new THREE.Color("#c4e6ff"), 0.35 + rng() * 0.4);
    specs.push({ x, y, z, size: 60 + rng() * 140, color: c, gain: 0.08 + rng() * 0.24 });
  }
  // big soft foreground blobs along the bottom
  for (let i = 0; i < 9; i++) {
    const c = base.clone().lerp(new THREE.Color("#c4e6ff"), 0.3 + rng() * 0.4);
    specs.push({ x: -3.2 + i * 0.85 + rng() * 0.4, y: -1.15 - rng() * 0.35, z: 1.5 + rng() * 1.5, size: 180 + rng() * 200, color: c, gain: 0.06 + rng() * 0.1 });
  }
  // a vertical pair of lights at the left (as in the reference)
  for (let i = 0; i < 6; i++) specs.push({ x: -3.2 - (i % 2) * 0.7, y: 1.4 - Math.floor(i / 2) * 0.55, z: -4, size: 80, color: base.clone().lerp(new THREE.Color("#cfeaff"), 0.5), gain: 0.7 });
  specs.push({ x: 0.2, y: 3.4, z: -6, size: 130, color: base.clone().lerp(new THREE.Color("#cfeaff"), 0.4), gain: 0.55 });
  specs.push({ x: 5.6, y: -0.2, z: -1, size: 200, color: new THREE.Color("#e4f2ff"), gain: 0.5 });
  return makeBokeh(specs, 0xb0b1);
};

// -------------------------------------------------------- scene
const Scene: React.FC<{ row: ParticleChipRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const f = ((frame % LOOP) + LOOP) % LOOP;
  const phase = f / LOOP;

  const a = useMemo(() => {
    const chip = makePoints(CHIP_POINTS, row.points, false, 1, 4.2, DOF);
    const rain = makePoints(RAIN_POINTS, row.rain, true, 0.6, 5.5, { ...DOF, b: 8, max: 22 });
    const centre = makeTexMaterial({ map: buildCentre(row.centre), dof: DOF, tint: row.points, additive: true, depthTest: false });
    const far = makeTexMaterial({ map: buildFarText(row.centre), dof: { ...DOF, max: 30 }, tint: row.bokeh, additive: true, depthTest: false, opacity: 0.22 });
    const fill = makeTexMaterial({ map: buildFill(), dof: DOF, depthTest: true, depthWrite: false, opacity: 0.85 });
    const backdrop = makeTexMaterial({ map: buildBoardBackdrop(row.space, [row.bokeh], 30), dof: { ...DOF, max: 0 }, depthTest: false });
    backdrop.transparent = false;
    const floor = makeTexMaterial({ map: buildBoardFloor("#123060"), dof: { ...DOF, b: 26, min: 0 }, depthTest: true, depthWrite: true });
    floor.transparent = false;
    const bokeh = buildBokeh(row);
    return { chip, rain, centre, far, fill, backdrop, floor, bokeh };
  }, [row]);

  // ---- per-frame (pure functions of the looped frame)
  // camera: fixed framing, slow closed drift and ±3% push
  const ang = phase * Math.PI * 2;
  const dist = CAM_DIST * (1 + 0.03 * Math.sin(ang));
  const cx = 0.18 * Math.sin(ang);
  const cy = 0.35 + 0.08 * Math.sin(ang * 2 + 0.7);
  const NB = LOOP / TWINKLE_BUCKET;
  const bucket = Math.floor(f / TWINKLE_BUCKET);
  for (const pts of [a.chip, a.rain]) {
    const u = pts.material.uniforms;
    u.uPhase.value = phase;
    u.uBucket.value = bucket % NB;
    u.uBucketNext.value = (bucket + 1) % NB;
    u.uBucketFrac.value = (f % TWINKLE_BUCKET) / TWINKLE_BUCKET;
  }
  a.bokeh.material.uniforms.uPhase.value = phase;
  // focus follows the push so the chip stays sharp
  for (const m of [a.chip.material, a.rain.material, a.centre, a.far, a.fill, a.backdrop, a.floor]) m.uniforms.uDof.value.y = dist;
  a.centre.uniforms.uOpacity.value = 0.85 + 0.08 * Math.sin(phase * Math.PI * 2 * 4);


  return (
    <>
      <CameraRig position={[cx, cy, dist]} target={[cx * 0.3, 0.2, 0]} fov={32} />
      <mesh renderOrder={-6} position={[0, 1.5, -16]} material={a.backdrop}>
        <planeGeometry args={[46, 26]} />
      </mesh>
      <mesh renderOrder={-5} position={[-4.6, 1.1, -12]} material={a.far}>
        <planeGeometry args={[7, 3.5]} />
      </mesh>
      <mesh renderOrder={0} position={[0, CHIP_POS[1] - H - 0.03, -1.5]} rotation={[-Math.PI / 2, 0, 0]} material={a.floor}>
        <planeGeometry args={[30, 13]} />
      </mesh>
      <primitive object={a.bokeh} />
      <primitive object={a.rain} />
      <group position={CHIP_POS} rotation={[0.04, -0.1, 0]}>
        <mesh renderOrder={2} position={[0, 0, -0.01]} material={a.fill}>
          <planeGeometry args={[H * 2, H * 2]} />
        </mesh>
        <mesh renderOrder={3} position={[0, 0, 0.008]}>
          <planeGeometry args={[H * 0.38, H * 0.38]} />
          <meshBasicMaterial color="#03070f" transparent opacity={0.92} depthWrite={false} />
        </mesh>
        <primitive object={a.chip} />
        <mesh renderOrder={4} position={[0, 0, 0.02]} material={a.centre}>
          <planeGeometry args={[H * 0.92, H * 0.92]} />
        </mesh>
      </group>
      <Pipeline frame={f} period={LOOP} bloomStrength={1.0} bloomThreshold={0.22} vignette={0.6} grain={0.015} saturation={0.78} lift={[0, 0.006, 0.01]} chroma={3} />
    </>
  );
};

export const ParticleAIChip: React.FC<{ row: ParticleChipRow }> = ({ row }) => (
  <Stage fov={32}>
    <Scene row={row} />
  </Stage>
);
