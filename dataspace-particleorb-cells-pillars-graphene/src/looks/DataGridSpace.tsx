import { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { hash01, mulberry32, phaseOf, TAU } from "../lib/random";
import { BG_VERT, CameraPose, ThreeStage } from "../three/ThreeStage";
import { useBufferSize } from "../three/useBuffer";
import type { DataGridPalette } from "../versions";

// The space is periodic in depth: every object's distance ahead of the camera
// is d = mod(d0 - shift, DEPTH) + D_MIN, and the camera advances exactly one
// DEPTH in 600 frames, so frame 600 == frame 0.
const DEPTH = 48;
const D_MIN = 0.6;
const HALF_W = 26;
const HALF_H = 15;

const N_POINTS = 4000;
const N_RADIAL = 600;
const N_TRACES = 1400;
const N_BLOCKS = 80;
const N_STREAKS = 6;
const HOLDS = [10, 12, 15, 20, 24, 25, 30, 40, 50, 60]; // all divide 600

// ---- Layout (module level, seeded) -------------------------------------
type Seg = { a: [number, number, number]; b: [number, number, number]; color: [number, number, number, number]; width: number; mode: number };

const LAYOUT = (() => {
  const rnd = mulberry32(869833972);
  const xy = (spread = 1): [number, number] => {
    // denser toward the middle band, like the reference
    const x = (rnd() * 2 - 1) * HALF_W * spread;
    const y = (Math.pow(rnd(), 1.25) * (rnd() < 0.5 ? -1 : 1)) * HALF_H * spread;
    return [x, y];
  };
  const points: { x: number; y: number; d: number; size: number; tint: number }[] = [];
  const segs: Seg[] = [];
  // radial lines: parallel to the camera axis -> converge on the vanishing point
  for (let i = 0; i < N_RADIAL; i++) {
    const [x, y] = xy();
    const d0 = rnd() * DEPTH;
    const len = 1.5 + Math.pow(rnd(), 1.8) * 12;
    const a = 0.15 + rnd() * 0.25;
    segs.push({ a: [x, y, d0], b: [0, 0, len], color: [rnd() * 0.6, 1, 1, a], width: 0.9 + rnd() * 0.9, mode: 0 });
    // a dot riding on many of them
    if (rnd() < 0.55) points.push({ x, y, d: rnd() < 0.5 ? d0 : d0 + len, size: 0.75 + rnd() * 0.25, tint: rnd() });
  }
  // circuit-like traces: short x / y oriented segments, sometimes L-shaped
  for (let i = 0; i < N_TRACES; i++) {
    const [xr, y] = xy(0.95);
    const x = rnd() < 0.7 ? Math.abs(xr) * 0.8 - 2 : xr;
    const d0 = rnd() * DEPTH;
    const len = 0.5 + Math.pow(rnd(), 1.5) * 5.5;
    const horiz = rnd() < 0.6;
    const a = 0.12 + rnd() * 0.25;
    segs.push({ a: [x, y, d0], b: horiz ? [len, 0, 0] : [0, len, 0], color: [rnd() * 0.7, 1, 1, a], width: 0.9 + rnd() * 0.5, mode: 0 });
    if (rnd() < 0.4) {
      const l2 = 0.3 + rnd() * 2;
      segs.push({ a: [x + (horiz ? len : 0), y + (horiz ? 0 : len), d0], b: horiz ? [0, l2, 0] : [l2, 0, 0], color: [0.3, 1, 1, a], width: 0.9, mode: 0 });
    }
    if (rnd() < 0.45) points.push({ x, y, d: d0, size: 0.7 + rnd() * 0.3, tint: rnd() });
  }
  // grid planes: faint horizontal/vertical line grids at 3 depths
  for (let g = 0; g < 3; g++) {
    const d0 = (g + 0.3) * (DEPTH / 3);
    const step = 2.4;
    for (let x = -HALF_W; x <= HALF_W + 1e-6; x += step) segs.push({ a: [x, -HALF_H, d0], b: [0, 2 * HALF_H, 0], color: [0.2, 1, 1, 0.03], width: 0.8, mode: 1 });
    for (let y = -HALF_H; y <= HALF_H + 1e-6; y += step) segs.push({ a: [-HALF_W, y, d0], b: [2 * HALF_W, 0, 0], color: [0.2, 1, 1, 0.03], width: 0.8, mode: 1 });
  }
  // free points
  while (points.length < N_POINTS) {
    const [x, y] = xy(1.05);
    points.push({ x, y, d: rnd() * DEPTH, size: Math.pow(rnd(), 2.5) * 0.45, tint: rnd() });
  }
  const blocks = Array.from({ length: N_BLOCKS }, (_, i) => {
    const [x0, y] = xy(0.45);
    const x = Math.abs(x0) * (rnd() < 0.8 ? 1 : -1); // mostly right of the vanishing point
    return {
      x, y, d: rnd() * DEPTH,
      w: 0.14 + rnd() * 0.2, h: 0.07 + rnd() * 0.07,
      // 0 = white, 1 = blue, 2 = amber, 3 = red
      kind: rnd() < 0.55 ? 0 : (() => { const k = rnd(); return k < 0.2 ? 1 : k < 0.6 ? 2 : 3; })(),
      hold: HOLDS[Math.floor(rnd() * HOLDS.length)],
      duty: 0.35 + rnd() * 0.4,
      seed: i * 7919 + 13,
    };
  });
  const streaks = Array.from({ length: N_STREAKS }, (_, i) => {
    const ang = rnd() * TAU;
    const r = 2 + rnd() * 6;
    return { x: Math.cos(ang) * r * 1.6, y: Math.sin(ang) * r * 0.8, start: Math.floor((i + rnd() * 0.6) * (600 / N_STREAKS)), dur: 14 + Math.floor(rnd() * 10) };
  });
  return { points, segs, blocks, streaks };
})();

// ---- Shaders ------------------------------------------------------------
const DEPTH_GLSL = /* glsl */ `
uniform float uShift;
uniform vec2 uRes;
const float DEPTH = ${DEPTH.toFixed(1)};
const float D_MIN = ${D_MIN.toFixed(2)};
float wrapD(float d0){ return mod(d0 - uShift, DEPTH) + D_MIN; }
float depthFade(float d){ return smoothstep(D_MIN, D_MIN + 3.0, d) * (1.0 - smoothstep(D_MIN + DEPTH - 14.0, D_MIN + DEPTH - 0.5, d)); }
`;

const POINT_VERT = /* glsl */ `
${DEPTH_GLSL}
in float aSize; in float aTint;
out float vAlpha; out float vTint; out float vPx;
void main(){
  float d = wrapD(position.z);
  vec4 mv = viewMatrix * vec4(position.x, position.y, -d, 1.0);
  gl_Position = projectionMatrix * mv;
  float scale = uRes.y / 720.0;
  float px = clamp((0.8 + aSize * 4.5) * 12.0 / d, 1.0, 4.0) * scale;
  vPx = px;
  gl_PointSize = px * 1.8 + 2.0 * scale; // room for the soft edge / halo
  vAlpha = depthFade(d) * clamp(0.3 + 12.0 / d, 0.0, 1.8) * mix(0.18, 1.7, smoothstep(0.4, 0.8, aSize));
  vTint = aTint;
}
`;
const POINT_FRAG = /* glsl */ `
uniform vec3 uPoint; uniform vec3 uPointAlt;
in float vAlpha; in float vTint; in float vPx;
uniform vec2 uRes;
out vec4 fragColor;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q) * (vPx * 1.8 + 2.0 * (uRes.y / 720.0)) * 0.5;      // radius in px
  float a = 1.0 - smoothstep(vPx * 0.5 - 0.6, vPx * 0.5 + 0.6, r);
  a += 0.35 * exp(-r * r / (vPx * vPx * 0.6)) * step(2.5, vPx);
  vec3 c = mix(uPoint, uPointAlt, step(0.7, vTint));
  fragColor = vec4(c * vAlpha * a * 1.9, 1.0);
}
`;

// Instanced screen-space ribbon for line segments.
const SEG_VERT = /* glsl */ `
${DEPTH_GLSL}
in vec3 aA; in vec3 aB; in vec4 aColor; in float aWidth; in float aMode;
// position.x: 0..1 along, position.y: -1..1 across
out vec4 vColor; out float vAcross; out float vHalf;
uniform float uWidthScale;
vec4 proj(vec3 p){ return projectionMatrix * viewMatrix * vec4(p, 1.0); }
void main(){
  float d0 = aMode > 1.5 ? aA.z : wrapD(aA.z);
  vec3 A = vec3(aA.xy, -d0);
  vec3 B = A + vec3(aB.xy, -aB.z);
  if (aMode > 1.5) { A.z = min(A.z, -0.4); B.z = min(B.z, -0.4); }
  // clip the far end of radial lines to stay in front of the camera
  vec3 P = mix(A, B, position.x);
  vec4 ca = proj(A), cb = proj(B), cp = proj(P);
  vec2 sa = ca.xy / ca.w * uRes, sb = cb.xy / cb.w * uRes;
  vec2 dir = normalize(sb - sa + vec2(1e-5, 0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  float scale = uRes.y / 720.0;
  float wpx = aWidth * scale * uWidthScale;           // core width in px
  float half_ = max(wpx, 1.0) * 0.5 + 1.0;            // + AA margin
  cp.xy += nrm * position.y * half_ * 2.0 / uRes * cp.w;
  gl_Position = cp;
  float dP = -P.z;
  float fade = aMode > 1.5 ? smoothstep(0.4, 3.0, dP) : depthFade(dP) * smoothstep(D_MIN, D_MIN + 3.0, -A.z);
  // radial lines fade toward their far end, like light trails
  if (aB.z > 0.0) fade *= mix(1.0, 0.25, position.x);
  // thinner than a pixel -> keep 1px but lower the alpha
  float thin = min(wpx, 1.0);
  vColor = vec4(aColor.rgb, aColor.a * fade * thin * clamp(0.75 + 8.0 / dP, 0.0, 1.5));
  vAcross = position.y * half_;
  vHalf = max(wpx, 1.0) * 0.5;
}
`;
const SEG_FRAG = /* glsl */ `
uniform vec3 uLine;
in vec4 vColor; in float vAcross; in float vHalf;
out vec4 fragColor;
void main(){
  float a = 1.0 - smoothstep(vHalf - 0.5, vHalf + 0.5, abs(vAcross));
  fragColor = vec4(mix(uLine, vec3(1.0), vColor.r) * vColor.a * a, 1.0);
}
`;

const BLOCK_VERT = /* glsl */ `
${DEPTH_GLSL}
in vec3 aPos; in vec2 aSize; in vec3 aCol; in float aOn;
out vec3 vCol; out vec2 vUv; out float vA;
void main(){
  float d = wrapD(aPos.z);
  vec3 p = vec3(aPos.xy + position.xy * aSize, -d);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vCol = aCol; vUv = position.xy; vA = aOn * depthFade(d) * smoothstep(5.0, 10.0, d);
}
`;
const BLOCK_FRAG = /* glsl */ `
in vec3 vCol; in vec2 vUv; in float vA;
out vec4 fragColor;
void main(){
  if (vA <= 0.001) discard;
  vec2 e = abs(vUv) * 2.0;           // 0 center .. 1 edge
  float frame_ = smoothstep(0.62, 0.82, max(e.x, e.y));
  vec3 c = vCol * (0.75 + 0.9 * frame_);
  fragColor = vec4(c * vA * 1.3, 1.0);
}
`;

const BG_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uHorizon; uniform vec3 uBlob;
uniform float uPhase; uniform vec2 uRes;
in vec2 vUv;
out vec4 fragColor;
float line(float y, float c, float px){
  float d = abs(y - c) * uRes.y;
  float s = uRes.y / 720.0;
  return exp(-d * d / (2.0 * 0.9 * 0.9 * s * s)) + 0.3 * exp(-d / (5.0 * s)) + 0.04 * exp(-d / (24.0 * s));
}
void main(){
  vec2 uv = vUv;
  vec3 col = mix(uBottom, uTop, smoothstep(0.0, 0.45, uv.y)) * 0.72;
  // saturated blue tint everywhere and a brighter middle band
  col += vec3(0.0, 0.006, 0.03) + uBlob * 0.06 * exp(-pow((uv.y - 0.5) * 3.2, 2.0));
  // soft blue haze blotches, drifting on closed paths
  float asp = uRes.x / uRes.y;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(0.15 + 0.2 * fi, 0.06 + 0.04 * mod(fi * 2.3, 3.0));
    c += 0.04 * vec2(sin(6.2831853 * uPhase + fi * 1.7), cos(6.2831853 * uPhase + fi * 2.9));
    vec2 q = (uv - c) * vec2(asp, 2.2);
    col += uBlob * 0.18 * exp(-dot(q, q) * 160.0);
  }
  // out-of-focus coloured light spots (red / amber / yellow / green)
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec2 c = vec2(fract(0.37 + fi * 0.618) * 0.6 + 0.38, 0.58 + 0.35 * fract(fi * 0.381 + 0.2));
    c += 0.015 * vec2(sin(6.2831853 * uPhase + fi), cos(6.2831853 * uPhase * 2.0 + fi));
    vec2 q = (uv - c) * vec2(asp, 1.0);
    float rr = 0.004 + 0.006 * fract(fi * 0.71);
    vec3 bc = i % 4 == 0 ? vec3(0.9, 0.08, 0.05) : i % 4 == 1 ? vec3(1.0, 0.45, 0.05) : i % 4 == 2 ? vec3(0.9, 0.8, 0.1) : vec3(0.2, 0.8, 0.25);
    float flick = 0.55 + 0.45 * sin(6.2831853 * (uPhase * float(1 + i % 3) + fi * 0.37));
    col += bc * 0.35 * flick * (1.0 - smoothstep(rr * 0.4, rr, length(q)));
  }
  // two bright horizon lines with a soft glow, travelling sparkles along them
  float s = 0.0;
  for (int k = 0; k < 2; k++) {
    float cy = k == 0 ? 0.25 : 0.75;
    float l = line(uv.y, cy, 1.0);
    float x = uv.x * asp * 6.0 + (k == 0 ? 1.0 : -1.0) * uPhase * 6.0 * 4.0;
    float flick = 0.75 + 0.25 * sin(x * 3.1 + float(k)) * sin(x * 1.3);
    float fadeX = mix(1.0, 0.35, smoothstep(0.25, 1.0, uv.x));
    s += l * flick * fadeX;
  }
  col += uHorizon * s * 0.9;
  fragColor = vec4(col, 1.0);
}
`;

const STREAK_COLOR: [number, number, number, number] = [1.6, 1.8, 1.9, 1];

const Scene: React.FC<{ palette: DataGridPalette; frame: number }> = ({ palette, frame }) => {
  const { w, h } = useBufferSize();
  const p = phaseOf(frame);
  const f = ((frame % 600) + 600) % 600;

  const objs = useMemo(() => {
    const shared = { uShift: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) } };
    const additive = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending };

    // points
    const pg = new THREE.BufferGeometry();
    const pp = new Float32Array(N_POINTS * 3), ps = new Float32Array(N_POINTS), pt = new Float32Array(N_POINTS);
    LAYOUT.points.slice(0, N_POINTS).forEach((q, i) => { pp.set([q.x, q.y, q.d], i * 3); ps[i] = q.size; pt[i] = q.tint; });
    pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    pg.setAttribute("aSize", new THREE.BufferAttribute(ps, 1));
    pg.setAttribute("aTint", new THREE.BufferAttribute(pt, 1));
    const points = new THREE.Points(pg, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, ...additive,
      uniforms: { ...shared, uPoint: { value: new THREE.Color(palette.point) }, uPointAlt: { value: new THREE.Color(palette.pointAlt) } },
    }));
    points.frustumCulled = false;

    // segments (static + streaks share a geometry layout)
    const makeSegs = (list: Seg[], dynamic: boolean) => {
      const quad = new THREE.InstancedBufferGeometry();
      quad.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
      quad.setIndex([0, 1, 2, 0, 2, 3]);
      const n = list.length;
      const A = new Float32Array(n * 3), B = new Float32Array(n * 3), C = new Float32Array(n * 4), W = new Float32Array(n), M = new Float32Array(n);
      list.forEach((s, i) => { A.set(s.a, i * 3); B.set(s.b, i * 3); C.set(s.color, i * 4); W[i] = s.width; M[i] = s.mode; });
      const attrA = new THREE.InstancedBufferAttribute(A, 3), attrC = new THREE.InstancedBufferAttribute(C, 4);
      if (dynamic) { attrA.setUsage(THREE.DynamicDrawUsage); attrC.setUsage(THREE.DynamicDrawUsage); }
      quad.setAttribute("aA", attrA);
      quad.setAttribute("aB", new THREE.InstancedBufferAttribute(B, 3));
      quad.setAttribute("aColor", attrC);
      quad.setAttribute("aWidth", new THREE.InstancedBufferAttribute(W, 1));
      quad.setAttribute("aMode", new THREE.InstancedBufferAttribute(M, 1));
      quad.instanceCount = n;
      const mesh = new THREE.Mesh(quad, new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: SEG_VERT, fragmentShader: SEG_FRAG, ...additive,
        uniforms: { ...shared, uLine: { value: new THREE.Color(palette.line) }, uWidthScale: { value: 1 } },
      }));
      mesh.frustumCulled = false;
      return { mesh, attrA, attrC };
    };
    const segs = makeSegs(LAYOUT.segs, false);
    const streaks = makeSegs(LAYOUT.streaks.map((s) => ({ a: [s.x, s.y, 0], b: [0, 0, 26], color: [0, 0, 0, 0], width: 2.2, mode: 2 })), true);
    (streaks.mesh.material as THREE.ShaderMaterial).uniforms.uLine.value = new THREE.Color("#DFFBFF");
    (streaks.mesh.material as THREE.ShaderMaterial).uniforms.uWidthScale.value = 1;

    // data blocks
    const bq = new THREE.InstancedBufferGeometry();
    bq.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    bq.setIndex([0, 1, 2, 0, 2, 3]);
    const bp = new Float32Array(N_BLOCKS * 3), bs = new Float32Array(N_BLOCKS * 2), bc = new Float32Array(N_BLOCKS * 3);
    const blockCols = [new THREE.Color("#E8F4FF"), ...palette.blocks.map((c) => new THREE.Color(c))];
    LAYOUT.blocks.forEach((b, i) => {
      bp.set([b.x, b.y, b.d], i * 3); bs.set([b.w, b.h], i * 2);
      const c = blockCols[b.kind]; bc.set([c.r, c.g, c.b], i * 3);
    });
    const onAttr = new THREE.InstancedBufferAttribute(new Float32Array(N_BLOCKS), 1);
    onAttr.setUsage(THREE.DynamicDrawUsage);
    bq.setAttribute("aPos", new THREE.InstancedBufferAttribute(bp, 3));
    bq.setAttribute("aSize", new THREE.InstancedBufferAttribute(bs, 2));
    bq.setAttribute("aCol", new THREE.InstancedBufferAttribute(bc, 3));
    bq.setAttribute("aOn", onAttr);
    bq.instanceCount = N_BLOCKS;
    const blocks = new THREE.Mesh(bq, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, ...additive, uniforms: { ...shared } }));
    blocks.frustumCulled = false;

    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthWrite: false, depthTest: false,
      uniforms: {
        uTop: { value: new THREE.Color(palette.bgTop) }, uBottom: { value: new THREE.Color(palette.bgBottom) },
        uHorizon: { value: new THREE.Color(palette.horizon) }, uBlob: { value: new THREE.Color(palette.blocks[0]) },
        uPhase: { value: 0 }, uRes: shared.uRes,
      },
    }));
    bg.frustumCulled = false; bg.renderOrder = -10;
    points.renderOrder = 3; segs.mesh.renderOrder = 1; streaks.mesh.renderOrder = 2; blocks.renderOrder = 4;
    return { shared, points, segs, streaks, blocks, onAttr, bg };
  }, [palette]);

  useLayoutEffect(() => {
    objs.shared.uShift.value = p * DEPTH;
    objs.shared.uRes.value.set(w, h);
    (objs.bg.material as THREE.ShaderMaterial).uniforms.uPhase.value = p;
    // blinking: each block holds its state for `hold` frames; hold divides 600
    const on = objs.onAttr.array as Float32Array;
    LAYOUT.blocks.forEach((b, i) => {
      const slot = Math.floor(f / b.hold) % (600 / b.hold);
      on[i] = hash01(b.seed, slot) < b.duty ? 1 : 0;
    });
    objs.onAttr.needsUpdate = true;
    // streaks: a long bright line whipping toward the camera during its window
    const A = objs.streaks.attrA.array as Float32Array;
    const C = objs.streaks.attrC.array as Float32Array;
    LAYOUT.streaks.forEach((s, i) => {
      const local = (((f - s.start) % 600) + 600) % 600; // frames since start, wraps
      const u = local / s.dur;
      const vis = u >= 0 && u <= 1 ? Math.sin(Math.PI * u) : 0;
      // its depth in the moving space: start far, end behind the camera
      const dWorld = 60 - u * 75;
      A[i * 3] = s.x; A[i * 3 + 1] = s.y;
      A[i * 3 + 2] = dWorld; // streaks (mode 2) are not depth-wrapped
      C.set([STREAK_COLOR[0], STREAK_COLOR[1], STREAK_COLOR[2], vis], i * 4);
    });
    objs.streaks.attrA.needsUpdate = true; objs.streaks.attrC.needsUpdate = true;
  }, [objs, p, f, w, h]);

  return (
    <>
      <primitive object={objs.bg} />
      <primitive object={objs.segs.mesh} />
      <primitive object={objs.streaks.mesh} />
      <primitive object={objs.points} />
      <primitive object={objs.blocks} />
    </>
  );
};

export const DataGridSpace: React.FC<{ palette: DataGridPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const p = phaseOf(frame);
  const roll = (1 * Math.PI) / 180 * Math.sin(TAU * p);
  const camera: CameraPose = useMemo(() => ({
    fov: 62, position: [0, 0, 0], target: [-4.2, 0.2, -10], roll, near: 0.2, far: 120,
  }), [roll]);
  const post = useMemo(() => ({
    focus: 9, range: 22, nearRange: 5, sharpZone: 3, maxBlur: 7, farMax: 0.5,
    bloomStrength: 0.55, bloomThreshold: 0.55, bloomRadius: 1.4, grain: 0.015, vignette: 0.3,
  }), []);
  return (
    <ThreeStage camera={camera} post={post}>
      <Scene palette={palette} frame={frame} />
    </ThreeStage>
  );
};
