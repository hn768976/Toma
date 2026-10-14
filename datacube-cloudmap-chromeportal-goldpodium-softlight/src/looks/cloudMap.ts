import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Shape,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { lin, linColor } from "../lib/color";
import { PostPipeline } from "../lib/post";
import { easeInOutCubic, easeOutCubic, smooth } from "../lib/random";
import { envDome, envFromScene, panel } from "../lib/three-helpers";
import type { Look } from "../lib/ThreeLook";

export interface CloudMapParams {
  land: string;
  accent: string;
  floor: string;
  grid: string;
}

export interface LandGeoJSON {
  features: { geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] } }[];
}

const FPS = 30;
const DURATION = 300;

/* Equirectangular: 0.1 world unit per degree; north = −z. */
const S = 0.1;
const toXZ = (lon: number, lat: number) => new Vector2(lon * S, -lat * S);
const LAND_H = 0.03;
const LINE_Y = LAND_H + 0.012;

const CLOUD_SCALE = 0.7;
const CLOUD_LON = 12;
const CLOUD_LAT = 47;
const cloudBase = toXZ(CLOUD_LON, CLOUD_LAT);

/** Ten servers, spread across the continents (lon, lat). */
const SERVERS: [number, number][] = [
  [-102, 44], // North America
  [-62, -10], // South America
  [-38, 64], // Greenland coast → (stays on land at 1:110m)
  [3, 12], // West Africa
  [27, -26], // Southern Africa
  [44, 24], // Arabia
  [78, 22], // India
  [104, 34], // China
  [60, 56], // Russia
  [134, -25], // Australia
];

/* Right-angled routes. Each route: list of (lon,lat) corners. */
const route = (from: [number, number], via: "xz" | "zx", endOffset: number, lane = 0.45): Vector2[] => {
  const a = toXZ(from[0], from[1]);
  const b = new Vector2(cloudBase.x + endOffset, cloudBase.y + 0.9);
  const pts = [a];
  if (via === "xz") {
    // go along x first to a lane, then z, then into the base
    pts.push(new Vector2(a.x, b.y + (a.y - b.y) * lane));
    pts.push(new Vector2(b.x, b.y + (a.y - b.y) * lane));
  } else {
    pts.push(new Vector2(b.x + (a.x - b.x) * lane, a.y));
    pts.push(new Vector2(b.x + (a.x - b.x) * lane, b.y));
  }
  pts.push(b);
  return pts;
};

interface PathDef {
  pts: Vector2[];
  t0: number; // draw-on start (s)
  dur: number; // draw-on duration (s)
}

const PATHS: PathDef[] = [
  { pts: route(SERVERS[0], "zx", -0.24, 0.5), t0: 2.0, dur: 1.6 },
  { pts: route(SERVERS[1], "xz", -0.16, 0.42), t0: 2.2, dur: 1.7 },
  { pts: route(SERVERS[2], "zx", -0.08, 0.58), t0: 2.1, dur: 1.2 },
  { pts: route(SERVERS[3], "xz", 0.0, 0.36), t0: 2.3, dur: 1.4 },
  { pts: route(SERVERS[4], "xz", 0.08, 0.47), t0: 2.5, dur: 1.6 },
  { pts: route(SERVERS[5], "xz", 0.16, 0.62), t0: 2.4, dur: 1.3 },
  { pts: route(SERVERS[6], "zx", 0.24, 0.4), t0: 2.6, dur: 1.6 },
  { pts: route(SERVERS[7], "zx", 0.32, 0.54), t0: 2.8, dur: 1.6 },
  { pts: route(SERVERS[8], "zx", -0.32, 0.66), t0: 2.7, dur: 1.3 },
  { pts: route(SERVERS[9], "zx", 0.4, 0.33), t0: 2.9, dur: 1.6 },
  // a fan of parallel lanes from the hub running east (as the reference)
  ...[0, 2, 4].map((k) => ({
    pts: [
      new Vector2(cloudBase.x + 0.12 + k * 0.05, cloudBase.y + 0.9),
      new Vector2(cloudBase.x + 0.12 + k * 0.05, cloudBase.y + 1.6 + k * 0.32),
      new Vector2(cloudBase.x + 6 + k * 1.1, cloudBase.y + 1.6 + k * 0.32),
      new Vector2(cloudBase.x + 6 + k * 1.1, cloudBase.y + 1.6 + k * 0.32 + (k % 2 ? 1.4 : -1.2)),
    ],
    t0: 2.3 + k * 0.18,
    dur: 1.8,
  })),
  // a few server-to-server links
  { pts: [toXZ(-102, 44), toXZ(-102, 20), toXZ(-62, 20), toXZ(-62, -10)], t0: 2.4, dur: 1.4 },
  { pts: [toXZ(78, 22), toXZ(78, 34), toXZ(104, 34)], t0: 3.0, dur: 1.2 },
  { pts: [toXZ(27, -26), toXZ(44, -26), toXZ(44, 24)], t0: 3.2, dur: 1.3 },
  { pts: [toXZ(104, 34), toXZ(120, 34), toXZ(120, -25), toXZ(134, -25)], t0: 3.3, dur: 1.2 },
];

/* ------------------------------------------------------------------ */

const buildLand = (geo: LandGeoJSON) => {
  const shapes: Shape[] = [];
  const addPoly = (rings: number[][][]) => {
    const outer = rings[0];
    if (outer.every(([, lat]) => lat < -57)) return; // drop Antarctica
    const sh = new Shape(outer.map(([lon, lat]) => new Vector2(lon * S, lat * S)));
    rings.slice(1).forEach((h) => sh.holes.push(new Path(h.map(([lon, lat]) => new Vector2(lon * S, lat * S)))));
    shapes.push(sh);
  };
  geo.features.forEach((f) => {
    if (f.geometry.type === "Polygon") addPoly(f.geometry.coordinates as number[][][]);
    else (f.geometry.coordinates as number[][][][]).forEach(addPoly);
  });
  const g = new ExtrudeGeometry(shapes, {
    depth: LAND_H,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 1,
    curveSegments: 1,
  });
  g.rotateX(-Math.PI / 2); // lat → −z, extrusion → +y
  g.translate(0, 0.0, 0);
  return g;
};

const FLOOR_FRAG = /* glsl */ `
uniform vec3 uFloor;
uniform vec3 uGrid;
uniform vec3 uDot;
uniform float uTime;
uniform float uPx;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gridLine(float x, float w) {
  float d = abs(fract(x + 0.5) - 0.5);
  float fw = max(fwidth(x), 1e-5);
  // coverage-aware line: constant world width, fades when sub-pixel
  float c = 1.0 - smoothstep(w - fw * 0.75, w + fw * 0.75, d);
  return c * min(1.0, w / fw * 1.5);
}
void main() {
  vec2 p = vWorld.xz;
  float g = max(gridLine(p.x / 0.5, 0.025), gridLine(p.y / 0.5, 0.025));
  vec3 col = uFloor + uGrid * g * 0.30;
  // scattered small squares
  vec2 cell = floor(p / 0.5);
  float h = hash(cell);
  if (h < 0.11) {
    vec2 f = fract(p / 0.5) - 0.5;
    float sz = 0.13 + 0.05 * hash(cell + 7.0);
    vec2 fw = fwidth(p / 0.5);
    vec2 e = 1.0 - smoothstep(vec2(sz) - fw, vec2(sz) + fw, abs(f));
    float tw = 0.55 + 0.45 * sin(6.2831853 * (uTime / 10.0) * (1.0 + floor(h * 30.0)) + h * 50.0);
    col += uDot * e.x * e.y * (0.35 + 0.9 * hash(cell + 3.0)) * tw;
  }
  // fade with distance from the map centre
  float r = length((p - vec2(1.0, -1.5)) * vec2(0.55, 0.8));
  col = mix(col, uFloor * 1.2 + uGrid * 0.12, 0.35 * smoothstep(10.0, 26.0, r));
  gl_FragColor = vec4(col, 1.0);
}`;

const serverTexture = () => {
  // Slots are wide and pre-blurred: thin 1-px-on-screen lines shimmered as the camera pushed in.
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0a1e40";
  x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 3; i++) {
    const y0 = 16 + i * 164;
    x.fillStyle = "#14447a";
    x.fillRect(12, y0, 232, 148);
    x.filter = "blur(10px)";
    for (let s = 0; s < 2; s++) {
      x.fillStyle = "#4fb4d8";
      x.fillRect(32, y0 + 30 + s * 58, 144, 30);
    }
    x.fillStyle = "#cfffff";
    x.fillRect(196, y0 + 26, 22, 22);
    x.filter = "none";
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const additiveDisc = (color: Color, inner: number) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uColor: { value: color }, uAmt: { value: 1 }, uInner: { value: inner } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmt; uniform float uInner; varying vec2 vUv;
      void main(){
        float r = length(vUv);
        float ring = exp(-pow((r - uInner) / 0.06, 2.0));
        float halo = exp(-r * r * 3.0) * 0.35;
        float fillD = (1.0 - smoothstep(uInner - 0.05, uInner + 0.02, r)) * 0.45;
        float a = (ring * 2.2 + halo * 0.6 + fillD) * (1.0 - smoothstep(0.85, 1.0, r));
        gl_FragColor = vec4(uColor * a * uAmt, 1.0);
      }`,
  });

/* Network lines: one merged strip mesh with per-vertex path attributes. */
const buildLines = () => {
  const pos: number[] = [];
  const attS: number[] = [];
  const attLen: number[] = [];
  const attT: number[] = [];
  const attSide: number[] = [];
  const idx: number[] = [];
  const W = 0.032;
  PATHS.forEach((p) => {
    let total = 0;
    for (let i = 1; i < p.pts.length; i++) total += p.pts[i].distanceTo(p.pts[i - 1]);
    let s0 = 0;
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1];
      const b = p.pts[i];
      const d = b.clone().sub(a);
      const len = d.length();
      d.normalize();
      const n = new Vector2(-d.y, d.x).multiplyScalar(W / 2);
      const ext = d.clone().multiplyScalar(W / 2); // overlap at corners
      const base = pos.length / 3;
      const quad = [
        [a.x - ext.x + n.x, a.y - ext.y + n.y, s0 - W / 2, 1],
        [a.x - ext.x - n.x, a.y - ext.y - n.y, s0 - W / 2, -1],
        [b.x + ext.x + n.x, b.y + ext.y + n.y, s0 + len + W / 2, 1],
        [b.x + ext.x - n.x, b.y + ext.y - n.y, s0 + len + W / 2, -1],
      ];
      quad.forEach(([x, z, s, side]) => {
        pos.push(x, LINE_Y, z);
        attS.push(s);
        attLen.push(total);
        attT.push(p.t0, p.dur);
        attSide.push(side);
      });
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      s0 += len;
    }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aS", new BufferAttribute(new Float32Array(attS), 1));
  g.setAttribute("aLen", new BufferAttribute(new Float32Array(attLen), 1));
  g.setAttribute("aT", new BufferAttribute(new Float32Array(attT), 2));
  g.setAttribute("aSide", new BufferAttribute(new Float32Array(attSide), 1));
  g.setIndex(idx);
  return g;
};

const LINE_GLSL_COMMON = /* glsl */ `
float easeIO(float x) { x = clamp(x, 0.0, 1.0); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
`;

const lineMaterial = (color: Color) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: color } },
    vertexShader: /* glsl */ `
      attribute float aS; attribute float aLen; attribute vec2 aT; attribute float aSide;
      varying float vS; varying float vLen; varying vec2 vT; varying float vSide;
      void main() {
        vS = aS; vLen = aLen; vT = aT; vSide = aSide;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor;
      varying float vS; varying float vLen; varying vec2 vT; varying float vSide;
      ${LINE_GLSL_COMMON}
      void main() {
        float head = easeIO((uTime - vT.x) / vT.y) * vLen;
        if (vS > head) discard;
        float across = exp(-vSide * vSide * 2.2);
        float a = 1.3 * across;
        // glowing nodes at intervals along the line
        float nd = fract(vS / 1.4);
        a += 3.0 * exp(-pow(min(nd, 1.0 - nd) * 1.4 / 0.06, 2.0)) * smoothstep(head - 0.2, head - 0.6, vS);
        // bright tip while drawing
        a += 2.5 * exp(-pow((head - vS) / 0.25, 2.0)) * step(head, vLen - 0.01);
        // pulses travelling toward the cloud
        float since = uTime - vT.x - 0.4;
        if (since > 0.0) {
          float ph = (vS - since * 2.2) / 1.6;
          float d = fract(ph);
          a += 4.0 * exp(-pow(min(d, 1.0 - d) * 1.6 / 0.09, 2.0)) * smoothstep(0.0, 0.6, since);
        }
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });

/* Cloud outline: union of circles + rounded base, traced radially. */
const cloudShape = () => {
  const circles: [number, number, number][] = [
    [-1.05, 0.62, 0.66],
    [0.05, 1.05, 1.0],
    [1.12, 0.66, 0.64],
  ];
  const sdf = (x: number, y: number) => {
    let d = Infinity;
    circles.forEach(([cx, cy, r]) => (d = Math.min(d, Math.hypot(x - cx, y - cy) - r)));
    // rounded rectangle base
    const hx = 1.75;
    const hy = 0.5;
    const rr = 0.48;
    const qx = Math.abs(x) - (hx - rr);
    const qy = Math.abs(y - 0.5) - (hy - rr);
    const box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
    return Math.min(d, box);
  };
  const c = new Vector2(0, 0.75);
  const pts: Vector2[] = [];
  const N = 360;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let lo = 0;
    let hi = 3;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (sdf(c.x + dx * m, c.y + dy * m) < 0) lo = m;
      else hi = m;
    }
    pts.push(new Vector2(c.x + dx * lo, c.y + dy * lo));
  }
  // splice an up-arrow notch into the flat underside (streams rise into it)
  const sw = 0.27;
  const hw = 0.66;
  const yh = 1.02;
  const yt = 1.72;
  const kept = pts.filter((q) => !(q.y < 0.06 && Math.abs(q.x) < sw + 0.02));
  // insert where the underside passes x = 0 (going left → right, CCW)
  let at = kept.findIndex((q, i) => i > 0 && kept[i - 1].y < 0.1 && q.y < 0.1 && kept[i - 1].x < 0 && q.x > 0);
  if (at < 0) at = kept.findIndex((q) => q.y < 0.1 && q.x > 0);
  const notch = [
    new Vector2(-sw, 0), new Vector2(-sw, yh), new Vector2(-hw, yh), new Vector2(0, yt),
    new Vector2(hw, yh), new Vector2(sw, yh), new Vector2(sw, 0),
  ];
  kept.splice(at, 0, ...notch);
  const shape = new Shape(kept);
  return shape;
};

/* Vertical light streams inside the arrow. */
const streamMaterial = (color: Color) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uGrow: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uGrow; varying vec2 vUv;
      void main(){
        if (vUv.y > uGrow) discard;
        float x = vUv.x * 2.0 - 1.0;
        float across = exp(-x * x * 6.0);
        float a = 0.9 * across;
        a += 2.2 * across * smoothstep(0.55, 0.95, vUv.y);
        float ph = fract(vUv.y * 2.4 - uTime * 0.9);
        a += 2.0 * across * exp(-pow(min(ph, 1.0 - ph) / 0.07, 2.0));
        a *= smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });

/* ------------------------------------------------------------------ */

const lerpV = (a: Vector3, b: Vector3, t: number) => a.clone().lerp(b, t);

export const createCloudMap = (p: CloudMapParams, geo: LandGeoJSON) => (renderer: WebGLRenderer): Look => {
  const scene = new Scene();
  scene.background = new Color(...lin(p.floor));
  const camera = new PerspectiveCamera(34, 16 / 9, 0.1, 200);
  const post = new PostPipeline({
    tonemap: "aces",
    exposure: 1.1,
    bloomStrength: 2.0,
    bloomThreshold: 0.45,
    bloomKnee: 0.4,
    bloomRadius: 0.85,
    vignette: 0.4,
    vignetteStart: 0.3,
    grain: 0.015,
    grainPeriod: 300,
    blueNoise: false,
    saturation: 0.82,
  });
  const accent = linColor(p.accent);

  // environment: blue gradient dome + soft panels (for satin land & glass cloud)
  const envScene = new Scene();
  envScene.add(envDome(`col = mix(vec3(0.005, 0.01, 0.04), vec3(0.08, 0.2, 0.6), smoothstep(-0.2, 0.9, d.y));`));
  const sb = panel(20, 10, new Color("#9FD8FF"), 3);
  sb.position.set(-8, 20, 10);
  sb.lookAt(0, 0, 0);
  const sb2 = panel(30, 6, accent, 1.5);
  sb2.position.set(10, 8, -20);
  sb2.lookAt(0, 0, 0);
  envScene.add(sb, sb2);
  const env = envFromScene(renderer, envScene);
  scene.environment = env;

  const key = new DirectionalLight(new Color("#9AC8FF"), 0.7);
  key.position.set(-4, 10, 6);
  scene.add(key);

  // floor grid
  const floorMat = new ShaderMaterial({
    uniforms: {
      uFloor: { value: new Color(...lin(p.floor)) },
      uGrid: { value: new Color(...lin(p.grid)).multiplyScalar(1.6) },
      uDot: { value: new Color(...lin("#2A7AF0")).multiplyScalar(0.9) },
      uTime: { value: 0 },
      uPx: { value: 1 },
    },
    vertexShader: /* glsl */ `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: FLOOR_FRAG,
  });
  const floor = new Mesh(new PlaneGeometry(240, 160), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(2, -0.001, -2);
  scene.add(floor);

  // land
  const landTop = new MeshPhysicalMaterial({
    color: new Color(...lin(p.land)).multiplyScalar(0.62),
    transparent: true,
    opacity: 0.86,
    roughness: 0.45,
    metalness: 0.1,
    clearcoat: 0.2,
    clearcoatRoughness: 0.35,
    emissive: new Color(...lin(p.land)),
    emissiveIntensity: 0.06,
    envMapIntensity: 0.28,
  });
  const landSide = new MeshStandardMaterial({
    color: new Color(...lin(p.land)),
    emissive: new Color(...lin("#5A8AFF")),
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.86,
    roughness: 0.4,
  });
  const land = new Mesh(buildLand(geo), [landTop, landSide]);
  scene.add(land);

  // servers + pads
  const sTex = serverTexture();
  const serverMat = new MeshStandardMaterial({
    color: new Color("#0C1E3C"),
    emissive: new Color(1, 1, 1),
    emissiveMap: sTex,
    emissiveIntensity: 0.6,
    roughness: 0.5,
    metalness: 0.2,
    envMapIntensity: 0.4,
  });
  const serverTop = new MeshStandardMaterial({ color: new Color(0, 0, 0), emissive: accent.clone(), emissiveIntensity: 1.9 });
  const servers = new Group();
  const pads: ShaderMaterial[] = [];
  SERVERS.forEach(([lon, lat]) => {
    const xz = toXZ(lon, lat);
    const g = new Group();
    const box = new Mesh(new RoundedBoxGeometry(0.34, 0.46, 0.3, 2, 0.035), serverMat);
    box.position.y = LAND_H + 0.04 + 0.23;
    const lid = new Mesh(new RoundedBoxGeometry(0.3, 0.02, 0.26, 1, 0.008), serverTop);
    lid.position.y = LAND_H + 0.04 + 0.465;
    const plinth = new Mesh(
      new CylinderGeometry(0.34, 0.36, 0.04, 64),
      new MeshStandardMaterial({ color: new Color("#0A1A3A"), emissive: accent.clone(), emissiveIntensity: 0.6 }),
    );
    plinth.position.y = LAND_H + 0.02;
    const padMat = additiveDisc(accent.clone().multiplyScalar(1.1), 0.62);
    pads.push(padMat);
    const pad = new Mesh(new PlaneGeometry(0.85, 0.85), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = LAND_H + 0.045;
    g.add(box, lid, plinth, pad);
    g.position.set(xz.x, 0, xz.y);
    g.scale.setScalar(1.6);
    servers.add(g);
  });
  scene.add(servers);

  // network lines
  const lineMat = lineMaterial(accent.clone().multiplyScalar(1.2));
  const lines = new Mesh(buildLines(), lineMat);
  lines.frustumCulled = false;
  scene.add(lines);

  // cloud
  const cloudGroup = new Group();
  const cloudGeo = new ExtrudeGeometry(cloudShape(), {
    depth: 0.5,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.12,
    bevelSegments: 6,
    curveSegments: 24,
  });
  cloudGeo.translate(0, 0, -0.25);
  const cloudMat = new MeshPhysicalMaterial({
    color: new Color("#3F8CF0"),
    roughness: 0.14,
    metalness: 0,
    transmission: 0.2,
    thickness: 0.6,
    ior: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    emissive: new Color(...lin("#1A56D8")),
    emissiveIntensity: 0.4,
    envMapIntensity: 1.4,
  });
  cloudMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      {
        float fr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += vec3(0.3, 0.75, 1.0) * pow(fr, 2.2) * 2.0 * (0.6 + 0.4 * normal.y);
        totalEmissiveRadiance *= mix(0.3, 1.0, smoothstep(-0.6, 0.4, normal.y));
      }`,
    );
  };
  const cloud = new Mesh(cloudGeo, cloudMat);
  cloudGroup.add(cloud);
  const halo = new Mesh(new PlaneGeometry(7, 5), additiveDisc(new Color(...lin("#2A70FF")).multiplyScalar(0.25), 0.0));
  halo.position.set(0, 0.8, -0.4);
  cloudGroup.add(halo);
  scene.add(cloudGroup);

  // streams: vertical lines from the map up through the arrow
  const streamMat = streamMaterial(accent.clone().multiplyScalar(1.3));
  const streams = new Group();
  for (let i = 0; i < 7; i++) {
    const m = new Mesh(new PlaneGeometry(0.03, 1), streamMat);
    m.position.set((-0.18 + i * 0.06) * CLOUD_SCALE, 0.5, 0);
    streams.add(m);
  }
  scene.add(streams);

  // camera keys
  const wideTarget = new Vector3(1.0, 0, -0.6);
  const wideOffset = new Vector3(-0.8, 8.2, 11.8);
  const midTarget = new Vector3(1.1, 0.4, -2.6);
  const midOffset = new Vector3(-0.6, 6.4, 9.0);
  const closeTarget = new Vector3(cloudBase.x + 0.3, 1.1, cloudBase.y + 2.0);
  const closeOffset = new Vector3(-0.5, 5.2, 8.0);

  const update = (frame: number, h: number) => {
    const f = Math.min(Math.max(frame, 0), DURATION);
    const t = f / FPS; // seconds

    // camera: slow push (0–6.5 s), then eased push-in to the cloud and hold
    const a = easeInOutCubic(t / 6.5);
    let target = lerpV(wideTarget, midTarget, a);
    let offset = lerpV(wideOffset, midOffset, a);
    const b = easeInOutCubic((t - 6.5) / 2.6);
    target = lerpV(target, closeTarget, b);
    offset = lerpV(offset, closeOffset, b);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);

    // servers glow, gently pulsing (whole cycles over the 10 s)
    pads.forEach((m, i) => {
      m.uniforms.uAmt.value = 0.85 + 0.15 * Math.sin((Math.PI * 2 * (f / DURATION)) * 3 + i * 1.7);
    });

    lineMat.uniforms.uTime.value = t;
    floorMat.uniforms.uTime.value = t;
    floorMat.uniforms.uPx.value = h / 720;

    // cloud rises 4–6.5 s (eased)
    const rise = easeOutCubic((t - 4.0) / 2.5);
    const appear = smooth((t - 4.0) / 1.2);
    const s = CLOUD_SCALE * (0.25 + 0.75 * easeOutCubic((t - 4.0) / 2.2));
    cloudGroup.position.set(cloudBase.x, 0.05 + 0.85 * rise, cloudBase.y + 0.9);
    cloudGroup.scale.setScalar(s * Math.max(appear, 1e-4));
    cloudGroup.rotation.set(-0.18, 0, 0);
    cloudGroup.visible = appear > 0.001;
    cloudMat.emissiveIntensity = 0.4 + 1.2 * (1 - smooth((t - 4.6) / 1.6)) * appear;

    // streams light up beneath the cloud
    const grow = easeInOutCubic((t - 4.6) / 1.6);
    streamMat.uniforms.uGrow.value = grow;
    streamMat.uniforms.uTime.value = t;
    const top = cloudGroup.position.y + 1.35 * s;
    streams.scale.x = s / CLOUD_SCALE;
    streams.position.set(cloudBase.x, LINE_Y, cloudBase.y + 0.9);
    streams.children.forEach((m) => {
      m.scale.y = Math.max(top - LINE_Y, 0.01);
      m.position.y = (top - LINE_Y) / 2;
    });
    streams.visible = grow > 0;
  };

  return {
    render(gl, frame, w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      update(frame, h);
      post.renderScene(gl, scene, camera, w, h);
      post.finish(gl, frame);
    },
    dispose() {
      post.dispose();
      env.dispose();
      sTex.dispose();
    },
  };
};
