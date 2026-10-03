import * as THREE from "three";
import { mulberry32, smoothstep } from "../lib/random";
import { easeInOutCubic, easeOutBack, glowPointsMaterial } from "../lib/three-util";
import { GlossyReflector, REFLECT_GLSL } from "../lib/reflector";
import type { Look } from "../lib/look";

export type NetworkParams = { cyan: string; lime: string; floor: string };

// ---- seeded network layout (pure data, built once per tab) --------------
const rng = mulberry32(0x2e7);
const LINE_START = 18; // frame the first trace leaves the core
const FRAMES_PER_UNIT = 10.5; // growth speed along the traces
const RMAX = 17;
const LAT = 0.5; // lattice

type P = { x: number; z: number; d: number };
type NodeSite = { x: number; z: number; d: number; kind: number; lime: boolean };
const lines: P[][] = [];
const sites: NodeSite[] = [];
const taken = new Set<string>();
const used = new Set<string>();
const CELL = 1.1;
const key = (x: number, z: number) => `${Math.round(x / CELL)},${Math.round(z / CELL)}`;
const free = (x: number, z: number) => {
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (taken.has(`${Math.round(x / CELL) + i},${Math.round(z / CELL) + j}`)) return false;
  return Math.hypot(x, z) > 1.6;
};
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// nodes gather in a few seeded clusters, leaving open floor between them
const CLUSTERS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + rng() * 0.6, r = 4 + rng() * 10;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, s: 2.2 + rng() * 2 };
});
const clusterW = (x: number, z: number) =>
  Math.max(...CLUSTERS.map((c) => Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.s * c.s))), Math.exp(-(x * x + z * z) / 8));
const outward = (x: number, z: number, d: number[]) => (x * d[0] + z * d[1]) / (Math.hypot(x, z) + 1e-6);

const grow = (x: number, z: number, dir: number[], d: number, depth: number) => {
  const pts: P[] = [{ x, z, d }];
  const nseg = 2 + Math.floor(rng() * 5);
  for (let s = 0; s < nseg; s++) {
    const len = (2 + Math.floor(rng() * 6)) * LAT;
    const nx = x + dir[0] * len, nz = z + dir[1] * len;
    if (Math.hypot(nx, nz) > RMAX) break;
    // traces never run over each other: stop where a lattice cell is taken
    let blocked = false;
    for (let k = 1; k <= Math.round(len / LAT); k++) {
      const c = `${Math.round((x + dir[0] * k * LAT) / LAT)},${Math.round((z + dir[1] * k * LAT) / LAT)}`;
      if (used.has(c)) { blocked = true; break; }
    }
    if (blocked) {
      // try turning once before giving up
      const side = rng() < 0.5 ? 1 : -1;
      dir = [dir[1] * side, -dir[0] * side];
      if (s < nseg - 1) continue;
      break;
    }
    for (let k = 1; k <= Math.round(len / LAT); k++) used.add(`${Math.round((x + dir[0] * k * LAT) / LAT)},${Math.round((z + dir[1] * k * LAT) / LAT)}`);
    x = nx; z = nz; d += len;
    pts.push({ x, z, d });
    if (rng() < 0.08 + 0.92 * clusterW(x, z) && free(x, z)) {
      taken.add(key(x, z));
      const r = rng();
      sites.push({ x, z, d, kind: r < 0.4 ? 0 : r < 0.6 ? 1 : r < 0.88 ? 2 : 3, lime: false });
    }
    if (depth < 4 && rng() < 0.4) {
      const side = rng() < 0.5 ? 1 : -1;
      grow(x, z, [dir[1] * side, -dir[0] * side], d, depth + 1);
    }
    if (rng() < 0.5) {
      const a = [dir[1], -dir[0]], b = [-dir[1], dir[0]];
      const pref = outward(x, z, a) > outward(x, z, b) ? a : b;
      dir = rng() < 0.75 ? pref : pref === a ? b : a;
    }
  }
  // every trace ends at a node
  const last = pts[pts.length - 1];
  if (pts.length > 1 && free(last.x, last.z) && rng() < 0.2 + 0.8 * clusterW(last.x, last.z)) {
    taken.add(key(last.x, last.z));
    sites.push({ x: last.x, z: last.z, d: last.d, kind: rng() < 0.6 ? 0 : 1, lime: rng() < 0.04 });
  }
  if (pts.length > 1) lines.push(pts);
};
// trunks leave the core from each side at distinct offsets
for (const off of [0, -1, 1]) {
  for (let k = 0; k < 4; k++) {
    const dir = DIRS[k];
    const sx = dir[0] * 0.5 + dir[1] * off * LAT, sz = dir[1] * 0.5 + dir[0] * off * LAT;
    grow(sx, sz, dir, Math.abs(off) * 0.6 + rng() * 0.3, 0);
  }
}
// keep sprouting side branches from existing traces until the network is dense enough
for (let attempt = 0; attempt < 220 && sites.length < 90; attempt++) {
  const l = lines[Math.floor(rng() * lines.length)];
  const i = Math.floor(rng() * (l.length - 1));
  const a = l[i], b = l[i + 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.round(len / LAT));
  const k = Math.floor(rng() * steps);
  const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
  const side = rng() < 0.5 ? 1 : -1;
  grow(a.x + tx * k * LAT, a.z + tz * k * LAT, [Math.round(tz * side), Math.round(-tx * side)], a.d + k * LAT, 2);
}
// nodes: each site becomes 1..4 boxes
type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; pop: number; lime: boolean; dim?: boolean };
const boxes: Box[] = [];
const pads: { x: number; z: number; s: number; pop: number; lime: boolean }[] = [];
const boxTint = (n: number) => Array.from({ length: n }, () => rng());
for (const s of sites) {
  const first = boxes.length;
  const dim = rng() < 0.22; // a few whole sites are deeper blue glass
  const pop = LINE_START + s.d * FRAMES_PER_UNIT;
  const base = 0.42 + rng() * 0.26;
  if (s.kind === 0) {
    boxes.push({ x: s.x, y: 0, z: s.z, sx: base, sy: base, sz: base, pop, lime: s.lime });
  } else if (s.kind === 1) {
    // stack
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) boxes.push({ x: s.x, y: i * base * 0.62, z: s.z, sx: base * 1.1, sy: base * 0.5, sz: base * 1.1, pop: pop + i * 4, lime: s.lime });
  } else if (s.kind === 2) {
    // cluster
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const b = base * (0.7 + rng() * 0.5);
      boxes.push({ x: s.x + (rng() - 0.5) * 0.9, y: 0, z: s.z + (rng() - 0.5) * 0.9, sx: b, sy: b * (0.6 + rng() * 0.9), sz: b, pop: pop + i * 3, lime: s.lime && i === 0 });
    }
  } else {
    // tall tower
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) boxes.push({ x: s.x, y: i * base * 0.9, z: s.z, sx: base, sy: base * 0.82, sz: base, pop: pop + i * 4, lime: s.lime });
  }
  for (let i = first; i < boxes.length; i++) boxes[i].dim = dim;
  pads.push({ x: s.x, z: s.z, s: base * (s.kind === 2 ? 2.6 : 1.9), pop, lime: s.lime });
}

const tints = boxTint(boxes.length);
const dims = boxes.map((b) => !!b.dim);

// floor ribbon with rounded 90-degree corners; returns pts with distance
const fillet = (pts: P[], r: number) => {
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.z - a.z), l2 = Math.hypot(c.x - b.x, c.z - b.z);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const i1 = { x: b.x - ((b.x - a.x) / l1) * rr, z: b.z - ((b.z - a.z) / l1) * rr };
    const o1 = { x: b.x + ((c.x - b.x) / l2) * rr, z: b.z + ((c.z - b.z) / l2) * rr };
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, u = 1 - t;
      out.push({ x: u * u * i1.x + 2 * u * t * b.x + t * t * o1.x, z: u * u * i1.z + 2 * u * t * b.z + t * t * o1.z, d: 0 });
    }
  }
  out.push(pts[pts.length - 1]);
  for (let i = 1; i < out.length; i++) out[i].d = out[i - 1].d + Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z);
  return out;
};

// camera keyframes
const camAt = (f: number) => {
  let dist: number, elev: number, az: number, ty: number, fov: number;
  if (f < 60) {
    const t = f / 60;
    dist = 11.0 - 0.6 * t; elev = 38; az = 46 - 1.5 * t; ty = 0.45; fov = 17;
  } else if (f < 330) {
    const t = easeInOutCubic((f - 60) / 270);
    dist = 10.4 + (30 - 10.4) * t; elev = 38 + (44 - 38) * t; az = 44.5 + (34 - 44.5) * t; ty = 0.45 * (1 - t); fov = 17 + (30 - 17) * t;
  } else {
    const t = (f - 330) / 120;
    dist = 30 + 1.8 * t; elev = 44 + 0.5 * t; az = 34 - 3.5 * t; ty = 0; fov = 30;
  }
  const e = (elev * Math.PI) / 180, a = (az * Math.PI) / 180;
  return { pos: new THREE.Vector3(dist * Math.cos(e) * Math.sin(a), dist * Math.sin(e) + ty, dist * Math.cos(e) * Math.cos(a)), target: new THREE.Vector3(0, ty, 0), dist, fov };
};

const GLASS_VERT = /* glsl */ `
  attribute vec3 iColor; attribute float iGlow;
  varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vY; varying vec3 vCol; varying float vGlow;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 w = m * vec4(position, 1.0);
    vN = normalize(mat3(m) * normal);
    vV = normalize(cameraPosition - w.xyz);
    vUv = uv; vY = position.y + 0.5; vCol = iColor; vGlow = iGlow;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const GLASS_FRAG = /* glsl */ `
  uniform float frameW;
  varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vY; varying vec3 vCol; varying float vGlow;
  void main() {
    float e = max(abs(vUv.x * 2.0 - 1.0), abs(vUv.y * 2.0 - 1.0));
    float fr = smoothstep(1.0 - frameW * 1.6, 1.0 - frameW * 0.6, e);
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    float top = smoothstep(0.5, 0.9, vN.y);
    // frosted glass: lit from inside (brighter low down), top face milky
    vec3 body = vCol * (0.45 + 0.75 * (1.0 - vY)) + mix(vCol, vec3(1.0), 0.3) * top * 0.35;
    vec3 c = body * vGlow + mix(vCol, vec3(1.0), 0.25) * fr * vGlow * 0.8 + vCol * fres * 0.6 * vGlow;
    gl_FragColor = vec4(c, 1.0);
  }`;

export const NetworkGrowth: Look<NetworkParams> = {
  assets: [],
  create: ({ width, height, params }) => {
    const scene = new THREE.Scene();
    const cyan = new THREE.Color(params.cyan), lime = new THREE.Color(params.lime), floorCol = new THREE.Color(params.floor);
    scene.background = floorCol.clone().multiplyScalar(0.3);
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);

    // ---- floor tiles ----
    const reflector = new GlossyReflector(width, height, 0.5, 0.04, 2);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: {
        tReflect: { value: reflector.texture }, textureMatrix: { value: reflector.textureMatrix },
        base: { value: floorCol }, cyan: { value: cyan }, tile: { value: 5.6 },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        ${REFLECT_GLSL}
        uniform vec3 base; uniform vec3 cyan; uniform float tile; varying vec3 vW;
        float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        void main() {
          vec2 g = vW.xz / tile; // seams cross under the core cube
          vec2 id = floor(g);
          vec2 f = fract(g);
          vec2 dd = min(f, 1.0 - f) * tile;
          float seam = min(dd.x, dd.y);
          float aa = fwidth(seam) + 1e-4;
          float groove = smoothstep(0.04 - aa, 0.04 + aa, seam);
          float bevel = smoothstep(0.07 - aa, 0.07 + aa, seam) * (1.0 - smoothstep(0.085 - aa, 0.085 + aa, seam));
          float r = length(vW.xz);
          // broad satin gradient across each slab
          vec3 c = base * (1.35 + 0.3 * h(id)) * (0.85 + 0.3 * f.x * f.y);
          c *= 0.12 + 0.88 * groove;
          c += cyan * 0.14 * bevel; // thin bright line beside each groove
          float inset = 1.0 - smoothstep(0.0, aa * 1.5, abs(seam - 0.45)); // panel inset line
          c += cyan * 0.04 * inset;
          c += cyan * 0.12 * exp(-r / 2.2);
          c += sampleReflection(vW, vec2(0.0)) * 0.012;
          c *= 1.15;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // ---- traces ----
    const pos: number[] = [], uvs: number[] = [], dist: number[] = [], idx: number[] = [];
    let vbase = 0;
    const W = 0.045;
    const addRibbon = (pts: P[], w: number, y: number) => {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b.x - a.x, tz = b.z - a.z;
        const l = Math.hypot(tx, tz) || 1;
        tx /= l; tz /= l;
        for (const s of [-1, 1]) {
          pos.push(pts[i].x - tz * w * 0.5 * s, y, pts[i].z + tx * w * 0.5 * s);
          uvs.push(0, s);
          dist.push(pts[i].d);
        }
        if (i > 0) { const k = vbase + i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
      }
      vbase += pts.length * 2;
    };
    lines.forEach((l) => addRibbon(fillet(l, 0.9), W, 0.012));
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    lineGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    lineGeo.setAttribute("dist", new THREE.Float32BufferAttribute(dist, 1));
    lineGeo.setIndex(idx);
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { front: { value: 0 }, frame: { value: 0 }, cyan: { value: cyan } },
      vertexShader: `attribute float dist; varying float vD; varying vec2 vUv; void main(){ vD = dist; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float front; uniform float frame; uniform vec3 cyan; varying float vD; varying vec2 vUv;
        void main() {
          if (vD > front) discard;
          float across = exp(-vUv.y * vUv.y * 2.0);
          float head = exp(-max(front - vD, 0.0) / 0.35) * 4.0;
          float run = exp(-pow((fract(vD / 2.2 - frame * 0.03) - 0.5) / 0.025, 2.0)) * 3.0;
          vec3 c = cyan * (1.3 + head + run) * across;
          gl_FragColor = vec4(c, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.frustumCulled = false;
    scene.add(lineMesh);

    // ---- glowing pads under nodes (+ core outline) ----
    const padGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const padMat = new THREE.ShaderMaterial({
      vertexShader: `attribute vec3 iColor; attribute float iRing; varying float vRing; varying vec2 vUv; varying vec3 vCol; void main(){ vRing = iRing; vUv = uv; vCol = iColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vRing; varying vec2 vUv; varying vec3 vCol;
        void main(){ vec2 q = abs(vUv * 2.0 - 1.0); float e = max(q.x, q.y);
          float ring = smoothstep(0.78, 0.82, e) * (1.0 - smoothstep(0.84, 0.88, e)) + vRing * smoothstep(0.9, 0.93, e) * (1.0 - smoothstep(0.95, 0.98, e));
          float fill = exp(-dot(q, q) * 2.0) * 0.7;
          gl_FragColor = vec4(vCol * (ring * 2.4 * vRing + fill), 1.0); }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const NP = pads.length + 1;
    const padMesh = new THREE.InstancedMesh(padGeo, padMat, NP);
    const padCol = new Float32Array(NP * 3);
    padMesh.geometry.setAttribute("iColor", new THREE.InstancedBufferAttribute(padCol, 3));
    const padRing = new Float32Array(NP);
    padRing[NP - 1] = 1;
    padMesh.geometry.setAttribute("iRing", new THREE.InstancedBufferAttribute(padRing, 1));
    padMesh.frustumCulled = false;
    scene.add(padMesh);

    // ---- node boxes (instanced frosted glass) ----
    const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const glassMat = new THREE.ShaderMaterial({ uniforms: { frameW: { value: 0.06 } }, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG });
    const NB = boxes.length;
    const boxMesh = new THREE.InstancedMesh(boxGeo, glassMat, NB);
    const bCol = new Float32Array(NB * 3), bGlow = new Float32Array(NB);
    boxMesh.geometry.setAttribute("iColor", new THREE.InstancedBufferAttribute(bCol, 3));
    boxMesh.geometry.setAttribute("iGlow", new THREE.InstancedBufferAttribute(bGlow, 1));
    boxMesh.frustumCulled = false;
    scene.add(boxMesh);
    boxes.forEach((b, i) => {
      const c = b.lime ? lime : dims[i] ? new THREE.Color(0.05, 0.3, 1.0) : cyan.clone().lerp(new THREE.Color(0.02, 0.5, 1.0), 0.25 + tints[i] * 0.35);
      bCol.set([c.r, c.g, c.b], i * 3);
    });

    // ---- core cube: silver metal frame around glowing panels ----
    const core = new THREE.Group();
    scene.add(core);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.94, 0.94).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.62, 1.0).multiplyScalar(1.15) }),
    );
    core.add(panel);
    const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color("#e6eef6"), metalness: 0.6, roughness: 0.18, emissive: new THREE.Color("#4a7090") });
    const BW = 0.05; // beam width
    const beam = new THREE.BoxGeometry(1, 1, 1);
    const edgesL: [number, number, number, number, number, number][] = [];
    for (const a of [-0.5, 0.5]) for (const b2 of [-0.5, 0.5]) {
      edgesL.push([0, 0.5 + a, b2, 1 + BW, BW, BW]); // along x
      edgesL.push([a, 0.5, b2, BW, 1 + BW, BW]); // vertical
      edgesL.push([a, 0.5 + b2, 0, BW, BW, 1 + BW]); // along z
    }
    edgesL.forEach(([x, y, z, sx, sy, sz]) => {
      const m = new THREE.Mesh(beam, metal);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      core.add(m);
    });
    scene.add(new THREE.HemisphereLight(new THREE.Color("#cfefff"), new THREE.Color("#0a2a50"), 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 6, 4);
    scene.add(key);

    // short electric sparks around the core (seeded jagged polylines + bright tips)
    const sparkRng = mulberry32(0x5a7c);
    const SPARKS: [number, number, number, number, number, number, number][] = [
      // start xyz, direction xyz, length
      [0, 1.05, 0, 0, 1, 0, 0.45],
      [0.45, 1.0, -0.45, 0.6, 0.5, -0.3, 0.4],
      [0.52, 0.62, 0.0, 1, 0.08, -0.1, 0.75],
      [0.52, 0.3, 0.25, 1, 0.12, 0.3, 0.6],
      [0.1, 1.02, 0.2, 0.3, 1, 0.5, 0.3],
    ];
    const wPos: number[] = [], wIdx: number[] = [], tipPos: number[] = [];
    SPARKS.forEach(([x, y, z, dx, dy, dz, len]) => {
      const d = new THREE.Vector3(dx, dy, dz).normalize();
      const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0.3, 0.2, 1)).normalize();
      const up = new THREE.Vector3().crossVectors(d, side).normalize();
      const N = 10;
      const b0 = wPos.length / 3;
      let p = new THREE.Vector3(x, y, z);
      for (let i = 0; i <= N; i++) {
        if (i > 0) p = p.clone().addScaledVector(d, len / N).addScaledVector(side, (sparkRng() - 0.5) * 0.06).addScaledVector(up, (sparkRng() - 0.5) * 0.06);
        const w = 0.007 * (1 - i / N) + 0.003;
        // two crossed ribbons so the spark reads from any angle
        wPos.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
        wPos.push(p.x - up.x * w, p.y - up.y * w, p.z - up.z * w, p.x + up.x * w, p.y + up.y * w, p.z + up.z * w);
        if (i > 0) {
          const q0 = b0 + (i - 1) * 4, q1 = b0 + i * 4;
          wIdx.push(q0, q1, q0 + 1, q0 + 1, q1, q1 + 1, q0 + 2, q1 + 2, q0 + 3, q0 + 3, q1 + 2, q1 + 3);
        }
      }
      tipPos.push(p.x, p.y, p.z);
    });
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(wPos, 3));
    wireGeo.setIndex(wIdx);
    const wires = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({ color: cyan.clone().lerp(new THREE.Color(0.2, 0.5, 1), 0.3).multiplyScalar(3), side: THREE.DoubleSide }));
    scene.add(wires);
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute("position", new THREE.Float32BufferAttribute(tipPos, 3));
    tipGeo.setAttribute("size", new THREE.Float32BufferAttribute(tipPos.map(() => 7).slice(0, tipPos.length / 3), 1));
    tipGeo.setAttribute("pcolor", new THREE.Float32BufferAttribute(tipPos.map(() => 2.5), 3));
    const tips = new THREE.Points(tipGeo, glowPointsMaterial(height, { sharp: 0.4 }));
    tips.frustumCulled = false;
    scene.add(tips);

    // ---- lime accents: tiny glowing tags hovering beside some nodes ----
    const tagSites = sites.filter((_, i) => i % 9 === 4);
    const tagMat = new THREE.ShaderMaterial({
      uniforms: { cyan: { value: cyan.clone().multiplyScalar(1.6) }, lime: { value: lime.clone().multiplyScalar(1.6) } },
      vertexShader: `varying vec2 vUv; varying float vId; void main(){ vUv = uv; vId = float(gl_InstanceID); gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 cyan; uniform vec3 lime; varying vec2 vUv; varying float vId;
        void main(){ vec2 g = fract(vUv * 3.0) - 0.5; if (length(g) > 0.32) discard;
          gl_FragColor = vec4(mod(vId, 4.0) < 1.0 ? lime : cyan, 1.0); }`,
      side: THREE.DoubleSide,
    });
    const tagMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), tagMat, tagSites.length);
    tagMesh.frustumCulled = false;
    scene.add(tagMesh);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const post = {
      exposure: 1.0,
      tonemap: "aces" as const,
      bloom: { strength: 2.8, threshold: 0.45, knee: 0.5, radius: 0.85 },
      dof: { focus: 5, range: 6, nearRange: 3, maxBlur: 0.008, maxNearBlur: 0.006 },
      grain: 0.02,
      grainPeriod: 0,
      grade: { saturation: 1.4 },
    };

    const update = (frame: number) => {
      const cam = camAt(frame);
      camera.position.copy(cam.pos);
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(cam.target);
      // DOF follows the core cube; shallow when close, nearly none when wide
      const wide = smoothstep(11, 22, cam.dist);
      post.dof.focus = cam.dist;
      // long lens close-up: little visible blur; wide shot: shallow band of focus
      post.dof.range = 6 + 6 * wide;
      post.dof.maxBlur = 0.004 + 0.004 * wide;
      post.dof.nearRange = 4 + 5 * wide;
      post.dof.maxNearBlur = 0.003 + 0.005 * wide;

      const front = (frame - LINE_START) / FRAMES_PER_UNIT;
      lineMat.uniforms.front.value = front;
      lineMat.uniforms.frame.value = frame;

      boxes.forEach((b, i) => {
        const age = frame - b.pop;
        let sxz = 0, sy = 0, glow = 0;
        if (age > 0) {
          const t = Math.min(1, age / 12);
          sy = Math.max(0, easeOutBack(t, 2.2));
          sxz = 0.9 + 0.1 * Math.min(1, age / 8);
          glow = 1 + 1.8 * Math.exp(-age / 9);
        }
        q.identity();
        v.set(b.x, b.y * sy, b.z);
        sc.set(b.sx * sxz + 1e-4, b.sy * sy + 1e-4, b.sz * sxz + 1e-4);
        m4.compose(v, q, sc);
        boxMesh.setMatrixAt(i, m4);
        bGlow[i] = glow * (dims[i] ? 0.9 : 1.5);
      });
      boxMesh.instanceMatrix.needsUpdate = true;
      (boxMesh.geometry.attributes.iGlow as THREE.BufferAttribute).needsUpdate = true;

      pads.forEach((p, i) => {
        const age = frame - p.pop;
        const k = age > 0 ? Math.min(1, age / 10) : 0;
        m4.compose(v.set(p.x, 0.006, p.z), q.identity(), sc.set(p.s * (0.6 + 0.4 * k) + 1e-4, 1, p.s * (0.6 + 0.4 * k) + 1e-4));
        padMesh.setMatrixAt(i, m4);
        const c = p.lime ? lime : cyan;
        const b = k * (1 + 1.5 * Math.exp(-Math.max(age, 0) / 10));
        padCol.set([c.r * b, c.g * b, c.b * b], i * 3);
      });
      const coreGlow = 5 + 0.4 * Math.sin(frame * 0.15);
      m4.compose(v.set(0, 0.006, 0), q.identity(), sc.set(1.22, 1, 1.22));
      padMesh.setMatrixAt(pads.length, m4);
      padCol.set([cyan.r * coreGlow, cyan.g * coreGlow, cyan.b * coreGlow], pads.length * 3);
      padMesh.instanceMatrix.needsUpdate = true;
      (padMesh.geometry.attributes.iColor as THREE.BufferAttribute).needsUpdate = true;

      tagSites.forEach((s, i) => {
        const age = frame - s.d * FRAMES_PER_UNIT - LINE_START - 10;
        const k = age > 0 ? Math.min(1, age / 10) : 0;
        m4.compose(v.set(s.x + 0.45, 0.9, s.z + 0.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.6, 0)), sc.set(k + 1e-4, k + 1e-4, 1));
        tagMesh.setMatrixAt(i, m4);
      });
      tagMesh.instanceMatrix.needsUpdate = true;
    };

    return {
      scene,
      camera,
      update,
      beforeRender: (gl) => reflector.update(gl, scene, camera, floor),
      post,
    };
  },
};

export const NETWORK_STATS = { boxes: boxes.length, sites: sites.length, lines: lines.length };
