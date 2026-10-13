import * as THREE from "three";
import { shaderMat } from "../engine/material";
import { NOISE } from "../engine/glsl";
import type { Look, LookFactory } from "../engine/LoopCanvas";
import { LOOP, TAU, phaseOf } from "../engine/loop";
import { Post } from "../engine/post";
import { mulberry32 } from "../engine/rng";

export interface TriangleReliefParams {
  tile: string;
  line: string;
  /** Background key light tint (very subtle). */
  keyTint: string;
}

// ---------------------------------------------------------------------------
// Layout (module level, seeded): the triangle lattice, its edge graph, and the
// tracer routes. Frame height = 10 world units at the wall plane.
// ---------------------------------------------------------------------------
const FRAME_H = 10;
const FRAME_W = (FRAME_H * 16) / 9;
/** Tile side: ~9.6 % of frame width (matches the reference: ~6.5 rows per frame height). */
const SIDE = 1.72;
const TRI_H = (SIDE * Math.sqrt(3)) / 2;
const FOV = 20;
const CAM_DIST = FRAME_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

// Lattice vertex (i, j) -> world (x, y). Rows are horizontal.
const vx = (i: number, j: number) => (i + j * 0.5) * SIDE - FRAME_W / 2 - SIDE;
const vy = (_i: number, j: number) => j * TRI_H - FRAME_H / 2 - TRI_H * 1.3;

const ROWS = Math.ceil((FRAME_H + 3 * TRI_H) / TRI_H) + 1;
const J0 = 0;
const J1 = ROWS;
// i range wide enough for the skew.
const I0 = -Math.ceil(ROWS / 2) - 2;
const I1 = Math.ceil((FRAME_W + 3 * SIDE) / SIDE) + 2;

interface Tri {
  x: number;
  y: number;
  up: boolean;
}
const TRIS: Tri[] = [];
const inView = (x: number, y: number, m = 1.6) =>
  Math.abs(x) < FRAME_W / 2 + SIDE * m && Math.abs(y) < FRAME_H / 2 + SIDE * m;
for (let j = J0; j < J1; j++) {
  for (let i = I0; i < I1; i++) {
    const ax = vx(i, j), ay = vy(i, j);
    const bx = vx(i + 1, j), by = vy(i + 1, j);
    const cx = vx(i, j + 1), cy = vy(i, j + 1);
    const dx = vx(i + 1, j + 1), dy = vy(i + 1, j + 1);
    const ux = (ax + bx + cx) / 3, uy = (ay + by + cy) / 3;
    const wx = (bx + dx + cx) / 3, wy = (by + dy + cy) / 3;
    if (inView(ux, uy)) TRIS.push({ x: ux, y: uy, up: true });
    if (inView(wx, wy)) TRIS.push({ x: wx, y: wy, up: false });
  }
}

// Edge graph. Vertex key -> neighbours via the 6 lattice directions.
const DIRS: [number, number][] = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
];
interface Edge {
  ax: number; ay: number; bx: number; by: number;
  /** Lattice vertex keys of the two ends. */
  a: string; b: string;
}
const EDGES: Edge[] = [];
const EDGE_INDEX = new Map<string, number>(); // "i,j|d" with d in 0..2 canonical
const edgeKey = (i: number, j: number, d: number): [string, boolean] => {
  // Canonical directions 0,1,2; directions 3..5 are the reverse of 0..2.
  if (d < 3) return [`${i},${j}|${d}`, false];
  const [di, dj] = DIRS[d];
  return [`${i + di},${j + dj}|${d - 3}`, true];
};
for (let j = J0 - 1; j <= J1 + 1; j++) {
  for (let i = I0 - 1; i <= I1 + 1; i++) {
    for (let d = 0; d < 3; d++) {
      const [di, dj] = DIRS[d];
      const ax = vx(i, j), ay = vy(i, j), bx = vx(i + di, j + dj), by = vy(i + di, j + dj);
      if (!inView((ax + bx) / 2, (ay + by) / 2, 1.0)) continue;
      EDGE_INDEX.set(`${i},${j}|${d}`, EDGES.length);
      EDGES.push({ ax, ay, bx, by, a: `${i},${j}`, b: `${i + di},${j + dj}` });
    }
  }
}

// Vertex -> incident edges (with which end touches the vertex).
const AT_VERTEX = new Map<string, { edge: number; atStart: boolean }[]>();
EDGES.forEach((e, k) => {
  for (const [key, atStart] of [[e.a, true], [e.b, false]] as const) {
    const l = AT_VERTEX.get(key) ?? [];
    l.push({ edge: k, atStart });
    AT_VERTEX.set(key, l);
  }
});

interface Step { edge: number; reversed: boolean }
interface Tracer { period: number; offset: number; routes: Step[][]; speed: number }

const SPILL = 0.34;
const rng = mulberry32(0x7a1e5eed);
const N_TRACERS = 12;
const PERIODS = [150, 200, 300, 300, 600];
const TRACERS: Tracer[] = [];
{
  // Start points biased away from the exact centre but covering the frame.
  for (let k = 0; k < N_TRACERS; k++) {
    const period = PERIODS[Math.floor(rng() * PERIODS.length)];
    const cycles = LOOP / period;
    const routes: Step[][] = [];
    for (let c = 0; c < cycles; c++) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const j = Math.floor(J0 + 2 + rng() * (J1 - J0 - 4));
        const xs = (rng() - 0.5) * FRAME_W * 0.95;
        const i = Math.round((xs + FRAME_W / 2 + SIDE) / SIDE - j * 0.5);
        const len = 4 + Math.floor(rng() * 7); // 4..10 edges
        let ci = i, cj = j;
        let dir = Math.floor(rng() * 6);
        const used = new Set<number>();
        const route: Step[] = [];
        for (let s = 0; s < len; s++) {
          if (s > 0) {
            const r = rng();
            // Prefer running straight (long gold runs), sometimes turn 60/120 deg.
            const turn = r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.8 ? -1 : r < 0.9 ? 2 : -2;
            dir = (dir + turn + 6) % 6;
          }
          const [key, reversed] = edgeKey(ci, cj, dir);
          const e = EDGE_INDEX.get(key);
          if (e === undefined || used.has(e)) break;
          used.add(e);
          route.push({ edge: e, reversed });
          ci += DIRS[dir][0];
          cj += DIRS[dir][1];
        }
        if (route.length >= 4) {
          routes.push(route);
          break;
        }
      }
    }
    TRACERS.push({ period, offset: Math.floor(rng() * period), routes, speed: 0.75 + rng() * 0.6 });
  }
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
/** One bevelled triangular prism, point-up, centred on its centroid. */
const buildTileGeometry = () => {
  const gap = SIDE * 0.006;
  const bevel = SIDE * 0.022;
  const bevelDrop = SIDE * 0.02;
  const depth = SIDE * 0.4;
  const R = SIDE / Math.sqrt(3) - gap; // circumradius of the outer edge
  const r = R - bevel * 2; // circumradius of the top face
  const corner = (rad: number, k: number) => {
    const a = Math.PI / 2 + (k * TAU) / 3;
    return new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0);
  };
  const pos: number[] = [];
  const nrm: number[] = [];
  const edge: number[] = []; // which outer edge (0..2) a face belongs to, -1 for top
  const part: number[] = []; // 0 top, 1 bevel, 2 side
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, e: number, p: number) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    for (const v of [a, b, c]) {
      pos.push(v.x, v.y, v.z);
      nrm.push(n.x, n.y, n.z);
      edge.push(e);
      part.push(p);
    }
  };
  const T = [0, 1, 2].map((k) => corner(r, k));
  const O = [0, 1, 2].map((k) => corner(R, k).setZ(-bevelDrop));
  const B = [0, 1, 2].map((k) => corner(R, k).setZ(-depth));
  tri(T[0], T[1], T[2], -1, 0);
  for (let k = 0; k < 3; k++) {
    const k2 = (k + 1) % 3;
    // Edge k runs between corners k and k2; its "neighbour" lies opposite corner k+2.
    tri(T[k], O[k], O[k2], k, 1);
    tri(T[k], O[k2], T[k2], k, 1);
    tri(O[k], B[k], B[k2], k, 2);
    tri(O[k], B[k2], O[k2], k, 2);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
  const inst: number[] = [];
  TRIS.forEach((t, idx) => inst.push(t.x, t.y, t.up ? 0 : 1, idx));
  g.setAttribute("aInst", new THREE.InstancedBufferAttribute(new Float32Array(inst), 4));
  g.instanceCount = TRIS.length;
  return g;
};

const DEPTH_GLSL = /* glsl */ `
${NOISE}
uniform float uF;     // frame number
uniform vec2 uCS;     // cos, sin of the loop phase (computed exactly on the CPU)
uniform float uSide;
float cyc(float k) { return mod(k * uF, 600.0) / 600.0; }
// Tile depth (<= 0, pushed into the wall) as a closed loop in time.
float tileDepth(vec2 c, float id) {
  vec2 q = c * 0.23;
  vec2 r1 = uCS;
  vec2 r2 = vec2(uCS.x * 0.2675 - uCS.y * 0.9636, uCS.y * 0.2675 + uCS.x * 0.9636); // phase + 1.3 rad
  float n1 = vnoise(vec3(q + 0.9 * r1, 3.7));
  float n2 = vnoise(vec3(q * 2.1 - 0.6 * r2, 11.3));
  float n = 0.65 * n1 + 0.35 * n2;
  // A few tiles step in and out on their own (whole cycles per loop).
  float h = hash31(vec3(id, 7.0, 3.0));
  float k = floor(1.0 + hash31(vec3(id, 1.0, 9.0)) * 2.0);
  float solo = id < 0.0 ? 0.0 : smoothstep(0.8, 1.0, h) * (0.5 + 0.5 * cos(6.2831853 * (cyc(k) + h * 3.0)));
  float d = clamp(smoothstep(0.25, 0.8, n) * 0.75 + solo * 0.6, 0.0, 1.0);
  return -d * 0.06 * uSide;
}
`;

const TILE_VERT = /* glsl */ `
in float aEdge;
in float aPart;
in vec4 aInst;
${DEPTH_GLSL}
out vec3 vN;
out vec3 vW;
out float vAo;
out float vPart;
out float vDepth;
void main() {
  float flip = aInst.z > 0.5 ? -1.0 : 1.0; // down triangles: rotate 180 deg
  vec3 p = position;
  vec3 n = normal;
  p.xy *= flip;
  n.xy *= flip;
  // Each tile also takes the slope of the smooth depth field at its centre, so
  // neighbouring tiles catch the key light slightly differently.
  float z0 = tileDepth(aInst.xy, aInst.w);
  float e = uSide * 0.5;
  vec2 grad = vec2(tileDepth(aInst.xy + vec2(e, 0.0), -1.0) - tileDepth(aInst.xy - vec2(e, 0.0), -1.0),
                   tileDepth(aInst.xy + vec2(0.0, e), -1.0) - tileDepth(aInst.xy - vec2(0.0, e), -1.0)) / (2.0 * e);
  grad *= 2.4;
  float z = z0 + dot(grad, p.xy);
  n = normalize(vec3(n.xy - grad * n.z, n.z));
  // Neighbour across this face's edge: the edge midpoint direction (outward normal in xy).
  float ao = 0.0;
  if (aEdge > -0.5) {
    vec2 dir = normalize(n.xy + 1e-6);
    float inr = uSide / (2.0 * sqrt(3.0));
    vec2 nc = aInst.xy + dir * inr * 2.0;
    // Neighbour id is unknown here; its smooth depth is what shades the seam.
    float zn = tileDepth(nc, -1.0);
    ao = smoothstep(0.0, 0.05 * uSide, zn - z);
  }
  vec3 w = vec3(p.xy + aInst.xy, p.z + z);
  vW = w;
  vN = n;
  vAo = ao;
  vPart = aPart;
  vDepth = z0 / (0.06 * uSide); // 0 (front) .. -1 (deepest)
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;

const TILE_FRAG = /* glsl */ `
precision highp float;
in vec3 vN;
in vec3 vW;
in float vAo;
in float vPart;
in float vDepth;
uniform vec3 uTile;
uniform vec3 uKey;
uniform vec3 uCamPos;
uniform vec2 uFrame;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  // Soft key from the top left: a big area light, approximated by a position-
  // dependent direction plus a broad falloff across the wall.
  vec3 Lp = vec3(-uFrame.x * 0.75, uFrame.y * 0.9, 14.0);
  vec3 L = normalize(Lp - vW);
  float fall = 1.0 / (1.0 + dot(vW.xy - Lp.xy, vW.xy - Lp.xy) * 0.006);
  float diff = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  // Satin: broad, weak specular lobe (roughness ~0.5).
  float spec = pow(max(dot(N, H), 0.0), 30.0) * 0.008 + pow(max(dot(N, H), 0.0), 5.0) * 0.0025;
  float bev = vPart > 0.5 && vPart < 1.5 ? 1.0 : 0.0;
  float sheen = bev * (0.02 * diff * diff + 0.004 * pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 2.0));
  float ao = 1.0 - 0.8 * vAo;
  ao *= vPart > 1.5 ? 0.2 : 1.0; // sides sit in the seams
  vec3 base = uTile;
  vec3 col = base * (0.35 + 1.6 * diff * fall) + uKey * (spec + sheen) * fall;
  col *= ao * (1.0 + 0.45 * vDepth);
  gl_FragColor = vec4(col, 1.0);
}
`;

const LINE_VERT = /* glsl */ `
in vec4 aSeg;    // ax, ay, bx, by
in vec4 aLit;    // i0, i1, from, to (edge-param space)
in vec2 aSpill;  // glow bleeding in from lit neighbours, at param 0 and 1
uniform float uHalfW;
out vec2 vUv;    // x: along edge param 0..1, y: across in half-widths
out vec4 vLit;
out vec2 vSpill;
out float vLen;
void main() {
  vSpill = aSpill;
  vec2 a = aSeg.xy, b = aSeg.zw;
  vec2 d = b - a;
  float len = length(d);
  vec2 t = d / len;
  vec2 n = vec2(-t.y, t.x);
  // position.x in [0,1] along, position.y in [-1,1] across; extend ends for caps.
  float ext = uHalfW * 2.0;
  float along = mix(-ext, len + ext, position.x);
  vec2 p = a + t * along + n * position.y * uHalfW * 4.0;
  vUv = vec2(along / len, position.y * 4.0);
  vLit = aLit;
  vLen = len;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 0.03, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec4 vLit;
in vec2 vSpill;
in float vLen;
uniform vec3 uLine;
uniform float uHalfW;
void main() {
  float s = vUv.x;
  float aa = fwidth(vUv.y) + 1e-4;
  float across = abs(vUv.y);
  float core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, across);
  float halo = exp(-across * across * 0.35) * 0.18;
  // Lit range along the edge, soft-edged by a pixel.
  float aaL = fwidth(s) * 1.5 + 1e-5;
  float m = smoothstep(vLit.z - aaL, vLit.z + aaL, s) * (1.0 - smoothstep(vLit.w - aaL, vLit.w + aaL, s));
  float sc = clamp(s, 0.0, 1.0);
  float inten = max(mix(vLit.x, vLit.y, sc) * m, mix(vSpill.x, vSpill.y, sc * sc * (3.0 - 2.0 * sc)));
  // Dim parts of a line run deeper and warmer; bright parts go pale.
  vec3 tint = pow(uLine, vec3(1.0 + 1.6 * (1.0 - clamp(inten, 0.0, 1.0))));
  vec3 c = tint * inten * (core * 3.0 + halo);
  gl_FragColor = vec4(c, 1.0);
}
`;

export const createTriangleRelief: LookFactory<TriangleReliefParams> = (gl, params): Look => {
  const post = new Post(gl, {
    msaa: 4,
    bloomStrength: 0.55,
    bloomRadius: 0.55,
    bloomThreshold: 0.9,
    bloomKnee: 0.6,
    exposure: 1.0,
    vignette: 0.55,
    grain: 0.015,
    grainDarkCut: 0.03,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 200);

  const tileMat = shaderMat({
    vertexShader: TILE_VERT,
    fragmentShader: TILE_FRAG,
    uniforms: {
      uF: { value: 0 },
      uCS: { value: new THREE.Vector2(1, 0) },
      uSide: { value: SIDE },
      uTile: { value: new THREE.Color(params.tile) },
      uKey: { value: new THREE.Color(params.keyTint) },
      uCamPos: { value: new THREE.Vector3() },
      uFrame: { value: new THREE.Vector2(FRAME_W / 2, FRAME_H / 2) },
    },
  });
  const tiles = new THREE.Mesh(buildTileGeometry(), tileMat);
  tiles.frustumCulled = false;
  scene.add(tiles);

  // Edge ribbons.
  const lineGeo = new THREE.InstancedBufferGeometry();
  lineGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, -1, 0, 1, 1, 0, 0, 1, 0], 3),
  );
  const seg = new Float32Array(EDGES.length * 4);
  EDGES.forEach((e, k) => seg.set([e.ax, e.ay, e.bx, e.by], k * 4));
  lineGeo.setAttribute("aSeg", new THREE.InstancedBufferAttribute(seg, 4));
  const lit = new Float32Array(EDGES.length * 4);
  const litAttr = new THREE.InstancedBufferAttribute(lit, 4);
  litAttr.setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute("aLit", litAttr);
  const spill = new Float32Array(EDGES.length * 2);
  const spillAttr = new THREE.InstancedBufferAttribute(spill, 2);
  spillAttr.setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute("aSpill", spillAttr);
  lineGeo.instanceCount = EDGES.length;
  const lineMat = shaderMat({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    uniforms: {
      uLine: { value: new THREE.Color(params.line) },
      uHalfW: { value: FRAME_H * 0.0007 },
    },
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const lines = new THREE.Mesh(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 1;
  scene.add(lines);

  const black = new THREE.Color(0, 0, 0);

  /** Edge lighting for this frame, a pure function of the frame number. */
  const computeLit = (frame: number) => {
    lit.fill(0);
    const put = (e: number, i0: number, i1: number, from: number, to: number) => {
      const o = e * 4;
      // Keep whichever tracer lights this edge more strongly.
      if (Math.max(i0, i1) * (to - from) <= Math.max(lit[o], lit[o + 1]) * (lit[o + 3] - lit[o + 2])) return;
      lit[o] = i0;
      lit[o + 1] = i1;
      lit[o + 2] = from;
      lit[o + 3] = to;
    };
    for (const tr of TRACERS) {
      const cycles = LOOP / tr.period;
      const g = frame + tr.offset;
      const c = Math.floor((g % LOOP) / tr.period) % cycles;
      const u = (g % tr.period) / tr.period;
      const route = tr.routes[c % tr.routes.length];
      if (!route) continue;
      const n = route.length;
      // Head runs the route in the first ~55 % of the cycle, the lit trail then fades.
      const run = 0.55 / tr.speed;
      const head = Math.min(1, u / run) * n;
      const fadeIn = Math.min(1, u / 0.03);
      const fadeOut = 1 - Math.min(1, Math.max(0, (u - run) / Math.max(0.05, 0.92 - run)));
      const env = fadeIn * fadeOut * fadeOut;
      if (env <= 0) continue;
      const bright = (x: number) => env * (0.3 + 1.3 * Math.exp(-(head - x) / 1.2));
      for (let k = 0; k < n; k++) {
        if (head <= k) break;
        const to = Math.min(1, head - k);
        const b0 = bright(k);
        const b1 = bright(k + to);
        const st = route[k];
        // Values are given at param 0 and 1; extrapolate b1 to param 1 linearly.
        const i1 = to > 0 ? b0 + (b1 - b0) / to : b0;
        if (st.reversed) put(st.edge, i1, b0, 1 - to, 1);
        else put(st.edge, b0, i1, 0, to);
      }
    }
    // Lit edges bleed a fading glow into the edges that meet them, so lit
    // regions read as a glowing mesh rather than single wires.
    spill.fill(0);
    for (let e = 0; e < EDGES.length; e++) {
      const o = e * 4;
      if (lit[o + 3] <= lit[o + 2]) continue;
      const atA = lit[o + 2] < 0.01 ? lit[o] : 0;
      const atB = lit[o + 3] > 0.99 ? lit[o + 1] : 0;
      for (const [key, b] of [[EDGES[e].a, atA], [EDGES[e].b, atB]] as const) {
        if (b <= 0) continue;
        for (const nb of AT_VERTEX.get(key) ?? []) {
          if (nb.edge === e) continue;
          const so = nb.edge * 2 + (nb.atStart ? 0 : 1);
          spill[so] = Math.max(spill[so], b * SPILL);
        }
      }
    }
    litAttr.needsUpdate = true;
    spillAttr.needsUpdate = true;
  };

  return {
    render(frame) {
      post.ensureSize();
      const ph = phaseOf(frame);
      const a = ph * TAU;
      const yaw = ((1.5 * Math.PI) / 180) * Math.sin(a);
      const pitch = ((1.0 * Math.PI) / 180) * Math.sin(a + Math.PI / 2);
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * CAM_DIST,
        Math.sin(pitch) * CAM_DIST,
        Math.cos(yaw) * Math.cos(pitch) * CAM_DIST,
      );
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      tileMat.uniforms.uF.value = frame;
      tileMat.uniforms.uCS.value.set(Math.cos(a), Math.sin(a));
      tileMat.uniforms.uCamPos.value.copy(camera.position);
      computeLit(frame);
      post.beginScene(black);
      gl.render(scene, camera);
      post.finish(frame);
    },
    dispose() {
      post.dispose();
      tiles.geometry.dispose();
      tileMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
};
