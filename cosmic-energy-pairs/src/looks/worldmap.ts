import * as THREE from "three";
import { MapColours } from "../colourways";
import { bg, lin } from "../lib/color";
import { FullScreenQuad, PostPipeline, PostSettings, rawMat } from "../lib/pipeline";
import { GRID_COLS, GRID_ROWS, LandCell } from "../lib/landGrid";
import { gauss, mulberry32 } from "../lib/random";
import { FrameInfo, Look } from "../lib/Stage";

/**
 * LOOK 3 — Particles to World Map (15 s, 450 frames, not a loop).
 *
 *   0–120   starfield drifting, camera pushing gently forward
 *  90–210   particles brighten & speed up, glowing cubes fly past the camera
 * 180–300   particles swirl & converge into the map grid (staggered by distance)
 * 280–360   map locks in, a flash sweeps across, network lines draw
 * 360–450   hold, nodes pulse, camera drifts
 *
 * Every position is a closed-form function of (seed, frame). The only
 * "accumulated" quantity — distance travelled by the starfield — is a table
 * precomputed at module load from the speed curve, i.e. still a pure function
 * of the frame number.
 */

export const MAP_FRAMES_TOTAL = 450;
export const MAP_POST: PostSettings = {
  bloomStrength: 1.0,
  bloomRadius: 0.8,
  bloomThreshold: 0.2,
  exposure: 1.0,
  grain: 0.02,
  pureBlack: false,
};

const MAP_W = 16;
const CELL = MAP_W / GRID_COLS;
const MAP_H = GRID_ROWS * CELL;
const STARS = 28_000;
const CUBES = 280;
const NODES = 40;
const LINK_SEGS = 28;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---- Pure timeline functions ----------------------------------------------

const speedAt = (f: number) => 0.035 + 0.42 * smooth(90, 150, f) * (1 - smooth(205, 265, f));
const S_TABLE = (() => {
  const t = new Float64Array(MAP_FRAMES_TOTAL + 2);
  for (let f = 1; f < t.length; f++) t[f] = t[f - 1] + speedAt(f - 1);
  return t;
})();
const distanceAt = (f: number) => S_TABLE[Math.max(0, Math.min(S_TABLE.length - 1, Math.round(f)))];
const starBrightness = (f: number) =>
  (0.6 + 0.9 * smooth(90, 160, f)) * (1 - 0.6 * smooth(215, 300, f));

/** Camera for frame f — also used by the HTML label overlay. */
export const cameraAt = (f: number) => {
  const push = easeInOutCubic(clamp01(f / 300));
  const z = 21 - 8.2 * push - 0.35 * clamp01((f - 300) / 150);
  const drift = smooth(330, 450, f);
  const pos = new THREE.Vector3(0.45 * drift, -0.05 + 0.18 * drift, z);
  const target = new THREE.Vector3(0.12 * drift, 0.02, 0);
  return { pos, target };
};

export const makeCamera = (f: number, aspect = 16 / 9) => {
  const cam = new THREE.PerspectiveCamera(45, aspect, 0.1, 400);
  const { pos, target } = cameraAt(f);
  cam.position.copy(pos);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

// ---- Shaders ----------------------------------------------------------------

const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBg;
uniform vec3 uTop;
uniform float uAspect;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 d = vec2((vUv.x - 0.5) * uAspect, 1.0 - vUv.y);
  float light = exp(-d.x * d.x * 2.6 - d.y * d.y * 3.2);
  float core = exp(-d.x * d.x * 14.0 - d.y * d.y * 9.0);
  vec3 c = uBg + uTop * (light * 0.32 + core * 0.22);
  outColor = vec4(c, 1.0);
}
`;

const STAR_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uS;
uniform float uBright;
uniform float uPx;
uniform float uCamZ;
in vec3 position;
in vec4 aData; // x: speed mult, y: size, z: brightness, w: hue mix
out vec3 vCol;
uniform vec3 uCol;
const float ZMIN = -72.0;
const float ZLEN = 88.0;
void main() {
  vec3 p = position;
  p.z = ZMIN + mod(p.z - ZMIN + uS * aData.x, ZLEN);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.1);
  gl_PointSize = max(aData.y * uPx * 22.0 / depth, 1.0 * uPx);
  float fade = smoothstep(ZMIN, ZMIN + 18.0, p.z) * (1.0 - smoothstep(uCamZ - 4.0, uCamZ - 0.6, p.z));
  float small = min(1.0, (aData.y * 22.0 / depth) / 1.0);
  vCol = uCol * aData.z * uBright * fade * small;
}
`;

const DOT_FRAG = /* glsl */ `
precision highp float;
in vec3 vCol;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  outColor = vec4(vCol * exp(-r2 * 3.5), 1.0);
}
`;

const SQUARE_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uFrame;
uniform float uS;
uniform float uBright;
uniform float uPx;
uniform vec2 uRes;
in vec3 position;      // quad corner (-0.5..0.5)
in vec3 aStart;
in vec3 aTarget;
in vec4 aTiming;       // x: delay, y: duration, z: swirl (rad), w: brightness
in vec2 aMisc;         // x: drift speed, y: flash delay
out vec2 vCorner;
out float vRound;
out vec3 vCol;
uniform vec3 uSquare;
uniform vec3 uParticle;

float easeIO(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }

void main() {
  float e = easeIO(clamp((uFrame - aTiming.x) / aTiming.y, 0.0, 1.0));
  vec3 start = aStart + vec3(0.0, 0.0, uS * aMisc.x * 0.12);
  vec3 p = mix(start, aTarget, e);
  // Swirl around the map centre while flying in.
  float ang = aTiming.z * (1.0 - e) * (1.0 - e);
  float c = cos(ang), s = sin(ang);
  p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p.z += sin(3.14159265 * e) * 1.6;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = max(-mv.z, 0.1);
  // World-space size; never smaller than ~1.3 px so far dots don't vanish.
  float worldSize = mix(0.05, 0.068, e);
  float pxSize = worldSize * 2.0 * uRes.y / (depth * 0.8284); // full height / (2·tan 22.5°)
  float minPx = 1.3 * uPx;
  float scale = max(1.0, minPx / max(pxSize, 1e-4));
  mv.xy += position.xy * worldSize * scale;
  gl_Position = projectionMatrix * mv;

  vCorner = position.xy * 2.0;
  vRound = mix(1.0, 0.38, smoothstep(0.75, 1.0, e));
  float flash = exp(-pow((uFrame - aMisc.y) / 6.0, 2.0)) * 2.4;
  float settled = smoothstep(0.85, 1.0, e);
  float bright = mix(uBright * 0.9, aTiming.w + flash, settled) / (scale * scale);
  vCol = mix(uParticle, uSquare, settled) * bright;
}
`;

const SQUARE_FRAG = /* glsl */ `
precision highp float;
in vec2 vCorner;
in float vRound;
in vec3 vCol;
out vec4 outColor;
void main() {
  // Rounded-square SDF; vRound = corner radius (1 = circle).
  vec2 q = abs(vCorner) - (1.0 - vRound);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - vRound;
  float aa = fwidth(d) * 1.2 + 1e-4;
  float a = 1.0 - smoothstep(-0.18 - aa, -0.18 + aa, d);
  float glow = exp(-max(d + 0.18, 0.0) * 6.0) * 0.25;
  outColor = vec4(vCol * (a * 0.95 + glow), 1.0);
}
`;

const CUBE_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uFrame;
uniform float uCamZ;
in vec3 position;
in vec4 aCube;   // xyz: start position, w: launch frame
in vec4 aCube2;  // x: speed, y: size, z: spin speed, w: brightness
in vec3 aAxis;
out vec3 vLocal;
out float vFade;
vec3 rotAxis(vec3 p, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return p * c + cross(k, p) * s + k * dot(k, p) * (1.0 - c);
}
void main() {
  float age = uFrame - aCube.w;
  vec3 c = aCube.xyz + vec3(0.0, 0.0, aCube2.x * max(age, 0.0));
  vec3 p = rotAxis(position, aAxis, aCube2.z * age) * aCube2.y + c;
  vLocal = position;
  vFade = step(0.0, age) * smoothstep(0.0, 14.0, age) * (1.0 - smoothstep(uCamZ - 3.0, uCamZ - 0.3, c.z)) * aCube2.w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  if (vFade <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const CUBE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCube;
in vec3 vLocal;
in float vFade;
out vec4 outColor;
void main() {
  vec3 a = abs(vLocal) * 2.0; // 0 centre → 1 face
  // Second-largest coordinate → distance to nearest edge.
  float mx = max(a.x, max(a.y, a.z));
  float mn = min(a.x, min(a.y, a.z));
  float mid = a.x + a.y + a.z - mx - mn;
  float edge = smoothstep(0.72, 0.98, mid);
  vec3 col = uCube * (0.55 + 2.6 * edge);
  outColor = vec4(col * vFade, 1.0);
}
`;

const LINK_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uRes;
uniform float uPx;
uniform float uFrame;
in vec3 position;   // A
in vec3 aB;         // B
in vec4 aLink;      // x: u, y: side, z: start frame, w: lift
out float vU;
out float vSide;
out float vProg;
vec3 arc(float u) {
  vec3 p = mix(position, aB, u);
  p.z += sin(3.14159265 * u) * aLink.w;
  return p;
}
void main() {
  float u = aLink.x;
  vec3 p = arc(u);
  vec3 n = arc(u + 0.01);
  vec4 c0 = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(n, 1.0);
  vec2 s0 = c0.xy / c0.w * uRes;
  vec2 s1 = c1.xy / c1.w * uRes;
  vec2 dir = normalize(s1 - s0 + vec2(1e-6, 0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  c0.xy += nrm * aLink.y * 1.4 * uPx / uRes * c0.w;
  gl_Position = c0;
  vU = u;
  vSide = aLink.y;
  vProg = clamp((uFrame - aLink.z) / 32.0, 0.0, 1.0);
}
`;

const LINK_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uLink;
in float vU;
in float vSide;
in float vProg;
out vec4 outColor;
void main() {
  float prog = 1.0 - pow(1.0 - vProg, 2.0);
  if (vU > prog) discard;
  float across = 1.0 - vSide * vSide;
  float head = exp(-pow((prog - vU) * 18.0, 2.0)) * (1.0 - vProg) * 3.0;
  outColor = vec4(uLink * across * (0.55 + head), 1.0);
}
`;

const NODE_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uFrame;
uniform float uPx;
in vec3 position;
in vec3 aNode; // x: appear frame, y: pulse phase, z: size
out float vI;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float on = smoothstep(aNode.x, aNode.x + 12.0, uFrame);
  float pulse = 1.0 + 0.45 * sin(6.28318530718 * (uFrame / 42.0 + aNode.y));
  gl_PointSize = aNode.z * uPx * (0.6 + 0.4 * on) * (0.85 + 0.25 * pulse);
  vI = on * pulse;
}
`;

const NODE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uNode;
in float vI;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float c = exp(-r2 * 22.0) * 7.0 + exp(-r2 * 4.0) * 0.9;
  outColor = vec4(uNode * c * vI, 1.0);
}
`;

// ---- Builders (seeded, deterministic) ----------------------------------------

export const mapPos = (cell: LandCell) =>
  new THREE.Vector3(-MAP_W / 2 + (cell.col + 0.5) * CELL, MAP_H / 2 - (cell.row + 0.5) * CELL - 0.15, 0);

export type NetworkNode = { pos: THREE.Vector3; appear: number; phase: number; size: number };

export const buildNetwork = (cells: LandCell[]) => {
  const rng = mulberry32(0x7e70);
  const nodes: NetworkNode[] = [];
  for (let i = 0; i < NODES; i++) {
    let pos: THREE.Vector3;
    if (i < 33) {
      pos = mapPos(cells[Math.floor(rng() * cells.length)]).add(new THREE.Vector3(0, 0, 0.05));
    } else {
      // A few floating nodes over the oceans/margins, slightly in front.
      pos = new THREE.Vector3((rng() * 2 - 1) * 8.4, (rng() * 2 - 1) * 3.6, 0.3 + rng() * 0.9);
    }
    nodes.push({ pos, appear: 288 + rng() * 40, phase: rng(), size: 14 + rng() * 14 });
  }
  const links: [number, number, number][] = [];
  const seen = new Set<string>();
  nodes.forEach((n, i) => {
    const order = nodes
      .map((m, j) => ({ j, d: m.pos.distanceTo(n.pos) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d);
    const k = 2 + (rng() < 0.3 ? 1 : 0);
    for (let q = 0; q < k; q++) {
      const j = q < 2 ? order[q].j : order[3 + Math.floor(rng() * 6)].j;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key) || nodes[j].pos.distanceTo(n.pos) > 6.5) continue;
      seen.add(key);
      links.push([i, j, Math.max(n.appear, nodes[j].appear) + 4 + rng() * 10]);
    }
  });
  return { nodes, links };
};

export const LABELS = ["20.12", "35.81", "47.06", "12.94", "63.40", "08.77", "51.29"];

export class WorldMapLook implements Look {
  scene = new THREE.Scene();
  camera = makeCamera(0);
  bgQuad = new FullScreenQuad();
  bgMat: THREE.RawShaderMaterial;
  u: Record<string, THREE.IUniform>;

  constructor(c: MapColours, cells: LandCell[]) {
    this.u = {
      uFrame: { value: 0 },
      uS: { value: 0 },
      uBright: { value: 1 },
      uPx: { value: 1 },
      uCamZ: { value: 20 },
      uRes: { value: new THREE.Vector2(1, 1) },
    };
    this.bgMat = rawMat(BG_FRAG, { uBg: { value: bg(c.bg) }, uTop: { value: lin(c.bgTop) }, uAspect: { value: 16 / 9 } });
    const add = { blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true };

    // Starfield.
    const rng = mulberry32(0x5ca7);
    const sp = new Float32Array(STARS * 3);
    const sd = new Float32Array(STARS * 4);
    for (let i = 0; i < STARS; i++) {
      sp.set([(rng() * 2 - 1) * 34, (rng() * 2 - 1) * 20, -72 + rng() * 88], i * 3);
      const big = rng() < 0.03;
      sd.set([0.6 + rng() * 0.8, (big ? 0.11 : 0.05) * (0.6 + rng() * 0.8), (big ? 1.8 : 0.7) * (0.4 + rng() * 0.8), rng()], i * 4);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    starGeo.setAttribute("aData", new THREE.BufferAttribute(sd, 4));
    const stars = new THREE.Points(starGeo, rawMat(DOT_FRAG, { ...this.u, uCol: { value: lin(c.particle) } }, add, STAR_VERT));
    stars.frustumCulled = false;

    // Map squares (instanced quads).
    const mrng = mulberry32(0x3a9d);
    const n = cells.length;
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const aStart = new Float32Array(n * 3);
    const aTarget = new Float32Array(n * 3);
    const aTiming = new Float32Array(n * 4);
    const aMisc = new Float32Array(n * 2);
    const maxR = Math.hypot(MAP_W / 2, MAP_H / 2);
    cells.forEach((cell, i) => {
      const t = mapPos(cell);
      aTarget.set([t.x, t.y, t.z], i * 3);
      const st = new THREE.Vector3((mrng() * 2 - 1) * 15, (mrng() * 2 - 1) * 8.5, -40 + mrng() * 36);
      aStart.set([st.x, st.y, st.z], i * 3);
      const distN = Math.hypot(t.x, t.y) / maxR;
      const delay = 180 + 46 * distN + mrng() * 16;
      const dur = 58 + mrng() * 22;
      const swirl = (1.6 + mrng() * 0.9) * (1 + 0.4 * gauss(mrng) * 0.2);
      aTiming.set([delay, dur, swirl, 0.5 + mrng() * 0.35 + (mrng() < 0.05 ? 0.6 : 0)], i * 4);
      const flashAt = 292 + ((t.x + MAP_W / 2) / MAP_W) * 34;
      aMisc.set([0.6 + mrng() * 0.8, flashAt], i * 2);
    });
    quad.setAttribute("aStart", new THREE.InstancedBufferAttribute(aStart, 3));
    quad.setAttribute("aTarget", new THREE.InstancedBufferAttribute(aTarget, 3));
    quad.setAttribute("aTiming", new THREE.InstancedBufferAttribute(aTiming, 4));
    quad.setAttribute("aMisc", new THREE.InstancedBufferAttribute(aMisc, 2));
    quad.instanceCount = n;
    const squares = new THREE.Mesh(
      quad,
      rawMat(SQUARE_FRAG, { ...this.u, uSquare: { value: lin(c.square) }, uParticle: { value: lin(c.particle) } }, add, SQUARE_VERT),
    );
    squares.frustumCulled = false;

    // Cubes.
    const crng = mulberry32(0xc0be);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cubeGeo = new THREE.InstancedBufferGeometry();
    cubeGeo.setAttribute("position", box.getAttribute("position"));
    cubeGeo.setIndex(box.getIndex());
    const aCube = new Float32Array(CUBES * 4);
    const aCube2 = new Float32Array(CUBES * 4);
    const aAxis = new Float32Array(CUBES * 3);
    for (let i = 0; i < CUBES; i++) {
      const launch = 88 + crng() * 130;
      const ang = crng() * Math.PI * 2;
      const rad = 0.7 + Math.pow(crng(), 0.7) * 9;
      const z0 = -75 + crng() * 30;
      const camZ = cameraAt(launch + 60).pos.z;
      const frames = 45 + crng() * 55;
      aCube.set([Math.cos(ang) * rad * 1.6, Math.sin(ang) * rad, z0, launch], i * 4);
      aCube2.set([(camZ + 2 - z0) / frames, 0.08 + crng() * 0.16, (crng() * 2 - 1) * 0.08, 0.7 + crng() * 0.9], i * 4);
      const ax = new THREE.Vector3(gauss(crng), gauss(crng), gauss(crng)).normalize();
      aAxis.set([ax.x, ax.y, ax.z], i * 3);
    }
    cubeGeo.setAttribute("aCube", new THREE.InstancedBufferAttribute(aCube, 4));
    cubeGeo.setAttribute("aCube2", new THREE.InstancedBufferAttribute(aCube2, 4));
    cubeGeo.setAttribute("aAxis", new THREE.InstancedBufferAttribute(aAxis, 3));
    cubeGeo.instanceCount = CUBES;
    const cubes = new THREE.Mesh(cubeGeo, rawMat(CUBE_FRAG, { ...this.u, uCube: { value: lin(c.cube) } }, add, CUBE_VERT));
    cubes.frustumCulled = false;

    // Network.
    const { nodes, links } = buildNetwork(cells);
    const lv = links.length * (LINK_SEGS + 1) * 2;
    const la = new Float32Array(lv * 3);
    const lb = new Float32Array(lv * 3);
    const ll = new Float32Array(lv * 4);
    const lidx: number[] = [];
    let v = 0;
    links.forEach(([i, j, start]) => {
      const A = nodes[i].pos;
      const B = nodes[j].pos;
      const lift = 0.25 + A.distanceTo(B) * 0.22;
      const first = v;
      for (let s = 0; s <= LINK_SEGS; s++) {
        for (const side of [-1, 1]) {
          la.set([A.x, A.y, A.z], v * 3);
          lb.set([B.x, B.y, B.z], v * 3);
          ll.set([s / LINK_SEGS, side, start, lift], v * 4);
          v++;
        }
      }
      for (let s = 0; s < LINK_SEGS; s++) {
        const a = first + s * 2;
        lidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute("position", new THREE.BufferAttribute(la, 3));
    linkGeo.setAttribute("aB", new THREE.BufferAttribute(lb, 3));
    linkGeo.setAttribute("aLink", new THREE.BufferAttribute(ll, 4));
    linkGeo.setIndex(lidx);
    const linkMesh = new THREE.Mesh(
      linkGeo,
      rawMat(LINK_FRAG, { ...this.u, uLink: { value: lin(c.link).multiplyScalar(1.4) } }, { ...add, side: THREE.DoubleSide }, LINK_VERT),
    );
    linkMesh.frustumCulled = false;

    const np = new Float32Array(nodes.length * 3);
    const nd = new Float32Array(nodes.length * 3);
    nodes.forEach((nn, i) => {
      np.set([nn.pos.x, nn.pos.y, nn.pos.z], i * 3);
      nd.set([nn.appear, nn.phase, nn.size], i * 3);
    });
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(np, 3));
    nodeGeo.setAttribute("aNode", new THREE.BufferAttribute(nd, 3));
    const nodePts = new THREE.Points(nodeGeo, rawMat(NODE_FRAG, { ...this.u, uNode: { value: lin(c.link) } }, add, NODE_VERT));
    nodePts.frustumCulled = false;

    stars.renderOrder = 0;
    squares.renderOrder = 1;
    linkMesh.renderOrder = 2;
    nodePts.renderOrder = 3;
    cubes.renderOrder = 4;
    this.scene.add(stars, squares, linkMesh, nodePts, cubes);
  }

  render(gl: THREE.WebGLRenderer, _pipe: PostPipeline, f: FrameInfo) {
    const { pos, target } = cameraAt(f.frame);
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.camera.aspect = f.width / f.height;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.u.uFrame.value = f.frame;
    this.u.uS.value = distanceAt(f.frame);
    this.u.uBright.value = starBrightness(f.frame);
    this.u.uPx.value = f.px;
    this.u.uCamZ.value = pos.z;
    this.u.uRes.value.set(f.width / 2, f.height / 2);
    this.bgMat.uniforms.uAspect.value = f.width / f.height;
    this.bgQuad.render(gl, this.bgMat);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.bgQuad.dispose();
    this.bgMat.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) (o.material as THREE.Material).dispose();
    });
  }
}
