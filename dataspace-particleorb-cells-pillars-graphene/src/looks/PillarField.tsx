import { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { mulberry32, phaseOf, TAU } from "../lib/random";
import { BG_VERT, CameraPose, ThreeStage } from "../three/ThreeStage";
import type { PillarPalette } from "../versions";

const N = 24;
const PITCH = 1;
const TILE = 0.94; // 6% gap
const BASE_H = 0.14;

type Pillar = { x: number; z: number; hMax: number; sweep: number; jitter: number; bobPh: number; bobAmp: number; sideMix: number; topMix: number; shade: number };

// Layout generated once at module load from a fixed seed.
const PILLARS: Pillar[] = (() => {
  const rnd = mulberry32(240117);
  const out: Pillar[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = (i - (N - 1) / 2) * PITCH;
      const z = (j - (N - 1) / 2) * PITCH;
      const r = rnd();
      // many low steps, some tall towers
      // stepped skyline: a smooth field across the grid plus per-pillar
      // variation, quantised to half-tile steps (staircase rows)
      const field = 4.4 + 2.2 * Math.sin(i * 0.42 + 0.7) * Math.cos(j * 0.36 - 0.2) + 0.7 * Math.sin((i - j) * 0.5);
      const raw = r < 0.15 ? 0.25 : field + (rnd() - 0.4) * 1.6;
      const hMax = Math.min(8, Math.max(0.25, Math.round(raw * 2) / 2));
      out.push({
        x, z, hMax,
        // the rise wave travels across the grid diagonally
        sweep: ((i + j) / (2 * (N - 1))),
        jitter: rnd(),
        bobPh: rnd(),
        bobAmp: 0.04 + rnd() * 0.06,
        sideMix: rnd(),
        // patches: a smooth field over the grid plus per-tile variation
        topMix: Math.min(1, Math.max(0, 0.5 + 0.38 * Math.sin(i * 0.55 + 1.3) * Math.cos(j * 0.47 - 0.4) + 0.28 * Math.sin((i + j) * 0.31) + (rnd() - 0.5) * 0.55)),
        shade: rnd(),
      });
    }
  }
  return out;
})();

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10); // smootherstep (C2 eased)
};

/** Height of a pillar at loop time t (seconds, 0..20). Flat at 0-2s and 17-20s. */
export const pillarHeight = (p: Pillar, t: number) => {
  const RISE = 1.6;
  const start = 2 + (p.sweep * 0.82 + p.jitter * 0.18) * (5 - RISE); // 2s .. 5.4s, done by 7s
  const fall = 12 + (p.sweep * 0.82 + p.jitter * 0.18) * (5 - RISE); // 12s .. 15.4s, done by 17s
  const env = smooth((t - start) / RISE) - smooth((t - fall) / RISE);
  // gentle bobbing during the hold, windowed to zero outside 6.5-13s
  const w = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 6.5) / 6.5)));
  const bob = 1 + p.bobAmp * w * w * Math.sin(TAU * (2 * (t - 6.5) / 6.5 + p.bobPh));
  return BASE_H + p.hMax * env * bob;
};

const VERT = /* glsl */ `
in vec2 aOffset;
in float aHeight;
in vec3 aSide;
in vec3 aTop;
in float aShade;
uniform float uTile;
out vec3 vLocal;     // local box coords scaled to world units, y from 0..h
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSide;
out vec3 vTop;
out float vH;
out float vShade;
void main(){
  vec3 lp = vec3(position.x * uTile, (position.y + 0.5) * aHeight, position.z * uTile);
  vLocal = lp;
  vH = aHeight;
  vec3 wp = vec3(lp.x + aOffset.x, lp.y, lp.z + aOffset.y);
  vWorld = wp;
  vNormal = normal;
  vSide = aSide; vTop = aTop; vShade = aShade;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uTrim;
uniform vec3 uLightDir;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform float uTile;
in vec3 vLocal; in vec3 vWorld; in vec3 vNormal; in vec3 vSide; in vec3 vTop; in float vH; in float vShade;
out vec4 fragColor;
void main(){
  vec3 n = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float hw = uTile * 0.5;
  // distance to the nearest box edge lying on this face
  float dx = hw - abs(vLocal.x);
  float dy = min(vLocal.y, vH - vLocal.y);
  float dz = hw - abs(vLocal.z);
  float e;
  if (abs(n.y) > 0.5) e = min(dx, dz);
  else if (abs(n.x) > 0.5) e = min(dy, dz);
  else e = min(dx, dy);
  float aa = fwidth(e) * 1.0 + 1e-5;
  float trimW = 0.04;
  float trim = 1.0 - smoothstep(trimW - aa, trimW + aa, e);
  // slight bevel: tilt the normal inside the trim band so edges catch light
  vec3 nb = n;
  if (trim > 0.0) {
    vec3 out_ = vec3(sign(vLocal.x) * step(dx, 0.06), sign(vLocal.y - vH * 0.5) * step(dy, 0.06), sign(vLocal.z) * step(dz, 0.06));
    nb = normalize(n + out_ * 0.7 * trim);
  }
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + V);
  float ndl = max(dot(nb, L), 0.0);
  vec3 R = reflect(-V, nb);
  vec3 env = mix(uSkyHorizon, uSkyTop, smoothstep(-0.1, 0.8, R.y));
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(nb, V), 0.0), 5.0);

  // face base colour
  vec3 base;
  float ao = 1.0;
  if (n.y > 0.5) {
    base = vTop * 1.05;
    ndl = max(ndl, 0.75);
  } else {
    // sides: lighter near the top, deeper toward the floor
    float up = clamp(vLocal.y / max(vH, 0.001), 0.0, 1.0);
    base = mix(vSide * 0.5, vSide * 1.1, smoothstep(0.0, 1.0, up));
    // faces turned toward the key light pick up the top colour
    base = mix(base, vTop * 1.15, 0.9 * smoothstep(0.35, 0.8, ndl));
    ao = mix(0.12, 1.0, smoothstep(0.0, 1.8, vLocal.y));
  }
  vec3 diffuse = base * (0.58 + 0.6 * ndl) * ao;
  float spec = pow(max(dot(nb, H), 0.0), 70.0) * 0.6;
  float refl = 0.5 + 0.5 * sin(vWorld.y * 1.7 + vWorld.x * 2.3 - vWorld.z * 1.9) * sin(vWorld.y * 0.9 - vWorld.z * 2.7);
  vec3 col = diffuse * (0.85 + 0.3 * refl) + env * fres * 0.25 + vec3(spec) * 0.35;

  // metallic bronze trim
  float irid = 1.0 - max(dot(nb, V), 0.0);
  vec3 trimC = mix(uTrim, uTrim * vec3(0.75, 1.15, 0.55), smoothstep(0.2, 0.9, irid));
  float tt = clamp(e / trimW, 0.0, 1.0);           // 0 at the edge, 1 at the inner side of the bevel
  vec3 dark = trimC * 0.12;
  vec3 hiC = trimC * (0.9 + 1.2 * ndl) + trimC * env * 0.5 + trimC * 3.0 * pow(max(dot(nb, H), 0.0), 30.0);
  vec3 metal = mix(hiC, dark, smoothstep(0.25, 0.55, tt));
  col = mix(col, metal, trim);
  fragColor = vec4(col, 1.0);
}
`;

const BG_FRAG = /* glsl */ `
uniform vec3 uBg;
in vec2 vUv;
out vec4 fragColor;
void main(){ fragColor = vec4(uBg * (0.6 + 0.4 * vUv.y), 1.0); }
`;

export const PillarField: React.FC<{ palette: PillarPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const p = phaseOf(frame);
  const t = p * 20;

  const { mesh, heights, bg } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = geo.index;
    ig.setAttribute("position", geo.getAttribute("position"));
    ig.setAttribute("normal", geo.getAttribute("normal"));
    const count = PILLARS.length;
    const off = new Float32Array(count * 2);
    const side = new Float32Array(count * 3);
    const top = new Float32Array(count * 3);
    const shade = new Float32Array(count);
    const cA = new THREE.Color(palette.sideA);
    const cB = new THREE.Color(palette.sideB);
    const cT = new THREE.Color(palette.top);
    PILLARS.forEach((pl, k) => {
      off[k * 2] = pl.x; off[k * 2 + 1] = pl.z;
      const s = cA.clone().lerp(cB, pl.sideMix * pl.sideMix);
      side.set([s.r, s.g, s.b], k * 3);
      // tops: mostly the light top colour, some take on the side hue
      // two families like the reference: light tops, or deep side-hued tops
      const tc = pl.topMix > 0.8
        ? s.clone().multiplyScalar(0.95 + 0.25 * pl.shade)
        : cT.clone().multiplyScalar(0.85 + 0.2 * pl.shade);
      top.set([tc.r, tc.g, tc.b], k * 3);
      shade[k] = pl.shade;
    });
    ig.setAttribute("aOffset", new THREE.InstancedBufferAttribute(off, 2));
    ig.setAttribute("aSide", new THREE.InstancedBufferAttribute(side, 3));
    ig.setAttribute("aTop", new THREE.InstancedBufferAttribute(top, 3));
    ig.setAttribute("aShade", new THREE.InstancedBufferAttribute(shade, 1));
    const heights = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    heights.setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute("aHeight", heights);
    ig.instanceCount = count;
    const trim = new THREE.Color(palette.trim);
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTrim: { value: trim },
        uLightDir: { value: new THREE.Vector3(0.1, 0.45, 1.0) },
        uSkyTop: { value: new THREE.Color(palette.top).multiplyScalar(1.2) },
        uSkyHorizon: { value: new THREE.Color(palette.sideB).multiplyScalar(0.5) },
        uTile: { value: TILE },
      },
    });
    const mesh = new THREE.Mesh(ig, mat);
    mesh.frustumCulled = false;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: { uBg: { value: new THREE.Color(palette.bg) } }, depthWrite: false }),
    );
    bg.frustumCulled = false;
    bg.renderOrder = -1;
    return { mesh, heights, bg };
  }, [palette]);

  useLayoutEffect(() => {
    const arr = heights.array as Float32Array;
    for (let k = 0; k < PILLARS.length; k++) arr[k] = pillarHeight(PILLARS[k], t);
    heights.needsUpdate = true;
  }, [t, heights]);

  // camera: ~50 degrees from above, closed +-10 degree orbit, gentle push
  const az = (45 + 10 * Math.sin(TAU * p)) * (Math.PI / 180);
  const el = 19 * (Math.PI / 180);
  const dist = 68 * (1 - 0.06 * (0.5 - 0.5 * Math.cos(TAU * p)));
  // the look-at height follows the skyline (low over the flat grid, higher at the hold)
  const lift = smooth((t - 2) / 5) - smooth((t - 12) / 5);
  const target: [number, number, number] = [0, -1.0 + 3.5 * lift, 0];
  const camera: CameraPose = useMemo(() => ({
    fov: 5.4,
    position: [target[0] + dist * Math.cos(el) * Math.sin(az), target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(el) * Math.cos(az)],
    target,
    near: 20,
    far: 140,
  }), [az, el, dist, lift]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = useMemo(() => ({
    focus: dist, range: 30, nearRange: 30, sharpZone: 6, maxBlur: 1.2, grain: 0.015, vignette: 0.25,
    bloomStrength: 0.06, bloomThreshold: 0.85, bloomRadius: 1.2,
  }), [dist]);

  return (
    <ThreeStage camera={camera} post={post}>
      <primitive object={bg} />
      <primitive object={mesh} />
    </ThreeStage>
  );
};
