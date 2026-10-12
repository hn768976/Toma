import { Euler, GLSL3, Group, Mesh, MeshBasicMaterial, NoBlending, Object3D, PerspectiveCamera, PlaneGeometry, RawShaderMaterial, Scene, Vector2, Vector3 } from "three";
import { hexToSrgb, lin } from "../../engine/color";
import { FONT_BADGE, FONT_HUD } from "../../engine/fonts";
import { LineBatch, PointBatch, SEG_STRIDE, SegList } from "../../engine/lines";
import { Pipeline } from "../../engine/pipeline";
import { hash01, mulberry32, range, TAU } from "../../engine/rng";
import { canvasTexture, GlyphWriter, glyphAtlas, glyphRows, SpriteBatch, texturedPlane } from "../../engine/sprites";
import type { LookFactory } from "../../engine/Stage";
import { buildTurbine, TURBINE } from "../../shared/turbine";

// Look 3 — AI Wind Grid. A tilted holographic table: grid, ~40 wireframe
// turbines, ~80 pulsing "AI" badges, a rolling wave of ~12,000 points in the
// foreground, HUD panels at the edges and a very shallow depth of field.
// Every motion is a whole cycle of the 600-frame loop.

export type AigridPalette = { grid: string; turbine: string; badge: string; wave: string; hud: string; bgDeep: string; bgLight: string };

const LOOP = 600;
const T_SCALE = 0.2; // turbine scale on the map (hub height 3.2)

// --- camera rig ---------------------------------------------------------------
const CAM_EULER = new Euler(-0.5, 0.62, -0.2, "YXZ"); // ~31° down, rows run diagonally, slight roll
const CAM_FOV = 32;
const CAM_FWD = new Vector3(0, 0, -1).applyEuler(CAM_EULER);
const CAM_RIGHT = new Vector3(1, 0, 0).applyEuler(CAM_EULER);
const FWD_H = new Vector3(CAM_FWD.x, 0, CAM_FWD.z).normalize();
const RIGHT_H = new Vector3(CAM_RIGHT.x, 0, CAM_RIGHT.z).normalize();
const CAM_H = 11;
// Camera centre such that the view axis meets the table at the origin.
const CAM_C = new Vector3().copy(CAM_FWD).multiplyScalar(CAM_H / CAM_FWD.y);
const PATH_U = RIGHT_H.clone().multiplyScalar(0.85).add(FWD_H.clone().multiplyScalar(0.45)).normalize();
const PATH_V = FWD_H.clone().multiplyScalar(0.8).sub(RIGHT_H.clone().multiplyScalar(0.3)).normalize();
const camAt = (t: number) =>
  CAM_C.clone()
    .addScaledVector(PATH_U, 4.6 * Math.cos(TAU * t))
    .addScaledVector(PATH_V, 1.4 * Math.sin(TAU * t))
    .add(new Vector3(0, 0.35 * Math.sin(TAU * t + 0.8), 0));
const FOCUS = CAM_H / -CAM_FWD.y; // distance along the view axis to the table

// --- static layout --------------------------------------------------------------
const TURB = buildTurbine("light");

type Spot = { x: number; z: number; yaw: number; k: number; ph: number };
const LAYOUT = (() => {
  const r = mulberry32(0xa1d);
  const turbines: Spot[] = [];
  for (let row = 0; row < 5; row++)
    for (let c = 0; c < 8; c++) {
      turbines.push({
        x: -21 + c * 6 + range(r, -1.2, 1.2) + (row % 2) * 2.5,
        z: -14 + row * 6.5 + range(r, -0.8, 0.8),
        yaw: 0.5 + range(r, -0.25, 0.25),
        k: 4 + Math.floor(r() * 5),
        ph: r() * TAU,
      });
    }
  const badges: { x: number; y: number; z: number; ph: number; n: number; flash: number; fn: number }[] = [];
  // ~80 badges, clustered on the turbines nearest the middle of the table.
  const byDist = [...turbines].sort((a, b) => Math.hypot(a.x * 0.8, a.z) - Math.hypot(b.x * 0.8, b.z));
  const perTurbine = byDist.map((_, i): number => (i < 20 ? 3 : i < 30 ? 2 : 0));
  let total = perTurbine.reduce((a, b) => a + b, 0);
  for (let i = perTurbine.length - 1; total > 80 && i >= 0; i--) if (perTurbine[i] > 0) (perTurbine[i]--, total--);
  for (let ti = 0; ti < byDist.length; ti++) {
    const t = byDist[ti];
    for (let b = 0; b < perTurbine[ti]; b++) {
      const a = r() * TAU;
      const d = range(r, 0.7, 1.7);
      badges.push({
        x: t.x + Math.cos(a) * d,
        y: range(r, 0.35, 1.0),
        z: t.z + Math.sin(a) * d,
        ph: r() * TAU,
        n: 1 + Math.floor(r() * 4),
        flash: r() < 0.25 ? range(r, 0.6, 1.2) : 0,
        fn: 2 + Math.floor(r() * 4),
      });
    }
  }
  return { turbines, badges, r };
})();

const buildGround = () => {
  const r = mulberry32(0x9e1d);
  const fine = new SegList();
  const X0 = -40,
    X1 = 40,
    Z0 = -30,
    Z1 = 26;
  for (let x = X0; x <= X1; x += 1)
    for (let z = Z0; z < Z1; z += 1) fine.add([x, 0, z], [x, 0, z + 1], x % 6 === 0 ? 0.75 : 0.32);
  for (let z = Z0; z <= Z1; z += 1)
    for (let x = X0; x < X1; x += 1) fine.add([x, 0, z], [x + 1, 0, z], z % 6 === 0 ? 0.75 : 0.32);
  // Network: row "roads" through the turbine bases and links between rows.
  const net = new SegList();
  const T = LAYOUT.turbines;
  for (let i = 0; i < T.length; i++) {
    const a = T[i];
    if (i % 8 !== 7) net.add([a.x, 0.01, a.z], [T[i + 1].x, 0.01, T[i + 1].z], 1);
    if (i + 8 < T.length && r() < 0.7) {
      const b = T[i + 8 + (r() < 0.5 ? 0 : i % 8 < 7 ? 1 : 0)];
      net.add([a.x, 0.01, a.z], [b.x, 0.01, b.z], 0.7);
    }
  }
  // Low-poly wire net: each badge foot to its two nearest neighbours.
  const feet = [...LAYOUT.badges.map((b) => [b.x, b.z]), ...T.map((t) => [t.x, t.z])];
  for (let i = 0; i < LAYOUT.badges.length; i++) {
    const [x, z] = feet[i];
    const near = feet
      .map((f, j) => ({ j, d: Math.hypot(f[0] - x, f[1] - z) }))
      .filter((q) => q.j !== i && q.d < 3.5)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const q of near) net.add([x, 0.01, z], [feet[q.j][0], 0.01, feet[q.j][1]], 0.55);
  }
  // Badge stems and small hex footprints.
  for (const b of LAYOUT.badges) {
    net.add([b.x, 0, b.z], [b.x, b.y - 0.25, b.z], 0.9);
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * TAU,
        a1 = ((k + 1) / 6) * TAU;
      net.add([b.x + Math.cos(a0) * 0.45, 0.01, b.z + Math.sin(a0) * 0.45], [b.x + Math.cos(a1) * 0.45, 0.01, b.z + Math.sin(a1) * 0.45], 0.55);
    }
  }
  // Nodes at grid crossings (sparse) and bright ones at the turbine feet.
  const nodes: number[] = [];
  const nsi: number[] = [];
  for (let x = X0; x <= X1; x += 2)
    for (let z = Z0; z <= Z1; z += 2) {
      if (r() < 0.55) continue;
      nodes.push(x, 0.01, z);
      nsi.push(0.8 + r() * 0.6, 0.35 + r() * 0.4);
    }
  for (const t of T) {
    nodes.push(t.x, 0.02, t.z);
    nsi.push(2.2, 1.4);
  }
  return { fine: fine.toArray(), net: net.toArray(), nodes: new Float32Array(nodes), nsi: new Float32Array(nsi) };
};
const GROUND = buildGround();

// The point wave: a grid laid out along the camera's own axes, in the lower-left foreground.
const WAVE_NX = 150,
  WAVE_NZ = 80;
const WAVE_W = 16,
  WAVE_D = 9,
  WAVE_BASE = 1.0;
const WAVE = (() => {
  // Where the lower-left of the view meets a plane just above the table.
  const camera = new PerspectiveCamera(CAM_FOV, 16 / 9, 0.1, 200);
  camera.position.copy(CAM_C);
  camera.rotation.copy(CAM_EULER);
  camera.updateMatrixWorld(true);
  const ray = new Vector3(-0.45, -0.75, 0.5).unproject(camera).sub(camera.position).normalize();
  const tHit = (camera.position.y - WAVE_BASE) / -ray.y;
  const c = camera.position.clone().addScaledVector(ray, tHit);
  const pos = new Float32Array(WAVE_NX * WAVE_NZ * 3);
  const si = new Float32Array(WAVE_NX * WAVE_NZ * 2);
  const W = WAVE_W,
    D = WAVE_D;
  const r = mulberry32(0x3a7e);
  for (let j = 0; j < WAVE_NZ; j++)
    for (let i = 0; i < WAVE_NX; i++) {
      const u = (i / (WAVE_NX - 1) - 0.5) * W + range(r, -0.04, 0.04);
      const v = (j / (WAVE_NZ - 1) - 0.5) * D + range(r, -0.04, 0.04);
      const p = c.clone().addScaledVector(RIGHT_H, u).addScaledVector(FWD_H, v);
      const k = j * WAVE_NX + i;
      pos.set([p.x, 0, p.z], k * 3);
      // Wave strength: high at the left/front, dying out toward the right and the table.
      // Soft edges all round (no hard rectangle), fading out to the right.
      const fu = i / (WAVE_NX - 1),
        fv = j / (WAVE_NZ - 1);
      const sm = (a: number, b: number, x: number) => {
        const q = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return q * q * (3 - 2 * q);
      };
      const edge = sm(0, 0.12, fu) * sm(1, 0.55, fu) * sm(0, 0.2, fv) * sm(1, 0.6, fv);
      si.set([0.8 + r() * 0.6, edge * (0.7 + r() * 0.5)], k * 2);
    }
  const segs = new SegList();
  const P = (i: number, j: number) => {
    const k = (j * WAVE_NX + i) * 3;
    return [pos[k], pos[k + 1], pos[k + 2]];
  };
  const E = (i: number, j: number) => si[(j * WAVE_NX + i) * 2 + 1];
  for (let j = 0; j < WAVE_NZ; j += 2)
    for (let i = 0; i < WAVE_NX - 1; i++) segs.add(P(i, j), P(i + 1, j), 0.5 * E(i, j), 0.5 * E(i + 1, j));
  for (let i = 0; i < WAVE_NX; i += 3)
    for (let j = 0; j < WAVE_NZ - 1; j++) segs.add(P(i, j), P(i, j + 1), 0.35 * E(i, j), 0.35 * E(i, j + 1));
  return { pos, si, segs: segs.toArray(), centre: c };
})();

const SNOISE4 = /* glsl */ `
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
float permute(float x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p, s;
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
  return p;
}
float snoise(vec4 v) {
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  vec4 i = floor(v + dot(v, vec4(0.309016994374947451)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute(permute(permute(permute(
        i.w + vec4(i1.w, i2.w, i3.w, 1.0))
      + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
      + i.y + vec4(i1.y, i2.y, i3.y, 1.0))
      + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 nrm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= nrm.x; p1 *= nrm.y; p2 *= nrm.z; p3 *= nrm.w;
  p4 *= taylorInvSqrt(dot(p4, p4));
  vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
  m0 = m0 * m0; m1 = m1 * m1;
  return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2))) + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
}
`;

// Height of the wave: 4D simplex noise with time running round a circle, so
// phase 1 equals phase 0 exactly; plus a travelling swell with whole cycles.
const WAVE_GLSL = /* glsl */ `
uniform float uPhase; uniform vec3 uWaveC; uniform vec3 uWaveR; uniform vec3 uWaveF;
${SNOISE4}
float waveH(vec3 p) {
  float a = 6.28318530718 * uPhase;
  vec2 tc = vec2(cos(a), sin(a)) * 0.9;
  vec3 d = p - uWaveC;
  float u = dot(d, uWaveR), v = dot(d, uWaveF);
  float n = snoise(vec4(u * 0.12, v * 0.16, tc)) * 1.4 + snoise(vec4(u * 0.26 + 3.1, v * 0.3, tc * 1.6)) * 0.4;
  n = n + 0.6 * (1.0 - abs(snoise(vec4(u * 0.2 + 7.0, v * 0.12, tc * 1.3)))) - 0.3; // ridges
  float swell = 0.7 * sin(u * 0.38 + v * 0.15 - a);
  float strength = clamp(1.0 - (u + ${(WAVE_W / 2).toFixed(2)}) / ${(WAVE_W * 0.9).toFixed(1)}, 0.2, 1.0);
  return ${WAVE_BASE.toFixed(2)} + (n * 1.3 + swell) * strength;
}
`;
const WAVE_POINT_CHUNK = `${WAVE_GLSL}
vec3 xform(vec3 p) { return vec3(p.x, waveH(p), p.z); }
// Crests glow brighter than troughs.
float pointVisible(vec3 p0, vec3 p) { float c = smoothstep(${(WAVE_BASE - 0.8).toFixed(2)}, ${(WAVE_BASE + 1.6).toFixed(2)}, p.y); return 0.15 + 1.6 * c * c; }
`;
const WAVE_LINE_CHUNK = `${WAVE_GLSL}
vec3 xform(vec3 p) { return vec3(p.x, waveH(p), p.z); }
float segVisible(vec3 a0, vec3 b0, vec3 a, vec3 b) { return 1.0; }
`;

// --- textures -------------------------------------------------------------------

const hexPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 6;
    const x = cx + Math.cos(a) * r * 1.12,
      y = cy + Math.sin(a) * r;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
};

const drawBadge = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.fillStyle = "rgba(255,0,0,0.1)";
  hexPath(ctx, w / 2, h / 2, h * 0.38);
  ctx.fill();
  ctx.strokeStyle = "#f00";
  ctx.lineWidth = h * 0.045;
  hexPath(ctx, w / 2, h / 2, h * 0.38);
  ctx.stroke();
  ctx.fillStyle = "#0f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${h * 0.4}px "${FONT_BADGE}"`;
  ctx.fillText("AI", w / 2, h * 0.52);
};

const PANEL_ROWS = ["LOAD", "WIND", "ROTOR", "PITCH", "TEMP", "YAW"];
const drawPanel = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const s = w / 1024;
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.03;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 4 * s;
  ctx.strokeRect(10 * s, 10 * s, w - 20 * s, h - 20 * s);
  // Corner brackets.
  ctx.lineWidth = 10 * s;
  for (const [x, y, dx, dy] of [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [0, h, 1, -1],
    [w, h, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * 70 * s, y + dy * 4 * s);
    ctx.lineTo(x + dx * 4 * s, y + dy * 4 * s);
    ctx.lineTo(x + dx * 4 * s, y + dy * 70 * s);
    ctx.stroke();
  }
  ctx.textBaseline = "middle";
  ctx.font = `500 ${78 * s}px "${FONT_HUD}"`;
  ctx.fillText("STATION 04", 60 * s, 110 * s);
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(60 * s, 175 * s);
  ctx.lineTo(w - 60 * s, 175 * s);
  ctx.stroke();
  ctx.font = `500 ${50 * s}px "${FONT_HUD}"`;
  PANEL_ROWS.forEach((l, i) => {
    ctx.globalAlpha = 0.75;
    ctx.fillText(l, 60 * s, (250 + i * 92) * s);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(60 * s, (290 + i * 92) * s, w - 120 * s, 2 * s);
  });
  ctx.globalAlpha = 1;
  // Chart frame + ticks.
  const cy0 = 860 * s,
    cy1 = h - 70 * s;
  ctx.lineWidth = 3 * s;
  ctx.strokeRect(60 * s, cy0, w - 120 * s, cy1 - cy0);
  for (let k = 0; k <= 10; k++) {
    const x = 60 * s + ((w - 120 * s) * k) / 10;
    ctx.beginPath();
    ctx.moveTo(x, cy1);
    ctx.lineTo(x, cy1 + 18 * s);
    ctx.stroke();
  }
};

const drawGauge = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const c = w / 2;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = w * 0.02;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(c, c, w * 0.44, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(c, c, w * 0.3, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = w * 0.012;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * TAU;
    const r0 = w * 0.395,
      r1 = w * (k % 4 === 0 ? 0.35 : 0.37);
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    ctx.stroke();
  }
};

const drawEmblem = (ctx: CanvasRenderingContext2D, w: number) => {
  const c = w / 2;
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.arc(c, c, w * 0.36, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = w * 0.014;
  ctx.beginPath();
  ctx.arc(c, c, w * 0.36, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.arc(c, c, w * 0.3, 0, TAU);
  ctx.stroke();
  hexPath(ctx, c, c, w * 0.2);
  ctx.lineWidth = w * 0.012;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${w * 0.2}px "${FONT_BADGE}"`;
  ctx.fillText("AI", c, c * 1.03);
};

const drawEmblemRing = (ctx: CanvasRenderingContext2D, w: number) => {
  const c = w / 2;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = w * 0.02;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    ctx.globalAlpha = k % 3 === 0 ? 1 : 0.5;
    ctx.beginPath();
    ctx.arc(c, c, w * 0.45, a + 0.06, a + TAU / 12 - 0.06);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = w * 0.008;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * TAU;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * w * 0.41, c + Math.sin(a) * w * 0.41);
    ctx.lineTo(c + Math.cos(a) * w * 0.395, c + Math.sin(a) * w * 0.395);
    ctx.stroke();
  }
};

/** Value of a ticker that steps every `period` frames (period divides 600). */
const ticker = (frame: number, period: number, seed: number) => {
  const steps = LOOP / period;
  const s = Math.floor((((frame % LOOP) + LOOP) % LOOP) / period) % steps;
  return hash01(seed * 7919 + s);
};

// --- the look ---------------------------------------------------------------------

export const createAigrid =
  (pal: AigridPalette): LookFactory =>
  (gl) => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(CAM_FOV, 16 / 9, 0.1, 300);
    scene.add(camera);
    const gridC = lin(pal.grid),
      turbC = lin(pal.turbine),
      badgeC = lin(pal.badge),
      waveC = lin(pal.wave),
      hudC = lin(pal.hud);
    void hudC; // pale HUD tint kept in the palette for colourways; HUD lines use the turbine cyan
    const fog: [number, number] = [26, 48];
    const res: { setRes: (w: number, h: number) => void }[] = [];

    // Table top: depth only, so empty pixels get the table's distance for the DoF.
    const tableDepth = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: `precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; in vec3 position; out float vD;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; in float vD; out vec4 o; void main() { o = vec4(vD, 0, 0, 1); }`,
      blending: NoBlending,
    });
    const table = new Mesh(new PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new MeshBasicMaterial());
    table.userData.depthMat = tableDepth;
    table.userData.depthOnly = true;
    table.frustumCulled = false;
    scene.add(table);

    const fine = new LineBatch(GROUND.fine, { color: gridC, width: 0.8, opacity: 0.38, fog, depth: true });
    const net = new LineBatch(GROUND.net, { color: gridC, width: 1.3, opacity: 0.95, fog, depth: true });
    const nodes = new PointBatch(GROUND.nodes, GROUND.nsi, { color: gridC, size: 2.6, opacity: 1.3, core: 0.6, fog, depth: true });
    scene.add(fine.mesh, net.mesh, nodes.points);
    res.push(fine, net, nodes);

    // Turbines.
    const towerB = new LineBatch(TURB.tower.toArray(), { color: turbC, width: 1.0, opacity: 0.85, fog, depth: true });
    const rotorB = new LineBatch(TURB.rotor.toArray(), { color: turbC, width: 1.1, opacity: 1.0, fog, depth: true });
    res.push(towerB, rotorB);
    const hubs = LAYOUT.turbines.map((t) => {
      const g = new Group();
      g.position.set(t.x, 0, t.z);
      g.rotation.y = t.yaw;
      g.scale.setScalar(T_SCALE);
      const hub = new Object3D();
      hub.position.copy(TURBINE.hub);
      hub.add(rotorB.instance());
      g.add(towerB.instance(), hub);
      scene.add(g);
      return { t, hub };
    });

    // Badges.
    const badgeTex = canvasTexture(256, 256, drawBadge);
    const badges = new SpriteBatch(LAYOUT.badges.length, badgeTex, badgeC, { opacity: 1, fog, depth: true, color2: turbC });
    LAYOUT.badges.forEach((b, i) => {
      badges.pos.set([b.x, b.y, b.z], i * 3);
      badges.size.set([0.8, 0.8], i * 2);
    });
    scene.add(badges.mesh);

    // Point wave.
    const waveU = () => ({
      uPhase: { value: 0 },
      uWaveC: { value: WAVE.centre.toArray() },
      uWaveR: { value: RIGHT_H.toArray() },
      uWaveF: { value: FWD_H.toArray() },
    });
    const waveUniforms = waveU();
    const wavePts = new PointBatch(WAVE.pos, WAVE.si, { color: waveC, size: 2.6, opacity: 5.0, core: 0.6, chunk: WAVE_POINT_CHUNK, uniforms: waveUniforms, depth: true });
    const waveLines = new LineBatch(WAVE.segs, { color: waveC, width: 0.9, opacity: 2.2, chunk: WAVE_LINE_CHUNK, uniforms: waveUniforms, depth: false });
    scene.add(wavePts.points, waveLines.mesh);
    res.push(wavePts, waveLines);

    // HUD, attached to the camera and tilted like the table.
    const atlas = glyphAtlas(FONT_HUD);
    const hud = new Group();
    hud.position.set(0, 0, 0);
    camera.add(hud);
    const tilt = -0.55;
    // Right panel.
    const panelTex = canvasTexture(1024, 1536, drawPanel);
    const panel = texturedPlane(panelTex, 3.1, 4.65, turbC, 1.0, true);
    panel.mesh.position.set(5.0, 0.9, -13.5);
    panel.mesh.rotation.set(tilt, -0.32, 0.06);
    hud.add(panel.mesh);
    const panelText = new SpriteBatch(80, atlas, turbC, { opacity: 1.4, planar: true, depth: true });
    panel.mesh.add(panelText.mesh);
    const panelWriter = new GlyphWriter(panelText, glyphRows());
    const chartMax = 64;
    const chart = new LineBatch(new Float32Array(0), { color: turbC, width: 1.4, opacity: 1.0, maxSegments: chartMax, depth: true });
    panel.mesh.add(chart.mesh);
    res.push(chart);
    // Left gauges.
    const gaugeTex = canvasTexture(256, 256, drawGauge);
    const gauges = [0, 1, 2, 3].map((i) => {
      const g = texturedPlane(gaugeTex, 1.25, 1.25, turbC, 1.0, true);
      g.mesh.position.set(-5.7 + (i % 2) * 1.4, 0.2 - Math.floor(i / 2) * 1.4 + (i % 2) * 0.2, -13);
      g.mesh.rotation.set(tilt, 0.3, 0.05);
      hud.add(g.mesh);
      const txt = new SpriteBatch(6, atlas, turbC, { opacity: 1.5, planar: true, depth: true });
      g.mesh.add(txt.mesh);
      const arc = new LineBatch(new Float32Array(0), { color: turbC, width: 4.0, opacity: 1.6, maxSegments: 48, depth: true });
      g.mesh.add(arc.mesh);
      res.push(arc);
      return { g, writer: new GlyphWriter(txt, glyphRows()), arc };
    });
    // Top emblem.
    const emblemTex = canvasTexture(512, 512, (ctx, w) => drawEmblem(ctx, w));
    const emblem = texturedPlane(emblemTex, 3.2, 3.2, turbC, 1.1, true);
    emblem.mesh.position.set(2.0, 3.2, -14);
    emblem.mesh.rotation.set(tilt, 0, 0.04);
    hud.add(emblem.mesh);
    const ringTex = canvasTexture(512, 512, (ctx, w) => drawEmblemRing(ctx, w));
    const ring = texturedPlane(ringTex, 3.2, 3.2, turbC, 0.7, true);
    ring.mesh.position.z = 0.01;
    emblem.mesh.add(ring.mesh);

    const pipeline = new Pipeline(gl, {
      msaa: 0,
      dof: true,
      bloomStrength: 0.3,
      bloomLevelWeights: [0.6, 0.8, 1, 1, 0.9, 0.7],
      exposure: 0.95,
      vignette: 0.3,
      grain: 0.015,
      composite: {
        background: /* glsl */ `
uniform vec3 uBgDeep, uBgLight;
vec3 background(vec2 uv) {
  float k = smoothstep(0.1, 1.1, uv.y * 0.8 + (1.0 - uv.x) * 0.1);
  vec2 d = (uv - vec2(0.5, 0.7)) * vec2(uAspect, 1.0);
  k += 0.3 * exp(-dot(d, d) / 0.25);
  return mix(uBgDeep, uBgLight, clamp(k, 0.0, 1.0));
}`,
        extraUniforms: { uBgDeep: { value: hexToSrgb(pal.bgDeep) }, uBgLight: { value: hexToSrgb(pal.bgLight) } },
      },
    });

    const size = new Vector2();
    const chartSegs = new Float32Array(chartMax * SEG_STRIDE);
    const arcSegs = new Float32Array(48 * SEG_STRIDE);

    const render = (frame: number) => {
      gl.getDrawingBufferSize(size);
      res.forEach((b) => b.setRes(size.x, size.y));
      const f = ((frame % LOOP) + LOOP) % LOOP;
      const t = f / LOOP;

      camera.position.copy(camAt(t));
      camera.rotation.set(CAM_EULER.x + 0.015 * Math.sin(TAU * t + 0.3), CAM_EULER.y + 0.03 * Math.sin(TAU * t), CAM_EULER.z, "YXZ");
      camera.aspect = size.x / size.y;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      for (const h of hubs) h.hub.rotation.z = h.t.ph + (TAU / 3) * h.t.k * t;

      LAYOUT.badges.forEach((b, i) => {
        const p = 0.5 + 0.5 * Math.sin(TAU * b.n * t + b.ph);
        const flash = b.flash * Math.pow(0.5 + 0.5 * Math.cos(TAU * b.fn * t + b.ph * 1.7), 60);
        badges.inten[i] = 0.75 + 0.6 * p * p + flash * 1.3;
        badges.size.set([0.8 + 0.1 * flash, 0.8 + 0.1 * flash], i * 2);
      });
      badges.commit();

      waveUniforms.uPhase.value = t;

      // HUD values on step schedules (periods divide 600).
      panelWriter.begin();
      const periods = [20, 30, 40, 50, 60, 75];
      PANEL_ROWS.forEach((_, i) => {
        const v = ticker(f, periods[i], 100 + i);
        const val = i === 0 ? (40 + v * 20).toFixed(2) : i === 1 ? (6 + v * 9).toFixed(2) : i === 2 ? (10 + v * 6).toFixed(1) : i === 3 ? (v * 12).toFixed(2) : i === 4 ? (31 + v * 9).toFixed(1) : (180 + v * 160).toFixed(1);
        panelWriter.text(val.padStart(7, " "), 0.25, 4.65 / 2 - (250 + i * 92) * (4.65 / 1536), 0.17, 0.95);
      });
      panelWriter.text(`OUTPUT ${(48 + ticker(f, 25, 9) * 10).toFixed(2)}`, -1.32, -4.65 / 2 + 0.95 * 4.65 * (1 - 820 / 1536) - 4.65 * 0.0, 0.14, 0.9);
      panelWriter.end();
      // Mini area chart: data shift every 30 frames (20 steps per loop).
      const cx0 = -1.55 + 60 * (3.1 / 1024),
        cx1 = 1.55 - 60 * (3.1 / 1024),
        cy0 = -4.65 / 2 + 70 * (4.65 / 1536),
        cy1 = 4.65 / 2 - 860 * (4.65 / 1536);
      const s = Math.floor(f / 30);
      const N = 20;
      let n = 0;
      const val = (k: number) => {
        const q = (k + s) % N;
        return 0.25 + 0.45 * (0.5 + 0.5 * Math.sin((q / N) * TAU * 2 + 0.6)) + 0.25 * hash01(q * 31 + 7);
      };
      for (let k = 0; k < N; k++) {
        const x0 = cx0 + ((cx1 - cx0) * k) / (N - 1),
          x1 = cx0 + ((cx1 - cx0) * (k + 1)) / (N - 1);
        const y0 = cy0 + (cy1 - cy0) * val(k);
        const o = n * SEG_STRIDE;
        if (k < N - 1) {
          const y1 = cy0 + (cy1 - cy0) * val(k + 1);
          chartSegs.set([x0, y0, 0.002, x1, y1, 0.002, 1, 1], o);
          n++;
        }
        chartSegs.set([x0, cy0, 0.002, x0, y0, 0.002, 0.25, 0.4], n * SEG_STRIDE); // area fill hatching
        n++;
      }
      chart.setSegments(chartSegs, n);

      gauges.forEach((g, i) => {
        const v = ticker(f, [50, 60, 75, 100][i], 300 + i);
        const frac = 0.2 + 0.75 * v;
        const segs = 40;
        const m = Math.max(1, Math.round(segs * frac));
        for (let k = 0; k < m; k++) {
          const a0 = Math.PI / 2 - (k / segs) * TAU,
            a1 = Math.PI / 2 - ((k + 1) / segs) * TAU;
          const R = 1.25 * 0.42;
          arcSegs.set([Math.cos(a0) * R, Math.sin(a0) * R, 0.002, Math.cos(a1) * R, Math.sin(a1) * R, 0.002, 1, 1], k * SEG_STRIDE);
        }
        g.arc.setSegments(arcSegs, m);
        g.writer.begin();
        g.writer.text(String(Math.round(frac * 100)).padStart(2, "0") + "%", -0.27, 0, 0.2, 1);
        g.writer.end();
      });
      ring.mesh.rotation.z = -TAU * t;

      pipeline.render({
        scene,
        camera,
        frame,
        grainPeriod: LOOP,
        dof: { focus: FOCUS, aperture: 0.024, maxCoc: 0.016, far: 300 },
      });
    };

    return {
      render,
      dispose: () => {
        pipeline.dispose();
        [fine, net, nodes, towerB, rotorB, wavePts, waveLines, chart].forEach((b) => b.dispose());
        badges.dispose();
        [badgeTex, panelTex, gaugeTex, emblemTex, ringTex, atlas].forEach((x) => x.dispose());
      },
    };
  };
