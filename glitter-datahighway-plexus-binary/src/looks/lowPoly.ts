// Look 4 — Low-Poly Plexus. ~90 nodes along the bottom and up the left/right
// edges, Delaunay-triangulated once. Nodes drift on small closed loops; ~6
// facets at a time fade in, hold and fade out on a schedule that divides 600.
import Delaunator from "delaunator";
import * as THREE from "three";
import type { SceneBuilder } from "../lib/ThreeStage";
import { BOKEH_FRAG_GLSL } from "../lib/bokeh";
import { hash2, hexToLinear, LOOP, mulberry32 } from "../lib/random";

export type LowPolyVersion = {
  line: string;
  lineAlpha: number;
  facet: string;
  node: string;
  bgTop: string;
  bgBottom: string;
};

const CAM_Z = 12, FOV = 40;
const VIEW_H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const VIEW_W = (VIEW_H * 16) / 9;

// Facet schedule: SLOTS slots, each re-picks a triangle every CYCLE frames.
const SLOTS = 8, CYCLE = 100; // 600 / 100 = 6 cycles per loop
const FADE_IN = 22, HOLD = 34, FADE_OUT = 26; // + idle = CYCLE

type Node = { u: number; v: number; z: number; ax: number; ay: number; az: number; nx: number; ny: number; px: number; py: number };

const buildMesh = () => {
  const rnd = mulberry32(0x04082a);
  const pts: { u: number; v: number }[] = [];
  const tryAdd = (u: number, v: number) => {
    for (const p of pts) if (Math.hypot((p.u - u) * 1.78, p.v - v) < 0.17) return false;
    pts.push({ u, v });
    return true;
  };
  const fill = (count: number, gen: () => [number, number]) => {
    let added = 0, guard = 0;
    while (added < count && guard++ < 5000) {
      const [u, v] = gen();
      if (tryAdd(u, v)) added++;
    }
  };
  // tall clusters at the edges (peaks up to 85% of the height)
  fill(22, () => { const v = 0.2 + 0.85 * Math.pow(rnd(), 1.2); const w = 0.3 - 0.24 * (v - 0.2) / 0.85; return [-0.7 + rnd() * (w + 0.7), v]; });
  fill(22, () => { const v = 0.2 + 0.95 * Math.pow(rnd(), 1.2); const w = 0.3 - 0.24 * (v - 0.2) / 0.95; return [1.7 - rnd() * (w + 0.7), v]; });
  // the band along the bottom 35%
  fill(42, () => [-0.7 + rnd() * 2.4, -0.75 + 0.95 * Math.pow(rnd(), 0.9)]);
  // a few low peaks along the band
  fill(4, () => [0.3 + rnd() * 0.4, 0.12 + rnd() * 0.08]);

  const nodes: Node[] = pts.map((p) => ({
    u: p.u, v: p.v, z: (rnd() - 0.5) * 3.2,
    ax: 0.06 + rnd() * 0.1, ay: 0.05 + rnd() * 0.1, az: 0.1 + rnd() * 0.25,
    nx: rnd() < 0.5 ? 1 : 2, ny: rnd() < 0.6 ? 1 : 2, px: rnd() * 6.283, py: rnd() * 6.283,
  }));

  const d = Delaunator.from(pts.map((p) => [p.u * 1.78, p.v]));
  const tris: [number, number, number][] = [];
  for (let t = 0; t < d.triangles.length; t += 3) {
    const [a, b, c] = [d.triangles[t], d.triangles[t + 1], d.triangles[t + 2]];
    const P = [pts[a], pts[b], pts[c]];
    const cu = (P[0].u + P[1].u + P[2].u) / 3, cv = (P[0].v + P[1].v + P[2].v) / 3;
    const maxEdge = Math.max(...[[0, 1], [1, 2], [2, 0]].map(([i, j]) => Math.hypot((P[i].u - P[j].u) * 1.78, P[i].v - P[j].v)));
    const inGap = cv > 0.24 && cu > 0.24 && cu < 0.76;
    if (inGap || maxEdge > 0.95) continue;
    tris.push([a, b, c]);
  }
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];
  for (const [a, b, c] of tris)
    for (const [i, j] of [[a, b], [b, c], [c, a]]) {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!edgeSet.has(k)) { edgeSet.add(k); edges.push([i, j]); }
    }
  // drop nodes that ended up in no facet (stray points in the empty middle)
  const used = new Set(tris.flat());
  const keep = nodes.map((_, i) => i).filter((i) => used.has(i));
  const remap = new Map(keep.map((old, i) => [old, i]));
  return {
    nodes: keep.map((i) => nodes[i]),
    tris: tris.map((t) => t.map((i) => remap.get(i)!) as [number, number, number]),
    edges: edges.map(([a, b]) => [remap.get(a)!, remap.get(b)!] as [number, number]),
  };
};

const MESH = buildMesh();
// Facets light up mostly in the tall side clusters, where they read as big glassy panels.
// The pool is the largest on-screen triangles, weighted toward the side clusters.
const FACET_POOL: number[] = (() => {
  const scored = MESH.tris.map((t, i) => {
    const [a, b, c] = t.map((k) => MESH.nodes[k]);
    const area = Math.abs((b.u - a.u) * (c.v - a.v) - (c.u - a.u) * (b.v - a.v)) * 0.5;
    const cu = (a.u + b.u + c.u) / 3, cv = (a.v + b.v + c.v) / 3;
    const onScreen = cu > 0.0 && cu < 1.0 && cv > 0.0 && cv < 0.95;
    const side = cu < 0.3 || cu > 0.7;
    return { i, score: onScreen ? area * (side ? 2 : 1) : -1 };
  });
  return scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score).slice(0, 12).map((s) => s.i);
})();

const nodePos = (n: Node, ph: number, out: THREE.Vector3) =>
  out.set(
    (n.u - 0.5) * VIEW_W + n.ax * Math.sin(n.nx * ph + n.px),
    (n.v - 0.5) * VIEW_H + n.ay * Math.sin(n.ny * ph + n.py),
    n.z + n.az * Math.cos(ph + n.px),
  );

/** Facet opacity (0..1) for a slot at loop frame f, plus the triangle it shows. */
const facetState = (slot: number, f: number, triCount: number) => {
  const local = (f + (slot * CYCLE) / SLOTS) % LOOP;
  const cycle = Math.floor(local / CYCLE) % (LOOP / CYCLE);
  const t = local - Math.floor(local / CYCLE) * CYCLE;
  const tri = FACET_POOL[Math.floor(hash2(slot * 7919 + 13, cycle) * FACET_POOL.length) % FACET_POOL.length] % triCount;
  const ease = (x: number) => x * x * (3 - 2 * x);
  let a = 0;
  if (t < FADE_IN) a = ease(t / FADE_IN);
  else if (t < FADE_IN + HOLD) a = 1;
  else if (t < FADE_IN + HOLD + FADE_OUT) a = ease(1 - (t - FADE_IN - HOLD) / FADE_OUT);
  return { tri, a };
};

const LINE_VERT = /* glsl */ `
precision highp float;
uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform vec2 uRes; uniform vec3 uLine;
in vec3 position; in vec3 iA; in vec3 iB;
out vec3 vColor; out float vAcross;
void main() {
  vec4 va = viewMatrix * vec4(iA, 1.0), vb = viewMatrix * vec4(iB, 1.0);
  vec4 view = mix(va, vb, position.x);
  float scale = uRes.y / 720.0;
  float w = 1.2 * scale;
  vec4 ca = projectionMatrix * va, cb = projectionMatrix * vb;
  vec2 dir = normalize((cb.xy / cb.w - ca.xy / ca.w) * uRes + 1e-6);
  vec4 clip = projectionMatrix * view;
  clip.xy += vec2(-dir.y, dir.x) * position.y * (w + scale) * 2.0 / uRes * clip.w;
  vAcross = position.y * (w + scale) / w;
  // depth cue: nearer edges brighter, far ones fainter
  vColor = uLine * mix(0.45, 1.35, clamp((iA.z + iB.z) * 0.25 + 0.5, 0.0, 1.0));
  gl_Position = clip;
}`;
const LINE_FRAG = /* glsl */ `
precision highp float;
in vec3 vColor; in float vAcross; out vec4 outColor;
void main() { outColor = vec4(vColor * clamp(1.0 - abs(vAcross) * 0.9, 0.0, 1.0), 1.0); }`;

const NODE_VERT = /* glsl */ `
precision highp float;
uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform vec2 uRes; uniform vec3 uNode;
in vec3 position; in vec3 iP; in float iS;
out vec2 vP; out vec3 vColor; out float vSharp; out float vEdge;
void main() {
  vec4 view = viewMatrix * vec4(iP, 1.0);
  float scale = uRes.y / 720.0;
  float dist = -view.z;
  float coc = abs(${CAM_Z.toFixed(1)} / dist - 1.0) * 0.02 * uRes.y; // light DoF
  float core = (2.0 + 3.6 * iS * iS) * scale;
  float r = max(core, coc) * 8.0;   // sprite includes the halo
  vColor = uNode * pow(core / max(core, coc), 1.2);
  vSharp = 1.0;
  vEdge = r;
  vP = position.xy;
  vec4 clip = projectionMatrix * view;
  clip.xy += position.xy * r * 2.0 / uRes * clip.w;
  gl_Position = clip;
}`;
const NODE_FRAG = /* glsl */ `
precision highp float;
in vec2 vP; in vec3 vColor; in float vSharp; in float vEdge; out vec4 outColor;
${BOKEH_FRAG_GLSL}
void main() {
  float r = length(vP);
  float core = exp(-r * r * 300.0) * 1.5;
  float halo = exp(-r * r * 28.0) * 0.7 + exp(-r * r * 6.0) * 0.22;
  outColor = vec4(vColor * (core + halo) * (1.0 - smoothstep(0.85, 1.0, r)), 1.0);
}`;

const FACET_VERT = /* glsl */ `
precision highp float;
uniform mat4 projectionMatrix; uniform mat4 viewMatrix;
in vec3 position; in float aAlpha;
out float vAlpha;
void main() { vAlpha = aAlpha; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const FACET_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uFacet; in float vAlpha; out vec4 outColor;
void main() { outColor = vec4(uFacet * vAlpha * 0.6, 1.0); }`;

export const makeLowPoly = (v: LowPolyVersion): SceneBuilder => ({ width, height }) => {
  const { nodes, tris, edges } = MESH;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 100);
  const uniforms = {
    uRes: { value: new THREE.Vector2(width, height) },
    uLine: { value: new THREE.Color(...hexToLinear(v.line)).multiplyScalar(v.lineAlpha * 1.6) },
    uNode: { value: new THREE.Color(...hexToLinear(v.node)) },
    uFacet: { value: new THREE.Color(...hexToLinear(v.facet)) },
  };
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false } as const;

  // facets: non-indexed triangles, per-vertex alpha (gradient across the facet)
  const fGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(tris.length * 9), fAlpha = new Float32Array(tris.length * 3);
  fGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute("aAlpha", new THREE.BufferAttribute(fAlpha, 1));
  const facets = new THREE.Mesh(fGeo, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FACET_VERT, fragmentShader: FACET_FRAG, uniforms, ...add, side: THREE.DoubleSide }));
  facets.frustumCulled = false;

  const quad = (corners: number[]) => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(corners), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  };
  const lGeo = quad([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]);
  const lA = new Float32Array(edges.length * 3), lB = new Float32Array(edges.length * 3);
  lGeo.setAttribute("iA", new THREE.InstancedBufferAttribute(lA, 3));
  lGeo.setAttribute("iB", new THREE.InstancedBufferAttribute(lB, 3));
  lGeo.instanceCount = edges.length;
  const lines = new THREE.Mesh(lGeo, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms, ...add }));
  lines.frustumCulled = false;

  const nGeo = quad([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
  const nP = new Float32Array(nodes.length * 3);
  const rs = mulberry32(90);
  nGeo.setAttribute("iP", new THREE.InstancedBufferAttribute(nP, 3));
  nGeo.setAttribute("iS", new THREE.InstancedBufferAttribute(new Float32Array(nodes.map(() => rs())), 1));
  nGeo.instanceCount = nodes.length;
  const nodeMesh = new THREE.Mesh(nGeo, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: NODE_VERT, fragmentShader: NODE_FRAG, uniforms, ...add }));
  nodeMesh.frustumCulled = false;
  scene.add(facets, lines, nodeMesh);

  const P = nodes.map(() => new THREE.Vector3());
  const update = (f: number) => {
    const ph = (2 * Math.PI * f) / LOOP;
    nodes.forEach((n, i) => nodePos(n, ph, P[i]));
    tris.forEach(([a, b, c], t) => {
      [a, b, c].forEach((k, m) => fPos.set([P[k].x, P[k].y, P[k].z], t * 9 + m * 3));
      fAlpha.fill(0, t * 3, t * 3 + 3);
    });
    for (let s = 0; s < SLOTS; s++) {
      const { tri, a } = facetState(s, f, tris.length);
      // 35%..70% gradient across the triangle
      fAlpha[tri * 3] += a * 0.7;
      fAlpha[tri * 3 + 1] += a * 0.5;
      fAlpha[tri * 3 + 2] += a * 0.35;
    }
    fGeo.attributes.position.needsUpdate = true;
    fGeo.attributes.aAlpha.needsUpdate = true;
    edges.forEach(([a, b], e) => { lA.set([P[a].x, P[a].y, P[a].z], e * 3); lB.set([P[b].x, P[b].y, P[b].z], e * 3); });
    lGeo.attributes.iA.needsUpdate = true;
    lGeo.attributes.iB.needsUpdate = true;
    P.forEach((p, i) => nP.set([p.x, p.y, p.z], i * 3));
    nGeo.attributes.iP.needsUpdate = true;
    // gentle closed orbit, ±4°
    const yaw = THREE.MathUtils.degToRad(4) * Math.sin(ph);
    const pitch = THREE.MathUtils.degToRad(1.5) * Math.sin(2 * ph + 0.7);
    camera.position.set(CAM_Z * Math.sin(yaw), CAM_Z * Math.sin(pitch), CAM_Z * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(0, 0, 0);
  };
  const top = hexToLinear(v.bgTop), bot = hexToLinear(v.bgBottom);
  const vec = (c: number[]) => `vec3(${c.map((x) => x.toFixed(5)).join(",")})`;
  return {
    scene, camera,
    update,
    post: {
      bloomStrength: 0.12, bloomThreshold: 0.0, bloomRadius: 1.0, vignette: 0.45,
      grain: 0.015, grainFloor: 0, exposure: 1.0,
      backgroundGlsl: `vec3 background(vec2 uv) {
        float t = smoothstep(1.0, 0.0, uv.y);
        vec3 c = mix(${vec(top)}, ${vec(bot)}, t * t * t);
        // soft haze glowing behind the side clusters
        vec2 a = (uv - vec2(0.04, 0.3)) / vec2(0.22, 0.32), b = (uv - vec2(0.96, 0.3)) / vec2(0.22, 0.32);
        return c + ${vec(hexToLinear(v.facet))} * 0.035 * (exp(-dot(a, a)) + exp(-dot(b, b)));
      }`,
    },
  };
};
