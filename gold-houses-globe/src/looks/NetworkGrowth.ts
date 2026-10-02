import * as THREE from "three";
import { mulberry32, smoothstep, TAU } from "../lib/random";
import { easeInOutCubic, easeOutBack } from "../lib/three-util";
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
    if (rng() < 0.7 && free(x, z)) {
      taken.add(key(x, z));
      const r = rng();
      sites.push({ x, z, d, kind: r < 0.45 ? 0 : r < 0.7 ? 1 : r < 0.92 ? 2 : 3, lime: rng() < 0.06 });
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
  if (pts.length > 1 && free(last.x, last.z)) {
    taken.add(key(last.x, last.z));
    sites.push({ x: last.x, z: last.z, d: last.d, kind: rng() < 0.6 ? 0 : 1, lime: rng() < 0.06 });
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
for (let attempt = 0; attempt < 4000 && sites.length < 175; attempt++) {
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
type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; pop: number; lime: boolean };
const boxes: Box[] = [];
const pads: { x: number; z: number; s: number; pop: number; lime: boolean }[] = [];
const boxTint = (n: number) => Array.from({ length: n }, () => rng());
for (const s of sites) {
  const pop = LINE_START + s.d * FRAMES_PER_UNIT;
  const base = 0.26 + rng() * 0.14;
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
  pads.push({ x: s.x, z: s.z, s: base * (s.kind === 2 ? 2.4 : 1.6), pop, lime: s.lime });
}

const tints = boxTint(boxes.length);

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
  let dist: number, elev: number, az: number, ty: number;
  if (f < 60) {
    const t = f / 60;
    dist = 5.0 - 0.35 * t; elev = 27; az = 38 - 1.5 * t; ty = 0.45;
  } else if (f < 330) {
    const t = easeInOutCubic((f - 60) / 270);
    dist = 4.65 + (24 - 4.65) * t; elev = 27 + (41 - 27) * t; az = 36.5 + (24 - 36.5) * t; ty = 0.45 * (1 - t);
  } else {
    const t = (f - 330) / 120;
    dist = 24 + 1.6 * t; elev = 41 + 0.6 * t; az = 24 - 3.5 * t; ty = 0;
  }
  const e = (elev * Math.PI) / 180, a = (az * Math.PI) / 180;
  return { pos: new THREE.Vector3(dist * Math.cos(e) * Math.sin(a), dist * Math.sin(e) + ty, dist * Math.cos(e) * Math.cos(a)), target: new THREE.Vector3(0, ty, 0), dist };
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
    vec3 c = body * vGlow + mix(vCol, vec3(1.0), 0.45) * fr * vGlow * 0.9 + vCol * fres * 0.5 * vGlow;
    gl_FragColor = vec4(c, 1.0);
  }`;

export const NetworkGrowth: Look<NetworkParams> = {
  assets: [],
  create: ({ width, height, params }) => {
    const scene = new THREE.Scene();
    const cyan = new THREE.Color(params.cyan), lime = new THREE.Color(params.lime), floorCol = new THREE.Color(params.floor);
    scene.background = floorCol.clone().multiplyScalar(0.3);
    const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 200);

    // ---- floor tiles ----
    const reflector = new GlossyReflector(width, height, 0.5, 0.02, 2);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: {
        tReflect: { value: reflector.texture }, textureMatrix: { value: reflector.textureMatrix },
        base: { value: floorCol }, cyan: { value: cyan }, tile: { value: 3.4 },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        ${REFLECT_GLSL}
        uniform vec3 base; uniform vec3 cyan; uniform float tile; varying vec3 vW;
        float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        void main() {
          vec2 g = vW.xz / tile + 0.5;
          vec2 id = floor(g);
          vec2 f = fract(g);
          vec2 dd = min(f, 1.0 - f) * tile;
          float seam = min(dd.x, dd.y);
          float aa = fwidth(seam) + 1e-4;
          float groove = smoothstep(0.035 - aa, 0.035 + aa, seam);
          float bevel = smoothstep(0.035 - aa, 0.035 + aa, seam) * (1.0 - smoothstep(0.075 - aa, 0.075 + aa, seam));
          float r = length(vW.xz);
          vec3 c = base * (0.85 + 0.25 * h(id));
          c *= 0.25 + 0.75 * groove;
          c += base * 1.2 * bevel;
          c += cyan * 0.05 * exp(-r / 3.0);
          c += sampleReflection(vW, vec2(0.0)) * 0.16;
          c *= mix(1.0, 0.45, smoothstep(14.0, 40.0, r));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // ---- traces ----
    const pos: number[] = [], uvs: number[] = [], dist: number[] = [], idx: number[] = [];
    let vbase = 0;
    const W = 0.06;
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
    lines.forEach((l) => addRibbon(fillet(l, 0.3), W, 0.012));
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
          vec3 c = cyan * (2.2 + head + run) * across;
          gl_FragColor = vec4(c, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.frustumCulled = false;
    scene.add(lineMesh);

    // ---- glowing pads under nodes (+ core outline) ----
    const padGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const padMat = new THREE.ShaderMaterial({
      vertexShader: `attribute vec3 iColor; varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = iColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vCol;
        void main(){ vec2 q = abs(vUv * 2.0 - 1.0); float e = max(q.x, q.y);
          float ring = smoothstep(0.72, 0.8, e) * (1.0 - smoothstep(0.86, 0.94, e));
          float fill = (1.0 - smoothstep(0.55, 1.0, e)) * 0.6;
          gl_FragColor = vec4(vCol * (ring * 2.2 + fill), 1.0); }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const NP = pads.length + 1;
    const padMesh = new THREE.InstancedMesh(padGeo, padMat, NP);
    const padCol = new Float32Array(NP * 3);
    padMesh.geometry.setAttribute("iColor", new THREE.InstancedBufferAttribute(padCol, 3));
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
      const c = b.lime ? lime : cyan.clone().lerp(new THREE.Color(0.1, 0.35, 1.0), tints[i] * 0.35);
      bCol.set([c.r, c.g, c.b], i * 3);
    });

    // ---- core cube ----
    const coreGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const coreMesh = new THREE.InstancedMesh(coreGeo, new THREE.ShaderMaterial({ uniforms: { frameW: { value: 0.06 } }, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG }), 1);
    const cc = cyan.clone().multiplyScalar(1.0);
    coreMesh.geometry.setAttribute("iColor", new THREE.InstancedBufferAttribute(new Float32Array([cc.r, cc.g, cc.b]), 3));
    coreMesh.geometry.setAttribute("iGlow", new THREE.InstancedBufferAttribute(new Float32Array([2.4]), 1));
    coreMesh.setMatrixAt(0, new THREE.Matrix4().makeScale(1, 1, 1));
    scene.add(coreMesh);

    // short wires from the core
    const wirePts: P[][] = [];
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * TAU + 0.6;
      const pts: P[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push({ x: Math.cos(a0) * (0.5 + t * 0.9), z: Math.sin(a0) * (0.5 + t * 0.9) + 0.15 * Math.sin(t * 6 + k), d: 0 });
      }
      wirePts.push(pts);
    }
    const wPos: number[] = [], wIdx: number[] = [];
    wirePts.forEach((pts, k) => {
      const b = (wPos.length / 3);
      pts.forEach((p, i) => {
        const y = 0.75 + 0.2 * Math.sin(i * 0.4 + k) * (1 - i / 16) - (i / 16) * 0.7;
        const nx = -Math.sin((k / 4) * TAU + 0.6) * 0.008, nz = Math.cos((k / 4) * TAU + 0.6) * 0.008;
        wPos.push(p.x - nx, Math.max(0.02, y) + 0.008, p.z - nz, p.x + nx, Math.max(0.02, y) - 0.008, p.z + nz);
        if (i > 0) { const q = b + i * 2; wIdx.push(q - 2, q, q - 1, q - 1, q, q + 1); }
      });
    });
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(wPos, 3));
    wireGeo.setIndex(wIdx);
    const wires = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({ color: cyan.clone().multiplyScalar(2.5), side: THREE.DoubleSide }));
    scene.add(wires);

    // ---- lime accents: tiny glowing tags hovering beside some nodes ----
    const tagSites = sites.filter((_, i) => i % 9 === 4);
    const tagMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.07), new THREE.MeshBasicMaterial({ color: lime.clone().multiplyScalar(1.6), side: THREE.DoubleSide }), tagSites.length);
    tagMesh.frustumCulled = false;
    scene.add(tagMesh);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const post = {
      exposure: 1.0,
      tonemap: "aces" as const,
      bloom: { strength: 1.5, threshold: 0.55, knee: 0.5, radius: 0.55 },
      dof: { focus: 5, range: 6, nearRange: 3, maxBlur: 0.008, maxNearBlur: 0.006 },
      grain: 0.02,
      grainPeriod: 0,
      grade: { saturation: 1.25 },
    };

    const update = (frame: number) => {
      const cam = camAt(frame);
      camera.position.copy(cam.pos);
      camera.lookAt(cam.target);
      // DOF follows the core cube; shallow when close, nearly none when wide
      const wide = smoothstep(5, 12, cam.dist);
      post.dof.focus = cam.dist;
      post.dof.range = 4 + 30 * wide;
      post.dof.maxBlur = 0.012 * (1 - wide) + 0.002 * wide;
      post.dof.nearRange = 2 + 14 * wide;
      post.dof.maxNearBlur = 0.006 * (1 - wide) + 0.0012 * wide;

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
        bGlow[i] = glow * 1.15;
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
      const coreGlow = 1.6 + 0.2 * Math.sin(frame * 0.15);
      m4.compose(v.set(0, 0.006, 0), q.identity(), sc.set(1.5, 1, 1.5));
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
