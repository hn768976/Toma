import * as THREE from "three";
import { LookInstance } from "../kit/post";
import { easeInOut, LOOP, mulberry32 } from "../kit/random";

export type LedCubeWallParams = {
  block: string;
  led: string;
  seam: string;
  /** Key light strength multiplier (graphite needs more). */
  key: number;
  /** Specular strength. */
  spec: number;
};

// ---------- layout (module level, seeded) ----------

const COLS = 40;
const ROWS_N = 24;
const LEVELS = [0, 0.1, 0.2, 0.3, 0.4];

type Group = { cells: number[]; starts: number[]; durs: number[]; levels: number[] };

const { GROUPS, CELL_GROUP, LED_KIND, LED_SCHED } = (() => {
  const rng = mulberry32(5505);
  const n = COLS * ROWS_N;
  const cellGroup = new Int32Array(n).fill(-1);
  const groups: Group[] = [];
  // Random flood-fill partition into clusters of 2-6 neighbouring cells.
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const start of order) {
    if (cellGroup[start] >= 0) continue;
    const target = 2 + Math.floor(rng() * 5);
    const gi = groups.length;
    const cells = [start];
    cellGroup[start] = gi;
    for (let tries = 0; cells.length < target && tries < 30; tries++) {
      const c = cells[Math.floor(rng() * cells.length)];
      const cx = c % COLS;
      const cy = Math.floor(c / COLS);
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      const [dx, dy] = dirs[Math.floor(rng() * 4)];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS_N) continue;
      const nc = ny * COLS + nx;
      if (cellGroup[nc] >= 0) continue;
      cellGroup[nc] = gi;
      cells.push(nc);
    }
    // Move schedule, periodic in LOOP: K moves at seeded times.
    const K = 2 + Math.floor(rng() * 4);
    const base = rng() * LOOP;
    const starts: number[] = [];
    const durs: number[] = [];
    const levels: number[] = [];
    for (let k = 0; k < K; k++) {
      starts.push((base + (k / K) * LOOP + (rng() - 0.5) * (LOOP / K) * 0.5) % LOOP);
      durs.push(20 + Math.floor(rng() * 21));
    }
    starts.sort((a, b) => a - b);
    let prev = -1;
    for (let k = 0; k < K; k++) {
      let l = Math.floor(rng() * LEVELS.length);
      if (l === prev) l = (l + 1 + Math.floor(rng() * 4)) % LEVELS.length;
      levels.push(l);
      prev = l;
    }
    if (levels[K - 1] === levels[0]) levels[K - 1] = (levels[0] + 2) % LEVELS.length;
    groups.push({ cells, starts, durs, levels });
  }
  // LEDs: ~30% of blocks, ~10% of those brighter and larger.
  const ledKind = new Float32Array(n);
  const periods = [60, 75, 100, 120, 150, 200, 300];
  const ledSched: { period: number; phase: number; duty: number; level: number }[] = [];
  // Clustered: a smooth density field plus short runs along rows/columns.
  const blobs = Array.from({ length: 14 }, () => [rng() * COLS, rng() * ROWS_N, 3 + rng() * 5]);
  for (let i = 0; i < n; i++) {
    const cx = i % COLS;
    const cy = Math.floor(i / COLS);
    let dens = 0.14;
    blobs.forEach(([bx, by, br]) => (dens += 0.3 * Math.exp(-((cx - bx) ** 2 + (cy - by) ** 2) / (br * br))));
    const r = rng();
    ledKind[i] = r < Math.min(0.85, dens) ? (rng() < 0.1 ? 2 : 1) : 0;
    ledSched.push({
      period: periods[Math.floor(rng() * periods.length)],
      phase: Math.floor(rng() * LOOP),
      duty: 0.35 + rng() * 0.55,
      // A spread of brightness: many dim, some full.
      level: 0.35 + 0.65 * Math.pow(rng(), 0.4),
    });
  }
  // Runs: extend some lit LEDs along their row or column.
  for (let k = 0; k < 60; k++) {
    const i = Math.floor(rng() * n);
    const horiz = rng() < 0.5;
    const len = 2 + Math.floor(rng() * 4);
    for (let s = 0; s < len; s++) {
      const cx = (i % COLS) + (horiz ? s : 0);
      const cy = Math.floor(i / COLS) + (horiz ? 0 : s);
      if (cx < COLS && cy < ROWS_N) ledKind[cy * COLS + cx] = ledKind[cy * COLS + cx] || 1;
    }
  }
  return { GROUPS: groups, CELL_GROUP: cellGroup, LED_KIND: ledKind, LED_SCHED: ledSched };
})();

/** Level (depth offset) of a group at frame f. Periodic in LOOP. */
const groupDepth = (g: Group, f: number) => {
  const K = g.starts.length;
  // Find the latest move start <= f (cyclically).
  let k = K - 1;
  for (let i = 0; i < K; i++) if (g.starts[i] <= f) k = i;
  let since = f - g.starts[k];
  if (since < 0) since += LOOP;
  const to = LEVELS[g.levels[k]];
  const from = LEVELS[g.levels[(k - 1 + K) % K]];
  const t = Math.min(1, since / g.durs[k]);
  return from + (to - from) * easeInOut(t);
};

/** LED brightness at frame f with a 3-frame fade at each edge. */
const ledLevel = (i: number, f: number) => {
  const s = LED_SCHED[i];
  const x = (f + s.phase) % s.period;
  const on = s.period * s.duty;
  const fade = 3;
  if (x < fade) return x / fade;
  if (x < on) return 1;
  if (x < on + fade) return 1 - (x - on) / fade;
  return 0;
};

// ---------- shaders ----------

const VERT = /* glsl */ `
attribute vec2 iCell;
attribute float iLed;
uniform sampler2D tState;
uniform vec2 uGrid;
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec2 vCell;
varying float vH;
varying float vLedKind;
varying float vLedOn;
void main() {
  vec4 st = texelFetch(tState, ivec2(iCell), 0);
  float h = st.r;
  vec3 p = position;
  vec3 w;
  w.xy = iCell - uGrid * 0.5 + 0.5 + p.xy * 0.975;
  w.z = p.z > 0.0 ? h : -0.6;
  vLocal = vec3(p.xy * 0.975, w.z);
  vN = normal;
  vWorld = w;
  vCell = iCell;
  vH = h;
  vLedKind = iLed;
  vLedOn = st.g;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D tState;
uniform vec2 uGrid;
uniform vec3 uBlock;
uniform vec3 uLed;
uniform vec3 uLight;
uniform float uKey;
uniform float uSpec;
uniform vec3 uCamPos;
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec2 vCell;
varying float vH;
varying float vLedKind;
varying float vLedOn;

float prot(vec2 cell) {
  ivec2 c = ivec2(clamp(cell, vec2(0.0), uGrid - 1.0));
  return texelFetch(tState, c, 0).r;
}

void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uLight);
  vec3 V = normalize(uCamPos - vWorld);
  float ao = 1.0;
  float shadow = 1.0;
  vec3 emissive = vec3(0.0);
  bool front = N.z > 0.5;
  if (front) {
    // Small bevel: tilt the normal near the face edges.
    vec2 q = vLocal.xy;
    float hw = 0.4875;
    float bev = 0.035;
    vec2 e = smoothstep(hw - bev, hw, abs(q)) * sign(q);
    N = normalize(vec3(e * 0.9, 1.0));
    // Analytic shadow from neighbours toward the light.
    vec2 dir = normalize(L.xy);
    float tanE = L.z / length(L.xy);
    for (int k = 1; k <= 7; k++) {
      float d = float(k) * 0.045;
      vec2 sp = vWorld.xy + dir * d;
      vec2 c = floor(sp + uGrid * 0.5);
      if (all(equal(c, vCell))) continue;
      float hn = prot(c);
      float occ = smoothstep(-0.01, 0.09, hn - (vH + d * tanE));
      shadow = min(shadow, 1.0 - occ);
    }
    shadow = mix(0.62, 1.0, shadow);
    // Contact AO where a neighbour stands higher.
    float hL = prot(vCell + vec2(-1.0, 0.0));
    float hR = prot(vCell + vec2(1.0, 0.0));
    float hD = prot(vCell + vec2(0.0, -1.0));
    float hU = prot(vCell + vec2(0.0, 1.0));
    float dl = q.x + 0.4875, dr = 0.4875 - q.x, dd = q.y + 0.4875, du = 0.4875 - q.y;
    ao *= 1.0 - 0.3 * smoothstep(0.0, 0.25, hL - vH) * exp(-dl / 0.07);
    ao *= 1.0 - 0.3 * smoothstep(0.0, 0.25, hR - vH) * exp(-dr / 0.07);
    ao *= 1.0 - 0.3 * smoothstep(0.0, 0.25, hD - vH) * exp(-dd / 0.07);
    ao *= 1.0 - 0.3 * smoothstep(0.0, 0.25, hU - vH) * exp(-du / 0.07);
    // LED
    if (vLedKind > 0.5) {
      float s = vLedKind > 1.5 ? 0.062 : 0.05;
      float gain = vLedKind > 1.5 ? 1.2 : 1.0;
      vec2 aq = abs(q);
      float fw = fwidth(q.x) * 0.75;
      float sq = (1.0 - smoothstep(s - fw, s + fw, aq.x)) * (1.0 - smoothstep(s - fw, s + fw, aq.y));
      float r2 = dot(q, q);
      float glow = exp(-r2 / (s * s * 3.0)) * 0.18 + exp(-r2 / 0.02) * 0.03;
      emissive = uLed * vLedOn * gain * (sq * 6.0 + glow * 2.0);
    }
  } else if (N.z > -0.5) {
    // Side faces: darker the deeper they go into the seam.
    ao *= mix(0.3, 1.0, smoothstep(-0.25, vH, vWorld.z));
    // Self-shadow from the wall itself for faces turned away from the light.
  } else {
    ao = 0.0;
  }
  float diff = max(dot(N, L), 0.0);
  float fill = 0.14 * (0.55 + 0.45 * N.z);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 28.0) * uSpec;
  // Gentle large-scale falloff, brighter toward the upper left like a softbox.
  // Soft overhead light: brightest upper centre, darker lower third and corners.
  vec2 wp = vWorld.xy / (uGrid * vec2(0.36, 0.36));
  float area = (0.4 + 0.8 * smoothstep(-0.9, 0.7, wp.y)) * (1.0 - 0.25 * smoothstep(0.6, 1.2, abs(wp.x)));
  vec3 specCol = mix(vec3(1.0), uBlock / max(max(uBlock.r, uBlock.g), uBlock.b), 0.92);
  vec3 col = uBlock * (diff * shadow * uKey * area + fill) * ao + specCol * spec * shadow * ao * area;
  gl_FragColor = vec4(col + emissive, 1.0);
}
`;

const SEAM_FRAG = /* glsl */ `
uniform vec3 uSeam;
void main() { gl_FragColor = vec4(uSeam, 1.0); }
`;

const lin = (hex: string, gain = 1) =>
  // Hex strings are sRGB; THREE.Color stores linear.
  new THREE.Color(hex).multiplyScalar(gain);

export const createLedCubeWall = (P: LedCubeWallParams): LookInstance => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 16 / 9, 5, 200);
  // About 27 x 15 blocks in view, matching the reference block size.
  const D = 7.6 / Math.tan(THREE.MathUtils.degToRad(11));

  const n = COLS * ROWS_N;
  const state = new Float32Array(n * 4);
  const tex = new THREE.DataTexture(state, COLS, ROWS_N, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;

  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = box.index;
  g.setAttribute("position", box.getAttribute("position"));
  g.setAttribute("normal", box.getAttribute("normal"));
  const cells = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    cells[i * 2] = i % COLS;
    cells[i * 2 + 1] = Math.floor(i / COLS);
  }
  g.setAttribute("iCell", new THREE.InstancedBufferAttribute(cells, 2));
  g.setAttribute("iLed", new THREE.InstancedBufferAttribute(LED_KIND, 1));
  g.instanceCount = n;

  const camPos = new THREE.Vector3();
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      tState: { value: tex },
      uGrid: { value: new THREE.Vector2(COLS, ROWS_N) },
      uBlock: { value: lin(P.block) },
      uLed: { value: lin(P.led) },
      uLight: { value: new THREE.Vector3(-0.36, 0.42, 0.83) },
      uKey: { value: P.key },
      uSpec: { value: P.spec },
      uCamPos: { value: camPos },
    },
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const seam = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS + 4, ROWS_N + 4),
    new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: SEAM_FRAG,
      uniforms: { uSeam: { value: lin(P.seam) } },
    }),
  );
  seam.position.z = -0.55;
  scene.add(seam);

  return {
    scene,
    camera,
    post: {
      focus: D,
      cocScale: 60,
      maxCoc: 5,
      bloomStrength: 0.12,
      bloomThreshold: 1.5,
      exposure: 1.0,
      vignette: 0.5,
      grain: 0.015,
      acesMix: 0.0,
    },
    update: (frame, w, h) => {
      const f = frame % LOOP;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const a = (f / LOOP) * Math.PI * 2;
      const yaw = THREE.MathUtils.degToRad(8 + 2 * Math.sin(a));
      const pitch = THREE.MathUtils.degToRad(1.2 * Math.sin(a * 2 + 0.7));
      camera.position.set(
        D * Math.sin(yaw) * Math.cos(pitch),
        D * Math.sin(pitch),
        D * Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(0, 0, 0);
      camPos.copy(camera.position);
      const depth = GROUPS.map((gr) => groupDepth(gr, f));
      for (let i = 0; i < n; i++) {
        state[i * 4] = depth[CELL_GROUP[i]];
        state[i * 4 + 1] = LED_KIND[i] > 0 ? ledLevel(i, f) * LED_SCHED[i].level : 0;
      }
      tex.needsUpdate = true;
    },
    dispose: () => {
      g.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
};
