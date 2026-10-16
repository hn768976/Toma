import React, { useCallback } from "react";
import * as THREE from "three";
import { glslVec3 } from "../../lib/color";
import { LOOP_FRAMES, TAU } from "../../lib/loop";
import { mulberry32, range, type Rng } from "../../lib/random";
import { makeGlowLineMaterial, makeLineSegments, setLineResolution } from "../../lib/three/glowLine";
import { PostFX } from "../../lib/three/post";
import { ThreeStage } from "../../lib/three/ThreeStage";

export type FibreVersion = {
  id: string;
  colorA: string;
  colorB: string;
  hazeA: string;
  hazeB: string;
  centre: string; // colour of the dark vanishing point
  intensity: number;
};

// Tunnel along -z, radius R. Filament geometry is one tile of length L that
// is drawn as copies at k·L; the camera advances exactly L per loop.
const R = 1;
const L = 110;
const FILAMENTS = 400;
const SEED = 1088685403;

// The tunnel axis wanders gently (periodic in L) so the vanishing point drifts
// and far filaments sweep across the centre.
const BEND = 0.32;
const Y_STRETCH = 1.55; // tall elliptical section: the dark core reads vertically elongated
export const axisAt = (z: number): [number, number] => {
  const a = (z / L) * TAU;
  return [BEND * Math.sin(3 * a + 0.4) + 0.12 * Math.sin(5 * a + 2.0), BEND * 0.8 * Math.cos(2 * a + 1.1)];
};

type Poly = { pts: [number, number, number][]; bright: number[]; jitter: number; kind: 0 | 1 | 2; dashed: boolean };

// Midpoint displacement of the angle (and a little of the radius) along z:
// jagged lightning kinks at every scale.
const displace = (rng: Rng, n: number, amp: number, rough: number) => {
  const size = 1 << n;
  const a = new Float32Array(size + 1);
  let step = size;
  let s = amp;
  while (step > 1) {
    const half = step >> 1;
    for (let i = half; i < size; i += step) {
      a[i] = (a[i - half] + a[i + half]) * 0.5 + (rng() * 2 - 1) * s;
    }
    s *= rough;
    step = half;
  }
  return a;
};

const makeBranch = (
  rng: Rng,
  out: Poly[],
  phi0: number,
  z0: number,
  len: number,
  r0: number,
  drift: number,
  kind: 0 | 1 | 2,
  b0: number,
  b1: number,
  jitter: number,
  dashed: boolean,
  depthLeft: number,
) => {
  const levels = kind === 0 ? 7 : kind === 1 ? 5 : 4;
  const n = 1 << levels;
  const dPhi = displace(rng, levels, kind === 0 ? 0.36 : 0.22, 0.5);
  const dR = displace(rng, levels, kind === 0 ? 0.09 : 0.05, 0.55);
  // broad S-curves on top of the lightning kinks
  const swA = kind === 0 ? range(rng, 0.15, 0.55) : range(rng, 0.05, 0.2);
  const swF = range(rng, 0.4, 1.4);
  const swP = rng() * TAU;
  const pts: [number, number, number][] = [];
  const bright: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const phi = phi0 + drift * u + dPhi[i] + swA * Math.sin(TAU * swF * u + swP);
    const r = Math.min(R * 1.0, r0 + dR[i] - (kind > 0 ? 0.04 * u : 0));
    const z = z0 - len * u;
    const [ax, ay] = axisAt(z);
    pts.push([ax + Math.cos(phi) * r, ay + Math.sin(phi) * r * Y_STRETCH, z]);
    // branches taper toward their tips; main filaments taper at both ends
    const taper = kind === 0 ? Math.min(1, Math.min(u, 1 - u) * 8) : 1 - u * 0.85;
    bright.push((b0 + (b1 - b0) * u) * taper);
  }
  out.push({ pts, bright, jitter, kind, dashed });
  if (depthLeft <= 0) return;
  const forks = kind === 0 ? (rng() < 0.45 ? 1 + Math.floor(rng() * 3) : 0) : rng() < 0.5 ? 1 + Math.floor(rng() * 2) : 0;
  for (let f = 0; f < forks; f++) {
    const at = 0.1 + rng() * 0.7;
    const i = Math.floor(at * n);
    const [x0, y0, z] = pts[i];
    const [ax, ay] = axisAt(z);
    const x = x0 - ax;
    const y = (y0 - ay) / Y_STRETCH;
    const phi = Math.atan2(y, x);
    const r = Math.hypot(x, y);
    const sideways = (rng() < 0.5 ? -1 : 1) * range(rng, 0.12, 0.45);
    makeBranch(
      rng,
      out,
      phi,
      z,
      len * range(rng, 0.18, 0.45),
      r,
      sideways,
      kind === 0 ? 1 : 2,
      bright[i] * 0.85,
      0,
      jitter,
      false,
      depthLeft - 1,
    );
  }
};

const buildFilaments = () => {
  const rng = mulberry32(SEED);
  const polys: Poly[] = [];
  for (let k = 0; k < FILAMENTS; k++) {
    const phi0 = rng() * TAU;
    const z0 = -rng() * L;
    const len = range(rng, 10, 32);
    const r0 = R * (0.98 - 0.4 * Math.pow(rng(), 2.2));
    const b = 0.45 + 0.55 * Math.pow(rng(), 0.6);
    const drift = (rng() * 2 - 1) * 0.6;
    makeBranch(rng, polys, phi0, z0, len, r0, drift, 0, b, b, rng(), rng() < 0.02, 2);
  }
  // pack into three segment buffers (main / branch / twig)
  const packs = [0, 1, 2].map(() => ({ seg: [] as number[], data: [] as number[] }));
  for (const p of polys) {
    const pack = packs[p.kind];
    const dashLen = 6 + Math.floor(p.jitter * 6);
    for (let i = 0; i < p.pts.length - 1; i++) {
      if (p.dashed && Math.floor(i / dashLen) % 2 === 1) continue;
      const a = p.pts[i];
      const b = p.pts[i + 1];
      pack.seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      const db = p.dashed ? 0.6 : 1;
      pack.data.push(p.bright[i] * db, p.jitter, 0, p.bright[i + 1] * db, p.jitter, 0);
    }
  }
  return packs.map((p) => ({ seg: new Float32Array(p.seg), data: new Float32Array(p.data) }));
};

const FILAMENT_PACKS = buildFilaments();

const sectorGlsl = /* glsl */ `
uniform float sectorRot;
// two broad colour sectors around the tunnel, rotating one turn per loop
float sector(float phi, float jitter) {
  float a = phi - sectorRot + 3.14159265;
  float s = 0.5 + 0.38 * sin(a + 0.4) + 0.22 * sin(2.0 * a + 1.9);
  // colours bleed: individual filaments stray into the other sector
  float c = smoothstep(0.3, 0.7, s + (jitter - 0.5) * 0.5);
  // about one filament in five takes the other colour outright
  if (jitter < 0.1) c = 1.0 - c * 0.2;
  if (jitter > 0.9) c = c * 0.2;
  return c;
}`;

const hazeVert = /* glsl */ `
varying vec3 vPos;
varying float vDepth;
varying float vPhi;
void main() {
  vPos = position;
  vPhi = uv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const hazeFrag = (v: FibreVersion) => /* glsl */ `
${sectorGlsl}
uniform float tileL;
varying vec3 vPos;
varying float vDepth;
varying float vPhi;
void main() {
  float phi = vPhi;
  float s = sector(phi, 0.5);
  vec3 col = mix(${glslVec3(v.hazeA)}, ${glslVec3(v.hazeB)}, s);
  // lengthwise streaks; the pattern repeats with the tile so it loops
  float zz = vPos.z / tileL * 6.2831853;
  float st = 0.0;
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float freq = 23.0 + fk * 29.0;
    st += sin(phi * freq + sin(zz * (fk + 1.0) + fk * 2.1) * 1.4 + fk * 1.7) * (0.6 / (fk * 0.6 + 1.0));
  }
  float streak = clamp(0.5 + 0.45 * st, 0.05, 1.3);
  // bright near the camera, dark toward the vanishing point
  float near = exp(-vDepth / 2.1);
  float glow = clamp(near * 1.3, 0.0, 1.0) * streak;
  // fine motion striations over the broad streaks
  float fine = 0.0;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    fine += sin(phi * (97.0 + fk * 61.0) + sin(zz * (fk + 2.0) + fk) * 2.0 + fk * 3.1);
  }
  col *= 0.8 + 0.12 * fine;
  col = mix(${glslVec3(v.centre)}, col * 0.75, glow);
  gl_FragColor = vec4(col, 1.0);
}`;

const createFibreScene = (v: FibreVersion) => (renderer: THREE.WebGLRenderer) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.02, 200);
  const post = new PostFX(renderer, {
    bloomStrength: 1.0,
    bloomRadius: 0.8,
    bloomThreshold: 0,
    bloomKnee: 0,
    bloomTint: "#FFFFFF",
    exposure: 1,
    grain: 0.01,
    dither: true,
    whiteBurn: 0.05,
    levels: 6,
  });
  const sectorRot = { value: 0 };

  const hazeGeo = new THREE.CylinderGeometry(R * 1.04, R * 1.04, L * 3, 128, 330, true).rotateX(Math.PI / 2);
  {
    // bend the tube along the same axis; store the unbent angle in uv.x
    const pos = hazeGeo.attributes.position as THREE.BufferAttribute;
    const uv = hazeGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const zl = pos.getZ(i) - L; // world z (mesh sits at z = -L)
      const [ax, ay] = axisAt(zl);
      pos.setXYZ(i, x + ax, y * Y_STRETCH + ay, pos.getZ(i));
      uv.setX(i, Math.atan2(y, x));
    }
  }
  const haze = new THREE.Mesh(
    hazeGeo,
    new THREE.ShaderMaterial({
      vertexShader: hazeVert,
      fragmentShader: hazeFrag(v),
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { sectorRot, tileL: { value: L } },
    }),
  );
  haze.renderOrder = -1;
  haze.frustumCulled = false;
  scene.add(haze);

  const colorFn = /* glsl */ `
    ${sectorGlsl}
    vec2 axisAt(float z) {
      float a = z / ${L.toFixed(1)} * 6.2831853;
      return vec2(${BEND.toFixed(3)} * sin(3.0 * a + 0.4) + 0.12 * sin(5.0 * a + 2.0), ${BEND.toFixed(3)} * 0.8 * cos(2.0 * a + 1.1));
    }
    vec3 lineColor(vec3 w, float depth, vec3 data) {
      vec2 q = w.xy - axisAt(w.z);
      q.y /= ${Y_STRETCH.toFixed(3)};
      float phi = atan(q.y, q.x);
      vec3 c = mix(${glslVec3(v.colorA)}, ${glslVec3(v.colorB)}, sector(phi, data.y));
      return c * data.x;
    }`;
  const common = {
    nearDist: 0.5,
    farDist: 6,
    fogNear: 1000,
    fogFar: 2000,
    fogColor: "#000000",
    fogAmount: 0,
    fadeNear: 0.5,
    fadeFar: 6.5,
    colorFn,
    extraUniforms: { sectorRot },
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    depthTest: false,
  } as const;
  const mats = [
    makeGlowLineMaterial({ ...common, linewidth: 1, nearBoost: 2.2, coreWhite: 0.15, intensity: v.intensity, taperDepth: 7 }),
    makeGlowLineMaterial({ ...common, linewidth: 1, nearBoost: 1.6, coreWhite: 0.12, intensity: v.intensity * 0.9, taperDepth: 6 }),
    makeGlowLineMaterial({ ...common, linewidth: 1, nearBoost: 1.0, coreWhite: 0.2, intensity: v.intensity * 0.8, taperDepth: 4 }),
  ];
  const widths = [2.5, 1.4, 0.85];

  const world = new THREE.Group();
  scene.add(world);
  for (let k = -1; k <= 1; k++) {
    const tile = new THREE.Group();
    tile.position.z = -k * L;
    FILAMENT_PACKS.forEach((p, i) => tile.add(makeLineSegments(p.seg, p.data, mats[i])));
    world.add(tile);
  }

  return {
    render: (loopFrame: number) => {
      const t = loopFrame / LOOP_FRAMES;
      const w = post.pixelWidth;
      const h = post.pixelHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      mats.forEach((m, i) => setLineResolution(m, w, h, widths[i]));
      sectorRot.value = TAU * t;
      const z = -t * L;
      const [cx, cy] = axisAt(z);
      const [lx, ly] = axisAt(z - 7);
      camera.position.set(cx, cy, z);
      camera.up.set(0, 1, 0);
      camera.lookAt(lx, ly, z - 7);
      camera.rotateZ(THREE.MathUtils.degToRad(15) * Math.cos(TAU * t));
      camera.updateMatrixWorld();
      // the haze is fixed in the world; its pattern repeats every L
      haze.position.z = -L;
      post.render(scene, camera, loopFrame);
    },
    dispose: () => post.dispose(),
  };
};

export const FibreTunnel: React.FC<{ version: FibreVersion }> = ({ version }) => {
  const factory = useCallback((r: THREE.WebGLRenderer) => createFibreScene(version)(r), [version]);
  return <ThreeStage factory={factory} />;
};
