// Look 3 — Plexus Landscape. ~6,000 nodes on a jittered grid over a rolling
// heightfield (periodic over 600 frames), linked to grid neighbours, with
// strong per-point depth of field (bokeh sprites).
import * as THREE from "three";
import type { SceneBuilder } from "../lib/ThreeStage";
import { BOKEH_FRAG_GLSL, BOKEH_GLSL } from "../lib/bokeh";
import { hexToLinear, LOOP, mulberry32, pickWeighted } from "../lib/random";

export type PlexusLandscapeVersion = {
  nodes: [number, string][]; // [weight, hex]
  link: string;
  linkAlpha: number;
  horizon: string;
};

// Jittered grid whose rows widen and spread with depth, so the ~6,000 nodes
// cover the view (dense far ridge, open foreground) instead of falling off-screen.
const NX = 64, NZ = 94, D0 = 1.2, D1 = 30, Z0 = 3.3;
const rowDepth = (j: number) => {
  const t = j / (NZ - 1);
  return 0.55 * D0 * Math.pow(D1 / D0, t) + 0.45 * (D0 + (D1 - D0) * t);
};
const halfWidth = (d: number) => 2.4 + 0.85 * d;

// Heightfield: low-frequency waves, each with a whole number of temporal
// cycles per loop, so h(x, z, f) == h(x, z, f + 600).
const WAVES: [number, number, number, number, number][] = [
  // kx, kz, amp, cycles, phase
  [0.32, 0.17, 0.75, 1, 0.3],
  [-0.21, 0.36, 0.55, 1, 1.9],
  [0.55, -0.31, 0.22, 2, 4.2],
  [0.14, 0.6, 0.13, -1, 2.7],
  [0.8, 0.45, 0.1, 2, 0.8],
  [1.35, -0.9, 0.07, 1, 3.3],
  [-1.7, 1.2, 0.05, 2, 5.1],
];
const HEIGHT_GLSL = /* glsl */ `
uniform float uPhase; // 2*pi*f/600
float height(vec2 p) {
  float h = 0.0;
  ${WAVES.map(([kx, kz, a, n, ph]) => `h += ${a.toFixed(3)} * sin(${kx.toFixed(3)} * p.x + ${kz.toFixed(3)} * p.y + ${n.toFixed(1)} * uPhase + ${ph.toFixed(3)});`).join("\n  ")}
  // far ridge rises a little
  h += smoothstep(-8.0, -26.0, p.y) * (0.7 + 0.05 * p.x); // far ridge rises, climbing to the right
  // rugged detail: many small peaks and valleys
  h += 0.16 * sin(2.3 * p.x + 1.7 * p.y + uPhase) * sin(1.9 * p.y - 2.6 * p.x + 2.0) + 0.09 * sin(4.1 * p.x - 3.3 * p.y - uPhase * 2.0);
  return h;
}`;

const layout = (v: PlexusLandscapeVersion) => {
  const rnd = mulberry32(0x3a8aff);
  const n = NX * NZ;
  const pos = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  const misc = new Float32Array(n * 3); // size, twinkle cycles, twinkle phase
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const d = rowDepth(j + (rnd() - 0.5) * 1.0);
      const hw = halfWidth(d);
      pos[k * 2] = ((i + 0.5 + (rnd() - 0.5) * 1.0) / NX * 2 - 1) * hw;
      pos[k * 2 + 1] = Z0 - d;
      col.set(hexToLinear(pickWeighted(rnd(), v.nodes)), k * 3);
      const s = rnd();
      misc.set([1 + 2 * s * s, 1 + Math.floor(rnd() * 4), rnd() * Math.PI * 2], k * 3);
    }
  const links: number[] = [];
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      if (i + 1 < NX && rnd() < 0.85) links.push(k, k + 1);
      if (j + 1 < NZ && rnd() < 0.85) links.push(k, k + NX);
      if (i + 1 < NX && j + 1 < NZ && rnd() < 0.45) links.push(k, k + NX + 1);
      else if (i > 0 && j + 1 < NZ && rnd() < 0.3) links.push(k, k + NX - 1);
    }
  return { n, pos, col, misc, links: new Float32Array(links.flatMap((idx, m) => (m % 2 === 0 ? [pos[idx * 2], pos[idx * 2 + 1]] : [pos[idx * 2], pos[idx * 2 + 1]]))) };
};

const COMMON = /* glsl */ `
precision highp float;
uniform mat4 projectionMatrix; uniform mat4 viewMatrix;
uniform vec2 uRes; uniform float uFocus; uniform float uNearK; uniform float uFarK; uniform float uFarFade;
${HEIGHT_GLSL}
${BOKEH_GLSL}
`;

const NODE_VERT = /* glsl */ `
${COMMON}
in vec3 position; // corner (-1..1)
in vec2 iPos; in vec3 iColor; in vec3 iMisc;
out vec2 vP; out vec3 vColor; out float vSharp; out float vEdge;
void main() {
  vec3 world = vec3(iPos.x, height(iPos), iPos.y);
  vec4 view = viewMatrix * vec4(world, 1.0);
  float dist = -view.z;
  float scale = uRes.y / 720.0;
  float core = 1.6 * iMisc.x * scale * (1.0 + 0.5 * step(iColor.b * 1.5, iColor.r)); // amber nodes larger            // in-focus radius (px)
  // tilted focal plane: near on the left, far on the right (diagonal sharp band)
  vec4 c0 = projectionMatrix * view;
  float focus = uFocus * (1.0 + 0.3 * clamp(c0.x / c0.w, -1.0, 1.0));
  float coc = cocPx(dist, focus, uNearK, uFarK, uRes.y);
  float r = max(core, coc) + 1.0 * scale;
  float energy = pow(core / r, 1.25);
  float tw = 0.72 + 0.28 * sin(iMisc.y * uPhase + iMisc.z);
  // brightness: a few bright nodes, many dim; amber nodes glow hottest
  float warm = step(iColor.b * 1.5, iColor.r);
  float lum = (0.35 + 0.65 * (iMisc.x - 1.0) * 0.5) * (1.0 + 0.9 * warm);
  float fade = 1.0 - 0.94 * smoothstep(uFarFade * 0.2, uFarFade * 0.8, dist);
  vColor = iColor * lum * tw * fade * mix(2.6, 0.6, smoothstep(core, core * 3.0, coc)) * max(energy, 0.06);
  vSharp = 1.0 - smoothstep(core * 0.8, core * 2.5, coc);
  vEdge = 1.2;  // very soft bokeh edge (gaussian-like, no rim)
  vP = position.xy;
  vec4 clip = projectionMatrix * view;
  clip.xy += position.xy * r * 2.0 / uRes * clip.w;
  gl_Position = clip;
}`;
const NODE_FRAG = /* glsl */ `
precision highp float;
in vec2 vP; in vec3 vColor; in float vSharp; in float vEdge;
out vec4 outColor;
${BOKEH_FRAG_GLSL}
void main() {
  float a = bokehShape(vP, vSharp, vEdge);
  outColor = vec4(vColor * a, 1.0);
}`;

const LINK_VERT = /* glsl */ `
${COMMON}
in vec3 position; // x: 0..1 along, y: -1..1 across
in vec4 iAB;
uniform vec3 uLink;
out vec3 vColor; out float vAcross;
void main() {
  vec2 pa = iAB.xy, pb = iAB.zw;
  vec4 va = viewMatrix * vec4(pa.x, height(pa), pa.y, 1.0);
  vec4 vb = viewMatrix * vec4(pb.x, height(pb), pb.y, 1.0);
  vec4 view = mix(va, vb, position.x);
  float dist = -view.z;
  float scale = uRes.y / 720.0;
  vec4 c0 = projectionMatrix * view;
  float focus = uFocus * (1.0 + 0.3 * clamp(c0.x / c0.w, -1.0, 1.0));
  float coc = cocPx(dist, focus, uNearK, uFarK, uRes.y);
  float w = 1.0 * scale + coc * 0.3;            // half width in px, blurred lines widen
  float fade = 1.0 - smoothstep(uFarFade * 0.8, uFarFade, dist);
  vColor = uLink * 1.5 * fade * pow(clamp(0.8 * scale / w, 0.0, 1.0), 1.6);
  vec4 ca = projectionMatrix * va, cb = projectionMatrix * vb;
  vec2 sa = ca.xy / ca.w * uRes, sb = cb.xy / cb.w * uRes;
  vec2 dir = normalize(sb - sa + 1e-6);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 clip = projectionMatrix * view;
  clip.xy += nrm * position.y * (w + 1.0 * scale) * 2.0 / uRes * clip.w * 0.5;
  vAcross = position.y * (w + scale) / w;
  gl_Position = clip;
}`;
const LINK_FRAG = /* glsl */ `
precision highp float;
in vec3 vColor; in float vAcross;
out vec4 outColor;
void main() {
  float a = clamp(1.0 - abs(vAcross), 0.0, 1.0);
  outColor = vec4(vColor * a, 1.0);
}`;

export const makePlexusLandscape = (v: PlexusLandscapeVersion): SceneBuilder => {
  const L = layout(v);
  return ({ width, height }) => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 300);
    const uniforms = {
      uPhase: { value: 0 },
      uRes: { value: new THREE.Vector2(width, height) },
      uFocus: { value: 6.5 },
      uNearK: { value: 0.03 },
      uFarK: { value: 0.014 },
      uFarFade: { value: 31 },
      uLink: { value: new THREE.Color(...hexToLinear(v.link)).multiplyScalar(v.linkAlpha) },
    };
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false };

    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    quad.setAttribute("iPos", new THREE.InstancedBufferAttribute(L.pos, 2));
    quad.setAttribute("iColor", new THREE.InstancedBufferAttribute(L.col, 3));
    quad.setAttribute("iMisc", new THREE.InstancedBufferAttribute(L.misc, 3));
    quad.instanceCount = L.n;
    const nodes = new THREE.Mesh(quad, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: NODE_VERT, fragmentShader: NODE_FRAG, uniforms, ...additive }));
    nodes.frustumCulled = false;

    const lq = new THREE.InstancedBufferGeometry();
    lq.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
    lq.setIndex([0, 1, 2, 0, 2, 3]);
    lq.setAttribute("iAB", new THREE.InstancedBufferAttribute(L.links, 4));
    lq.instanceCount = L.links.length / 4;
    const links = new THREE.Mesh(lq, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: LINK_VERT, fragmentShader: LINK_FRAG, uniforms, ...additive }));
    links.frustumCulled = false;
    scene.add(links, nodes);

    const update = (f: number) => {
      const ph = (2 * Math.PI * f) / LOOP;
      uniforms.uPhase.value = ph;
      // slow closed drift sideways and forward
      camera.position.set(0.7 * Math.sin(ph), 1.45 + 0.06 * Math.sin(2 * ph + 1), 4.5 - 0.6 * (1 - Math.cos(ph)));
      camera.rotation.order = "YXZ";
      camera.rotation.set(THREE.MathUtils.degToRad(-4), THREE.MathUtils.degToRad(-3 + 1.5 * Math.sin(ph)), THREE.MathUtils.degToRad(-6));
    };
    const navy = hexToLinear(v.horizon);
    return {
      scene, camera, update,
      post: {
        bloomStrength: 0.14, bloomThreshold: 0.0, bloomRadius: 1.0, vignette: 0.4,
        grain: 0.015, grainFloor: 0.03, exposure: 1.0,
        backgroundGlsl: `vec3 background(vec2 uv) { float y = uv.y - 0.6; return vec3(${navy.map((c) => c.toFixed(5)).join(",")}) * exp(-y * y / 0.01) * 0.08; }`,
      },
    };
  };
};
