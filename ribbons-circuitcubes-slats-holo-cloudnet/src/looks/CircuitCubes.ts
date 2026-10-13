import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { defaultPost } from "../engine/post";
import { lin } from "../engine/fullscreen";
import { LookFactory } from "../engine/Stage";
import { TAU, mulberry32, phaseOf } from "../engine/rng";

// Look 2 — a tilted circuit board; clusters of glass cubes linked by
// right-angled glowing traces to a bright core cube. Pulses run inward with
// periods dividing 600 frames; a cluster flashes when its pulse lands.

export type CircuitParams = {
  boardBase: string;
  boardLine: string;
  haze: string;
  cyan: string;
  blue: string;
  trace: string;
  core: string;
};

// ---------- layout (module level, seeded once) ----------
const rng = mulberry32(0xc1c0be);
const CUBE = 0.2; // small cube edge
const PITCH = CUBE * 1.16;

// The layout is placed in screen-aligned coordinates for the camera's ~30°
// rotation (r = to the right of the core, f = away from camera), so the network
// fills the right of frame and leaves the hazy board empty on the left.
const AZ = (30 * Math.PI) / 180;
const toBoard = (r: number, f: number) => ({ x: r * Math.cos(AZ) - f * Math.sin(AZ), z: -r * Math.sin(AZ) - f * Math.cos(AZ) });

type Cluster = { x: number; z: number; cubes: { x: number; y: number; z: number }[]; cycles: number; offset: number; color: number };

const CLUSTER_SITES: [number, number, number, number][] = [
  // r, f, footprint radius (cells), height scale
  [-2.9, 0.9, 2.6, 1.5],
  [-1.6, 2.4, 1.5, 1.0],
  [-3.6, -0.4, 1.2, 0.7],
  [1.0, 3.6, 1.6, 1.0],
  [2.6, 5.4, 1.8, 1.1],
  [0.0, 6.6, 1.5, 0.9],
  [4.4, 3.0, 1.4, 0.8],
  [3.4, 0.6, 1.2, 0.7],
  [-0.4, -2.6, 1.0, 0.6],
  [1.9, -1.8, 1.0, 0.6],
  [3.6, -3.4, 2.0, 1.1],
  [-1.6, -3.4, 1.1, 0.5],
  [5.6, 6.8, 1.5, 0.9],
  [-2.6, 4.6, 1.2, 0.8],
];
const CYCLE_SET = [1, 2, 3, 4, 5, 6]; // pulses per 600 frames → periods 600,300,200,150,120,100

const CLUSTERS: Cluster[] = CLUSTER_SITES.map(([r, f, size, hs]) => {
  const { x: cx, z: cz } = toBoard(r, f);
  const cubes: Cluster["cubes"] = [];
  const R = Math.ceil(size);
  for (let gx = -R; gx <= R; gx++)
    for (let gz = -R; gz <= R; gz++) {
      const d = Math.hypot(gx, gz * 1.1) / (size + 0.01);
      if (d > 1 || rng() > 1.1 - d * 0.7) continue;
      // stepped towers: taller toward the middle, irregular
      const hgt = Math.max(1, Math.round((1 - d * 0.8) * 4.5 * hs * (0.35 + rng() * 0.9)));
      for (let k = 0; k < hgt; k++) cubes.push({ x: cx + gx * PITCH, y: CUBE / 2 + k * PITCH, z: cz + gz * PITCH });
    }
  return { x: cx, z: cz, cubes, cycles: CYCLE_SET[Math.floor(rng() * CYCLE_SET.length)], offset: rng(), color: rng() < 0.65 ? 0 : 1 };
});

// Right-angled traces (rounded corners) from each cluster to the core.
type Trace = { pts: THREE.Vector2[]; corners: THREE.Vector2[]; cluster: number };
const roundCorners = (pts: THREE.Vector2[], rad: number) => {
  const out: THREE.Vector2[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const r = Math.min(rad, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
    const p0 = b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r));
    const p1 = b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r));
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      // quadratic Bézier through the corner
      out.push(new THREE.Vector2(
        (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * b.x + t * t * p1.x,
        (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * b.y + t * t * p1.y,
      ));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};
const manhattan = (ax: number, az: number, bx: number, bz: number, jog: number, xFirst: boolean) =>
  xFirst
    ? [new THREE.Vector2(ax, az), new THREE.Vector2(ax + (bx - ax) * jog, az), new THREE.Vector2(ax + (bx - ax) * jog, bz), new THREE.Vector2(bx, bz)]
    : [new THREE.Vector2(ax, az), new THREE.Vector2(ax, az + (bz - az) * jog), new THREE.Vector2(bx, az + (bz - az) * jog), new THREE.Vector2(bx, bz)];

const TRACES: Trace[] = [];
CLUSTERS.forEach((c, ci) => {
  const lanes = 1 + (rng() < 0.45 ? 1 : 0);
  for (let l = 0; l < lanes; l++) {
    const off = (l - 0.5 * (lanes - 1)) * 0.11;
    const ex = 0.2 * Math.sign(c.x || 1) + off;
    const ez = 0.2 * Math.sign(c.z || 1) - off;
    const pts = manhattan(c.x + off, c.z + off, ex, ez, 0.25 + rng() * 0.5, rng() < 0.5);
    TRACES.push({ pts: rng() < 0.6 ? roundCorners(pts, 0.35) : pts, corners: pts.slice(1, -1), cluster: ci });
  }
});
// decorative branches between neighbouring clusters and out of frame (no pulses)
const BRANCHES: THREE.Vector2[][] = [];
for (let i = 0; i < 22; i++) {
  const c = CLUSTERS[i % CLUSTERS.length];
  const d = CLUSTERS[(i * 5 + 3) % CLUSTERS.length];
  const tgt = { x: d.x, z: d.z };
  const pts = manhattan(c.x + (rng() - 0.5) * 0.5, c.z + (rng() - 0.5) * 0.5, tgt.x + (rng() - 0.5) * 0.5, tgt.z + (rng() - 0.5) * 0.5, 0.2 + rng() * 0.6, rng() < 0.5);
  BRANCHES.push(rng() < 0.5 ? roundCorners(pts, 0.4) : pts);
}
// short stubs with via dots, only in the network area
const STUBS: THREE.Vector2[][] = Array.from({ length: 70 }, () => {
  const p = toBoard(-2.5 + rng() * 10, -2 + rng() * 10);
  const L = 0.2 + rng() * 0.7;
  return rng() < 0.5 ? [new THREE.Vector2(p.x, p.z), new THREE.Vector2(p.x + L, p.z)] : [new THREE.Vector2(p.x, p.z), new THREE.Vector2(p.x, p.z + L)];
});

// cubes: cluster towers trimmed to 205, plus 35 singles/pairs sitting on traces
const ALL_CUBES: { x: number; y: number; z: number; cluster: number }[] = [];
CLUSTERS.forEach((c, ci) => c.cubes.forEach((q) => ALL_CUBES.push({ ...q, cluster: ci })));
ALL_CUBES.sort((a, b) => a.y - b.y || a.cluster - b.cluster || a.x - b.x);
while (ALL_CUBES.length > 205) ALL_CUBES.pop();
for (let k = 0; ALL_CUBES.length < 240; k++) {
  const tr = TRACES[(k * 7) % TRACES.length];
  const seg = 1 + Math.floor(rng() * (tr.pts.length - 2));
  const p = tr.pts[seg].clone().lerp(tr.pts[seg - 1], rng());
  const stack = rng() < 0.3 ? 2 : 1;
  for (let h = 0; h < stack && ALL_CUBES.length < 240; h++) ALL_CUBES.push({ x: p.x, y: CUBE / 2 + h * PITCH, z: p.y, cluster: tr.cluster });
}

// ---------- shaders ----------
const BOARD_VERT = /* glsl */ `
varying vec2 vXZ;
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vXZ = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const BOARD_FRAG = /* glsl */ `
uniform vec3 base;
uniform vec3 line;
uniform vec3 haze;
uniform vec3 glow;
uniform vec3 hazeDir;
varying vec2 vXZ;
varying vec3 vWorld;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// anti-aliased grid line mask for cell size s (lines of width w world units)
float grid(vec2 p, float s, float w) {
  vec2 q = p / s;
  vec2 fw = fwidth(q);
  vec2 d = abs(fract(q - 0.5) - 0.5);
  vec2 lw = vec2(w / s);
  vec2 a = smoothstep(lw + fw, lw - fw * 0.5, d);
  // fade lines out as they approach pixel size to avoid moire
  float fade = 1.0 - smoothstep(0.15, 0.5, max(fw.x, fw.y));
  return max(a.x, a.y) * fade;
}
// offset groove: dark seam line plus a faint lit bevel on one side
float bevel(vec2 p, float s, float w) {
  vec2 q = p / s;
  vec2 fw = fwidth(q);
  vec2 d = fract(q - 0.5) - 0.5;          // signed distance to the seam, in cells
  vec2 lw = vec2(w / s);
  vec2 hi = smoothstep(lw * 3.0 + fw, lw + fw * 0.5, abs(d - lw * 2.0)); // highlight just past the seam
  float fade = 1.0 - smoothstep(0.15, 0.5, max(fw.x, fw.y));
  return max(hi.x, hi.y) * fade;
}
void main() {
  vec2 p = vXZ;
  // large tiles (1.6), some subdivided into 2x2 (0.8) by a fixed hash of the tile id
  vec2 tile = floor(p / 1.6);
  float sub = step(0.55, h21(tile));
  float g = grid(p, 1.6, 0.016);
  g = max(g, sub * grid(p, 0.8, 0.011));
  float hl = bevel(p, 1.6, 0.016);
  hl = max(hl, sub * bevel(p, 0.8, 0.011));
  // each tile has a slightly different sheen, like separate glossy panels
  float tv = h21(floor(p / (sub > 0.5 ? 0.8 : 1.6)) + 3.1);
  // haze: bright cyan-blue light washing in from the top-left of frame
  float dist = length(p - hazeDir.xz);
  float hazeAmt = exp(-dist * 0.24) * 3.6 + exp(-dist * 0.55) * 2.5;
  // the floor under the network (right of frame) falls off to deep navy
  float netDark = smoothstep(-5.0, 2.0, p.x * 0.866 - p.y * 0.5);
  hazeAmt *= 1.0 - 0.75 * netDark;
  vec3 c = base * (0.9 + 0.2 * tv) * (1.0 - 0.3 * netDark) + haze * hazeAmt * (0.92 + 0.16 * tv);
  // seams: dark grooves with a faint bevel highlight in the line colour
  c = mix(c, c * 0.35, g * 0.9);
  c += line * hl * (0.5 + hazeAmt * 0.4);
  // glow pooled around the core
  c += glow * exp(-dot(p, p) * 0.8) * 0.12;
  gl_FragColor = vec4(c, 1.0);
}`;

const TRACE_VERT = /* glsl */ `
attribute float aS;      // 0 at the cluster, 1 at the core
attribute float aCycles;
attribute float aOffset;
varying float vS;
varying float vCycles;
varying float vOffset;
void main() {
  vS = aS; vCycles = aCycles; vOffset = aOffset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TRACE_FRAG = /* glsl */ `
uniform vec3 color;
uniform float phase;
uniform float baseAlpha;
varying float vS;
varying float vCycles;
varying float vOffset;
void main() {
  float p = fract(phase * vCycles + vOffset); // pulse head position along the trace
  float d = vS - p;
  // bright head plus a short fading tail behind it
  float pulse = exp(-d * d * 900.0) + (d < 0.0 ? 0.45 * exp(d * 14.0) : 0.0);
  pulse *= step(0.5, vCycles);
  vec3 c = color * (baseAlpha + pulse * 3.5);
  gl_FragColor = vec4(c, 1.0);
}`;

export const createCircuitCubes: LookFactory<CircuitParams> = (params, gl) => {
  gl.shadowMap.enabled = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 80);

  const boardMat = new THREE.ShaderMaterial({
    vertexShader: BOARD_VERT,
    fragmentShader: BOARD_FRAG,
    uniforms: {
      base: { value: lin(params.boardBase) },
      line: { value: lin(params.boardLine) },
      haze: { value: lin(params.haze) },
      glow: { value: lin(params.core) },
      hazeDir: { value: new THREE.Vector3(-7.5, 0, -3.0) }, // world position of the haze centre
    },
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), boardMat);
  board.rotation.x = -Math.PI / 2;
  scene.add(board);

  // environment for glass reflections
  const envScene = new THREE.Scene();
  envScene.background = lin(params.boardBase).multiplyScalar(2);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: lin(params.haze).multiplyScalar(2.5), side: THREE.DoubleSide }));
  sky.position.set(-4, 8, -4);
  sky.lookAt(0, 0, 0);
  envScene.add(sky);
  const pmrem = new THREE.PMREMGenerator(gl);
  const envRT = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  scene.environment = envRT.texture;

  // small glass cubes (instanced) with per-instance emissive glow
  const cubeGeo = new RoundedBoxGeometry(CUBE, CUBE, CUBE, 2, CUBE * 0.12);
  const glowAttr = new THREE.InstancedBufferAttribute(new Float32Array(ALL_CUBES.length), 1);
  cubeGeo.setAttribute("aGlow", glowAttr);
  const cubeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0,
    transmission: 0.3,
    thickness: 0.2,
    opacity: 1,
    ior: 1.45,
    emissive: 0xffffff,
    emissiveIntensity: 1,
    envMapIntensity: 1.2,
    clearcoat: 0.6,
  });
  cubeMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;\nvarying vec3 vInstCol;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;\n#ifdef USE_INSTANCING_COLOR\nvInstCol = instanceColor;\n#else\nvInstCol = vec3(1.0);\n#endif");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;\nvarying vec3 vInstCol;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\nfloat fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);\ntotalEmissiveRadiance = vInstCol * (0.18 + vGlow * 1.6 + fres * 0.9);");
  };
  const cubes = new THREE.InstancedMesh(cubeGeo, cubeMat, ALL_CUBES.length);
  const cyan = lin(params.cyan);
  const blue = lin(params.blue);
  const m4 = new THREE.Matrix4();
  ALL_CUBES.forEach((q, i) => {
    m4.makeTranslation(q.x, q.y, q.z);
    cubes.setMatrixAt(i, m4);
    const cl = CLUSTERS[q.cluster];
    const col = (cl.color === 0 ? cyan : blue).clone().lerp(cl.color === 0 ? blue : cyan, ((i * 37) % 10) / 30);
    cubes.setColorAt(i, col);
  });
  scene.add(cubes);

  // core cube
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: lin(params.core),
    emissiveIntensity: 0.16,
    roughness: 0.15,
    transmission: 0.3,
    thickness: 0.4,
    clearcoat: 1,
  });
  const core = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.5, 3, 0.03), coreMat);
  core.position.set(0, 0.25, 0);
  scene.add(core);
  const coreLight = new THREE.PointLight(lin(params.core), 1.5, 4, 1.6);
  coreLight.position.set(0, 0.9, 0);
  scene.add(coreLight);

  // traces: flat ribbons on the board with an arc-length attribute for pulses
  const traceColor = lin(params.trace);
  const buildLines = (lines: { pts: THREE.Vector2[]; cycles: number; offset: number }[], width: number) => {
    const pos: number[] = [];
    const s: number[] = [];
    const cyc: number[] = [];
    const ofs: number[] = [];
    const idx: number[] = [];
    for (const L of lines) {
      let total = 0;
      for (let i = 1; i < L.pts.length; i++) total += L.pts[i].distanceTo(L.pts[i - 1]);
      let acc = 0;
      for (let i = 1; i < L.pts.length; i++) {
        const a = L.pts[i - 1];
        const b = L.pts[i];
        const len = a.distanceTo(b);
        const dx = (b.x - a.x) / len;
        const dz = (b.y - a.y) / len;
        const nx = -dz * width * 0.5;
        const nz = dx * width * 0.5;
        // no overlap at joints: additive blending would bead up where segments meet
        const ax = a.x;
        const az = a.y;
        const bx = b.x;
        const bz = b.y;
        const base = pos.length / 3;
        pos.push(ax + nx, 0.004, az + nz, ax - nx, 0.004, az - nz, bx + nx, 0.004, bz + nz, bx - nx, 0.004, bz - nz);
        const s0 = acc / total;
        const s1 = (acc + len) / total;
        s.push(s0, s0, s1, s1);
        for (let k = 0; k < 4; k++) {
          cyc.push(L.cycles);
          ofs.push(L.offset);
        }
        idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        acc += len;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aS", new THREE.Float32BufferAttribute(s, 1));
    g.setAttribute("aCycles", new THREE.Float32BufferAttribute(cyc, 1));
    g.setAttribute("aOffset", new THREE.Float32BufferAttribute(ofs, 1));
    g.setIndex(idx);
    return g;
  };
  const traceMat = new THREE.ShaderMaterial({
    vertexShader: TRACE_VERT,
    fragmentShader: TRACE_FRAG,
    uniforms: { color: { value: traceColor }, phase: { value: 0 }, baseAlpha: { value: 1.5 } },
    // opaque: overlapping segment quads at bends must not add up into beads
    depthWrite: false,
  });
  const traceGeo = buildLines(
    TRACES.map((t) => ({ pts: t.pts, cycles: CLUSTERS[t.cluster].cycles, offset: CLUSTERS[t.cluster].offset })),
    0.014,
  );
  scene.add(new THREE.Mesh(traceGeo, traceMat));
  const stubMat = traceMat.clone();
  stubMat.uniforms.baseAlpha.value = 0.9;
  const stubGeo = buildLines([...STUBS, ...BRANCHES].map((pts) => ({ pts, cycles: 0, offset: 0.5 })), 0.012);
  scene.add(new THREE.Mesh(stubGeo, stubMat));

  // via dots at trace corners and stub ends
  const vias: THREE.Vector2[] = [];
  // vias on the sharp corners only (rounded bends get none)
  TRACES.forEach((t) => { if (t.pts.length === t.corners.length + 2) t.corners.forEach((p) => vias.push(p)); vias.push(t.pts[0]); });
  STUBS.forEach((st) => vias.push(st[1]));
  BRANCHES.forEach((b) => vias.push(b[b.length - 1]));
  const viaMat = new THREE.MeshBasicMaterial({ color: traceColor.clone().multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const viaMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.032, 16), viaMat, vias.length);
  vias.forEach((p, i) => {
    m4.makeRotationX(-Math.PI / 2).setPosition(p.x, 0.006, p.y);
    viaMesh.setMatrixAt(i, m4);
  });
  scene.add(viaMesh);

  scene.add(new THREE.HemisphereLight(lin(params.haze), lin(params.boardBase), 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-6, 10, -4);
  scene.add(key);

  return {
    scene,
    camera,
    update: (frame, w, h) => {
      const t = phaseOf(frame);
      traceMat.uniforms.phase.value = t;
      // flash: decays after each pulse arrival (pulse head reaches s = 1)
      ALL_CUBES.forEach((q, i) => {
        const c = CLUSTERS[q.cluster];
        const since = (t * c.cycles + c.offset) % 1; // 0 right after arrival... arrival at p=1 ≡ 0
        glowAttr.array[i] = Math.exp(-since * 9) * 1.0 + 0.04 * Math.sin(TAU * (t * 2) + q.x * 3 + q.z * 2);
      });
      glowAttr.needsUpdate = true;
      const w0 = TAU * t;
      camera.aspect = w / h;
      // ~45° down, rotated ~30°, slow closed drift and push
      const az = THREE.MathUtils.degToRad(30) + 0.05 * Math.sin(w0);
      const el = THREE.MathUtils.degToRad(47) + 0.02 * Math.sin(w0 + 1.3);
      const dist = 9.6 - 0.5 * (0.5 - 0.5 * Math.cos(w0));
      const target = new THREE.Vector3(-2.05 + 0.12 * Math.sin(w0 + 0.4), 0, 1.2);
      camera.position.set(
        target.x + dist * Math.cos(el) * Math.sin(az),
        dist * Math.sin(el),
        target.z + dist * Math.cos(el) * Math.cos(az),
      );
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    },
    post: () => ({
      ...defaultPost(),
      focus: camera.position.distanceTo(core.position),
      dofFar: 0.012,
      dofNear: 0.034,
      dofRange: 2.0,
      bloom: 0.25,
      bloomThreshold: 1.3,
      bloomRadius: 0.85,
      vignette: 0.3,
      exposure: 1.0,
    }),
    dispose: () => {
      [cubeGeo, traceGeo, stubGeo, board.geometry, core.geometry, viaMesh.geometry].forEach((g) => g.dispose());
      [cubeMat, coreMat, traceMat, stubMat, viaMat, boardMat].forEach((m) => m.dispose());
      envRT.dispose();
    },
  };
};
