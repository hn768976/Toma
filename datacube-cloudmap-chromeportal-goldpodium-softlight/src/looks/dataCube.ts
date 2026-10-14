import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { lin, linColor } from "../lib/color";
import { PostPipeline } from "../lib/post";
import { hash01, mulberry32, Rng, TAU } from "../lib/random";
import { envDome, envFromScene, panel } from "../lib/three-helpers";
import type { Look } from "../lib/ThreeLook";

export interface DataCubeParams {
  core: string;
  accent: string;
  bg: string;
  glow: string;
}

const LOOP = 600;

/* ------------------------------------------------------------------ */
/* Layout — generated once, at module level, from fixed seeds.        */
/* ------------------------------------------------------------------ */

interface Block {
  u: number; // centre, face-local, [-1,1]
  v: number;
  su: number; // size
  sv: number;
  h: number; // height above face
  id: number; // light id (shared by the 4 rotated copies)
  lit: number; // 0 = dim block, else twinkle on-level
  base: number; // dim emissive level
  white: number; // 0..1 white mix
  hue: number; // 0 = deep blue, 1 = cyan (dim state)
}
interface Dot {
  u: number;
  v: number;
  h: number;
  id: number;
  level: number;
}

const SHELL = 1.0; // half edge
const sizes: [number, number, number][] = [
  [1, 1, 30],
  [2, 1, 14],
  [1, 2, 14],
  [2, 2, 12],
  [3, 1, 8],
  [1, 3, 8],
  [3, 2, 5],
  [2, 3, 5],
  [4, 1, 2],
  [1, 4, 2],
];
const sizeTotal = sizes.reduce((a, s) => a + s[2], 0);
const pickSize = (rng: Rng) => {
  let r = rng() * sizeTotal;
  for (const s of sizes) {
    if ((r -= s[2]) <= 0) return s;
  }
  return sizes[0];
};

/** Pack rectangles on an n×n grid covering [u0,u1]×[v0,v1]. */
const packGrid = (
  rng: Rng,
  n: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  fill: number,
  idBase: number,
  blocks: Block[],
  dots: Dot[],
) => {
  const occ = new Uint8Array(n * n);
  const cu = (u1 - u0) / n;
  const cv = (v1 - v0) / n;
  const cells: number[] = [];
  for (let i = 0; i < n * n; i++) cells.push(i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const target = Math.floor(n * n * fill);
  let used = 0;
  let id = idBase;
  for (const c of cells) {
    if (used >= target) break;
    if (occ[c]) continue;
    const cx = c % n;
    const cy = Math.floor(c / n);
    let [w, h] = pickSize(rng);
    if (cx + w > n || cy + h > n) [w, h] = [1, 1];
    let ok = true;
    for (let y = cy; y < cy + h && ok; y++) for (let x = cx; x < cx + w; x++) if (occ[y * n + x]) ok = false;
    if (!ok) continue;
    for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) occ[y * n + x] = 1;
    used += w * h;
    const gap = 0.16 * cu;
    const lvl = rng();
    const height = lvl < 0.5 ? 0.008 : lvl < 0.85 ? 0.018 : 0.03;
    const isLit = rng() < 0.22;
    blocks.push({
      u: u0 + (cx + w / 2) * cu,
      v: v0 + (cy + h / 2) * cv,
      su: w * cu - gap,
      sv: h * cv - gap,
      h: height,
      id: id++,
      lit: isLit ? 0.5 + 2.2 * rng() * rng() : 0,
      base: 0.015 + 0.16 * rng() * rng(),
      hue: rng() * rng(),
      white: 0.08 * rng(),
    });
    // tiny bright dots on some blocks
    if (rng() < 0.06) {
      dots.push({
        u: u0 + (cx + 0.5) * cu + (rng() - 0.5) * cu * 0.3,
        v: v0 + (cy + 0.5) * cv + (rng() - 0.5) * cv * 0.3,
        h: height + 0.002,
        id: id++,
        level: 2 + 5 * rng(),
      });
    }
  }
  // dots in empty cells (lights seen in the gaps)
  for (let i = 0; i < n * n; i++) {
    if (occ[i] || rng() > 0.06) continue;
    dots.push({
      u: u0 + ((i % n) + 0.5) * cu,
      v: v0 + (Math.floor(i / n) + 0.5) * cv,
      h: 0.004,
      id: id++,
      level: 1.5 + 4 * rng(),
    });
  }
};

const SIDE_BLOCKS: Block[] = [];
const SIDE_DOTS: Dot[] = [];
const TOP_BLOCKS: Block[] = [];
const TOP_DOTS: Dot[] = [];
{
  const rng = mulberry32(0xc0be);
  const m = 0.965;
  packGrid(rng, 30, -m, m, -m, m, 0.55, 0, SIDE_BLOCKS, SIDE_DOTS);
  // top / bottom: one quadrant, replicated with 90° rotations (4-fold symmetry)
  packGrid(rng, 15, 0.004, m, 0.004, m, 0.55, 100000, TOP_BLOCKS, TOP_DOTS);
}

/** Face transforms: +Z face rotated into place. */
const sideFace = (i: number) => new Matrix4().makeRotationY((i * Math.PI) / 2);
const topQuad = (q: number) => new Matrix4().makeRotationY((q * Math.PI) / 2).multiply(new Matrix4().makeRotationX(-Math.PI / 2));
const bottomQuad = (q: number) => new Matrix4().makeRotationY((q * Math.PI) / 2).multiply(new Matrix4().makeRotationX(Math.PI / 2));

interface Placed<T> {
  item: T;
  /** local angle offset about Y (multiple of 90°) */
  angle: number;
  m: Matrix4;
}
const placeAll = <T>(side: T[], top: T[]) => {
  const out: Placed<T>[] = [];
  for (let i = 0; i < 4; i++) {
    const f = sideFace(i);
    side.forEach((item) => out.push({ item, angle: i * 90, m: f }));
  }
  for (let q = 0; q < 4; q++) {
    const t = topQuad(q);
    const b = bottomQuad(q);
    top.forEach((item) => out.push({ item, angle: q * 90, m: t }));
    top.forEach((item) => out.push({ item, angle: q * 90, m: b }));
  }
  return out;
};
const PLACED_BLOCKS = placeAll(SIDE_BLOCKS, TOP_BLOCKS);
const PLACED_DOTS = placeAll(SIDE_DOTS, TOP_DOTS);

/**
 * Twinkle as a function of the face's world angle θ (degrees), not of the
 * face index: after the 90° turn each face sits where its neighbour was and
 * has exactly its neighbour's θ, so frame 600 equals frame 0. Hold segments
 * are 7.5° = 50 frames (divides 600).
 */
const SEG = 7.5;
const NSEG = 360 / SEG; // 48
const twinkle = (id: number, theta: number, duty: number) => {
  const phase = hash01(id * 7 + 3);
  const x = theta / SEG + phase;
  const seg = Math.floor(x);
  const fr = x - seg;
  const s0 = hash01(id * 131 + (((seg % NSEG) + NSEG) % NSEG)) < duty ? 1 : 0;
  const s1 = hash01(id * 131 + ((((seg + 1) % NSEG) + NSEG) % NSEG)) < duty ? 1 : 0;
  // hold, then a short smooth crossfade at the end of each segment
  const k = Math.min(1, Math.max(0, (fr - 0.82) / 0.18));
  const e = k * k * (3 - 2 * k);
  return s0 + (s1 - s0) * e;
};

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */

/** Circuit traces, drawn as one quadrant and rotated 4× (4-fold symmetric). */
const traceTexture = () => {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  const rng = mulberry32(0x7ace);
  const drawQuadrant = () => {
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineCap = "square";
    const step = S / 44;
    for (let t = 0; t < 70; t++) {
      let x = Math.floor(rng() * 22) * step + step / 2;
      let y = Math.floor(rng() * 22) * step + step / 2;
      ctx.lineWidth = rng() < 0.7 ? 2 : 4;
      ctx.globalAlpha = 0.35 + 0.65 * rng();
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 2 + Math.floor(rng() * 4);
      let horiz = rng() < 0.5;
      for (let s = 0; s < segs; s++) {
        const len = (1 + Math.floor(rng() * 6)) * step * (rng() < 0.5 ? -1 : 1);
        if (horiz) x = Math.min(S / 2 - step / 2, Math.max(step / 2, x + len));
        else y = Math.min(S / 2 - step / 2, Math.max(step / 2, y + len));
        ctx.lineTo(x, y);
        horiz = !horiz;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  };
  for (let q = 0; q < 4; q++) {
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate((q * Math.PI) / 2);
    ctx.translate(-S / 2, -S / 2);
    drawQuadrant();
    ctx.restore();
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearMipmapLinearFilter;
  return tex;
};

/* ------------------------------------------------------------------ */
/* Background: deep blue, radial glow, ~20 blurred cube outlines.      */
/* ------------------------------------------------------------------ */

const BG_FRAG = /* glsl */ `
uniform vec3 uBg;
uniform vec3 uGlow;
uniform vec2 uCenter;   // glow centre, NDC
uniform float uAspect;
uniform float uPhase;
uniform vec3 uOutline;
varying vec2 vNdc;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// isometric cube outline: hexagon + inner Y
float cubeOutline(vec2 p, float r) {
  float d = 1e9;
  vec2 v[6];
  for (int i = 0; i < 6; i++) {
    float a = 1.5707963 + float(i) * 1.0471976;
    v[i] = vec2(cos(a), sin(a)) * r;
  }
  for (int i = 0; i < 6; i++) d = min(d, segDist(p, v[i], v[(i + 1) % 6]));
  d = min(d, segDist(p, vec2(0.0), v[0] * 0.0 + vec2(0.0, -r) ));
  d = min(d, segDist(p, vec2(0.0), v[1]));
  d = min(d, segDist(p, vec2(0.0), v[5]));
  return d;
}
void main() {
  vec2 p = vNdc * vec2(uAspect, 1.0);
  vec2 c = uCenter * vec2(uAspect, 1.0);
  float r = length((p - c) * vec2(0.85, 1.0));
  vec3 col = uBg * 0.6 + uGlow * (0.6 * exp(-r * r / 0.28) + 0.12 * exp(-r * r / 1.2));
  // darker far corners
  col *= 1.0 - 0.35 * smoothstep(0.9, 2.2, length(p - c * 0.5));
  float o = 0.0;
  for (int i = 0; i < 20; i++) {
    float fi = float(i);
    vec2 pos = vec2(hash(fi + 1.0) * 2.0 - 1.0, hash(fi + 11.0) * 2.0 - 1.0) * vec2(uAspect * 0.98, 0.98);
    pos += 0.03 * vec2(sin(uPhase + fi * 1.7), cos(uPhase + fi * 2.3));
    float size = 0.035 + 0.06 * hash(fi + 21.0);
    float blur = 0.03 + 0.05 * hash(fi + 31.0);
    float d = cubeOutline(p - pos, size);
    float a = (0.25 + 0.75 * hash(fi + 41.0)) * exp(-d * d / (blur * blur));
    // fainter near the main cube, which they sit behind
    a *= smoothstep(0.25, 0.7, length(p - c));
    o += a;
  }
  col += uOutline * o;
  gl_FragColor = vec4(col, 1.0);
}`;

const bgMaterial = (bg: string, glow: string) =>
  new ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uBg: { value: new Color(...lin(bg)) },
      uGlow: { value: new Color(...lin(glow)) },
      uCenter: { value: [0.1, 0] },
      uAspect: { value: 16 / 9 },
      uPhase: { value: 0 },
      uOutline: { value: new Color(...lin("#1A5ACA")).multiplyScalar(0.035) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vNdc;
      void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: BG_FRAG,
  });

/* Additive inner-core haze, billboarded. */
const hazeMaterial = (color: string) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color(...lin(color)) }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
      void main() {
        vec2 q = vUv - vec2(0.0, -0.22);
        float r2 = dot(q, q);
        float a = exp(-r2 * 10.0) * 0.42 + exp(-r2 * 2.0) * 0.08;
        a *= 1.0 - smoothstep(0.55, 1.0, length(vUv));
        gl_FragColor = vec4(uColor * a * uAmt, 1.0);
      }`,
  });

/**
 * Per-instance emissive colour on a standard material, plus optional glowing
 * edges on box instances (edge width given in output pixels at 720p and
 * scaled with resolution, so 4K matches the preview).
 */
const withInstanceEmissive = <T extends MeshStandardMaterial>(m: T, edges = 0) => {
  const uPx = { value: 1 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPx = uPx;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aEmissive;\nvarying vec3 vEmissive;\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvEmissive = aEmissive;\nvLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vEmissive;\nvarying vec3 vLocal;\nuniform float uPx;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vEmissive;
        ${edges > 0 ? `{
          vec3 a = 0.5 - abs(vLocal);
          vec3 fw = fwidth(vLocal) * 1.4 * uPx;
          vec3 e = 1.0 - smoothstep(vec3(0.0), fw, a);
          // two smallest distances → on an edge when both near the boundary
          float edge = max(max(min(e.x, e.y), min(e.y, e.z)), min(e.x, e.z));
          totalEmissiveRadiance += edge * (vEmissive * 1.4 + vec3(0.03, 0.18, 0.45) * ${edges.toFixed(3)});
        }` : ""}`,
      );
  };
  return { material: m, uPx };
};

/* ------------------------------------------------------------------ */

export const createDataCube = (p: DataCubeParams) => (renderer: WebGLRenderer): Look => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(20, 16 / 9, 0.1, 100);
  const post = new PostPipeline({
    tonemap: "aces",
    exposure: 0.95,
    bloomStrength: 1.3,
    bloomThreshold: 0.35,
    bloomKnee: 0.4,
    bloomRadius: 1.05,
    vignette: 0.35,
    vignetteStart: 0.3,
    grain: 0.015,
    grainPeriod: LOOP,
    blueNoise: false,
  });

  // environment: dark blue dome with cyan / white softboxes
  const envScene = new Scene();
  envScene.add(
    envDome(
      `col = mix(vec3(0.004, 0.012, 0.05), vec3(0.02, 0.08, 0.3), smoothstep(-0.3, 0.8, d.y));`,
    ),
  );
  const cyan = linColor(p.accent);
  const sb1 = panel(14, 8, new Color(1, 1, 1), 3);
  sb1.position.set(-12, 16, 10);
  sb1.lookAt(0, 0, 0);
  const sb2 = panel(30, 4, cyan, 2.5);
  sb2.position.set(14, 4, -12);
  sb2.lookAt(0, 0, 0);
  const sb3 = panel(10, 10, cyan, 1.5);
  sb3.position.set(0, -20, 0);
  sb3.lookAt(0, 0, 0);
  envScene.add(sb1, sb2, sb3);
  const env = envFromScene(renderer, envScene);
  scene.environment = env;
  scene.environmentIntensity = 0.9;

  // background quad
  const bgMat = bgMaterial(p.bg, p.glow);
  const bg = new Mesh(new PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  const key = new DirectionalLight(new Color("#BFE6FF"), 1.4);
  key.position.set(-3, 6, 4);
  scene.add(key);

  const cube = new Group();
  scene.add(cube);

  // glass shell with circuit traces
  const traces = traceTexture();
  const glass = new MeshPhysicalMaterial({
    color: new Color("#5AA8FF"),
    metalness: 0,
    roughness: 0.15,
    transmission: 0.4,
    thickness: 0.6,
    ior: 1.45,
    transparent: false,
    emissive: new Color(...lin(p.accent)),
    emissiveMap: traces,
    emissiveIntensity: 1.1,
    envMapIntensity: 1.5,
    specularIntensity: 1,
  });
  const shell = new Mesh(new RoundedBoxGeometry(2 * SHELL, 2 * SHELL, 2 * SHELL, 6, 0.05), glass);
  cube.add(shell);

  // inner emissive core
  const coreMat = new MeshStandardMaterial({
    color: new Color(0, 0, 0),
    emissive: new Color(...lin(p.core)),
    emissiveIntensity: 2.6,
  });
  const core = new Mesh(new RoundedBoxGeometry(1.25, 1.25, 1.25, 3, 0.08), coreMat);
  cube.add(core);

  // inner layer of dim structure (depth seen through gaps)
  const { material: innerMat } = withInstanceEmissive(
    new MeshStandardMaterial({ color: new Color("#061A44"), metalness: 0.4, roughness: 0.35 }),
  );
  const innerCount = PLACED_BLOCKS.length;
  const inner = new InstancedMesh(new BoxGeometry(1, 1, 1), innerMat, innerCount);
  const innerEm = new Float32Array(innerCount * 3);
  inner.geometry.setAttribute("aEmissive", new InstancedBufferAttribute(innerEm, 3));

  // surface blocks
  const { material: blockMat, uPx } = withInstanceEmissive(
    new MeshStandardMaterial({
      color: new Color("#0A3A80"),
      metalness: 0.25,
      roughness: 0.14,
      envMapIntensity: 0.9,
    }),
    1,
  );
  const blocks = new InstancedMesh(new BoxGeometry(1, 1, 1), blockMat, PLACED_BLOCKS.length);
  const blockEm = new Float32Array(PLACED_BLOCKS.length * 3);
  blocks.geometry.setAttribute("aEmissive", new InstancedBufferAttribute(blockEm, 3));
  const tmp = new Matrix4();
  const tScale = new Matrix4();
  const tTrans = new Matrix4();
  PLACED_BLOCKS.forEach((pb, i) => {
    const b = pb.item;
    tTrans.makeTranslation(b.u, b.v, SHELL + b.h / 2);
    tScale.makeScale(b.su, b.sv, b.h);
    tmp.copy(pb.m).multiply(tTrans).multiply(tScale);
    blocks.setMatrixAt(i, tmp);
    // inner copy: shrunken cube, flatter
    tTrans.makeTranslation(b.u * 0.78, b.v * 0.78, 0.78 + 0.01);
    tScale.makeScale(b.su * 0.85, b.sv * 0.85, 0.02);
    tmp.copy(pb.m).multiply(tTrans).multiply(tScale);
    inner.setMatrixAt(i, tmp);
  });
  blocks.instanceMatrix.needsUpdate = true;
  inner.instanceMatrix.needsUpdate = true;
  cube.add(blocks, inner);

  // tiny lights
  const { material: dotMat } = withInstanceEmissive(new MeshStandardMaterial({ color: new Color(0, 0, 0), roughness: 1 }));
  const dots = new InstancedMesh(new BoxGeometry(1, 1, 1), dotMat, PLACED_DOTS.length);
  const dotEm = new Float32Array(PLACED_DOTS.length * 3);
  dots.geometry.setAttribute("aEmissive", new InstancedBufferAttribute(dotEm, 3));
  PLACED_DOTS.forEach((pd, i) => {
    const d = pd.item;
    tTrans.makeTranslation(d.u, d.v, SHELL + d.h + 0.004);
    tScale.makeScale(0.03, 0.03, 0.006);
    tmp.copy(pd.m).multiply(tTrans).multiply(tScale);
    dots.setMatrixAt(i, tmp);
  });
  dots.instanceMatrix.needsUpdate = true;
  cube.add(dots);

  // inner haze (drawn last, additive)
  const haze = new Mesh(new PlaneGeometry(3.4, 3.4), hazeMaterial(p.core));
  haze.renderOrder = 10;
  scene.add(haze);

  const cyanL = lin(p.accent);
  const blueL = lin("#1450E0");
  const white: [number, number, number] = [1, 1, 1];
  const mixc = (a: number[], b: number[], t: number, s: number, out: Float32Array, o: number) => {
    out[o] = (a[0] + (b[0] - a[0]) * t) * s;
    out[o + 1] = (a[1] + (b[1] - a[1]) * t) * s;
    out[o + 2] = (a[2] + (b[2] - a[2]) * t) * s;
  };

  // camera: fixed isometric-ish view; cube placed at x ≈ 55%
  const az = Math.PI / 4;
  const el = (33 * Math.PI) / 180; // isometric-style
  const dist = 12.8;
  const camDir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const right = new Vector3(Math.cos(az), 0, -Math.sin(az));
  void right;
  const target = new Vector3(0, 0, 0);
  camera.position.copy(target).addScaledVector(camDir, dist);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const centreNdc = new Vector3();

  const update = (frame: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const t = f / LOOP;
    const rotDeg = 90 * t; // exactly 90° per loop
    cube.rotation.y = (rotDeg * Math.PI) / 180;
    cube.position.y = 0.05 * Math.sin(TAU * t) + 0.015 * Math.sin(TAU * 2 * t + 1.0);
    cube.updateMatrixWorld();

    PLACED_BLOCKS.forEach((pb, i) => {
      const b = pb.item;
      const theta = pb.angle + rotDeg;
      // dim state: deep blue → cyan; lit state: cyan → white
      mixc(blueL, cyanL, b.hue, b.base, blockEm, i * 3);
      if (b.lit > 0) {
        const k = b.lit * twinkle(b.id, theta, 0.55);
        blockEm[i * 3] += (cyanL[0] + (1 - cyanL[0]) * b.white) * k;
        blockEm[i * 3 + 1] += (cyanL[1] + (1 - cyanL[1]) * b.white) * k;
        blockEm[i * 3 + 2] += (cyanL[2] + (1 - cyanL[2]) * b.white) * k;
      }
      // inner layer: dim, slow
      const si = 0.12 + 0.9 * twinkle(b.id + 50000, theta, 0.35);
      mixc(cyanL, white, 0.1, si, innerEm, i * 3);
    });
    (blocks.geometry.getAttribute("aEmissive") as InstancedBufferAttribute).needsUpdate = true;
    (inner.geometry.getAttribute("aEmissive") as InstancedBufferAttribute).needsUpdate = true;
    PLACED_DOTS.forEach((pd, i) => {
      const d = pd.item;
      const s = d.level * (0.15 + 0.85 * twinkle(d.id, pd.angle + rotDeg, 0.5));
      mixc(cyanL, white, 0.15, s * 0.6, dotEm, i * 3);
    });
    (dots.geometry.getAttribute("aEmissive") as InstancedBufferAttribute).needsUpdate = true;

    haze.position.copy(cube.position);
    haze.quaternion.copy(camera.quaternion);

    centreNdc.copy(cube.position).project(camera);
    bgMat.uniforms.uCenter.value = [centreNdc.x, centreNdc.y - 0.16];
    bgMat.uniforms.uPhase.value = TAU * t;
  };

  return {
    render(gl, frame, w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // shift the image so the cube sits at x ≈ 55% (lens shift, no perspective skew)
      camera.projectionMatrix.elements[8] = -0.1;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      uPx.value = h / 720;
      bgMat.uniforms.uAspect.value = w / h;
      update(frame);
      post.renderScene(gl, scene, camera, w, h);
      post.finish(gl, frame);
    },
    dispose() {
      post.dispose();
      env.dispose();
      traces.dispose();
    },
  };
};
