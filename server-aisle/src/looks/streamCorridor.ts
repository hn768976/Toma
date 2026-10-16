import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  FogExp2,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { canvasTexture, makeCanvas } from "../lib/canvasTex";
import { makeLedMaterial } from "../lib/ledMaterial";
import { GradeParams, makePipeline } from "../lib/post";
import { LOOP_PERIODS, ledValue, mod, mulberry32, pick, range } from "../lib/random";
import { makeReflectiveFloorMaterial, PlanarReflection } from "../lib/reflection";
import type { LookRuntime } from "../lib/GLStage";

export type StreamCorridorParams = {
  ribbon: string;
  edge: string;
  grade: GradeParams;
  loop: number;
};

const PITCH = 0.7; // cabinet width / spacing
const TYPES = 4; // cabinet pattern repeats every 4 (= camera travel per loop)
const TRAVEL = TYPES * PITCH; // 2.8 m per loop
const HALF_AISLE = 1.2; // 2.4 m wide corridor
const CAB_H = 2.32;
const CAB_D = 1.0;
const CEIL_Y = 2.75;
const N_BEHIND = 6;
const N_AHEAD = 78;
const TW = 384;
const TH = 1280;

// ---- Cabinet LED faces (module-level seeded layout) -----------------------
type CabLayout = { cols: { x: number; dots: { y: number; c: number; g: number }[] }[]; groups: { p: number; ph: number }[] };
const CAB_LAYOUTS: CabLayout[] = Array.from({ length: TYPES }, (_, t) => {
  const r = mulberry32(0xc0ffee + t * 131);
  const nCols = 12 + Math.floor(r() * 5);
  const cols: CabLayout["cols"] = [];
  for (let i = 0; i < nCols; i++) {
    const x = 34 + ((TW - 68) * (i + 0.5 + (r() - 0.5) * 0.3)) / nCols;
    const dots: CabLayout["cols"][number]["dots"] = [];
    let y = 40 + r() * 30;
    while (y < TH - 50) {
      // Runs of lit dots with gaps, like the reference.
      if (r() < 0.8) {
        const cRoll = r();
        const c = cRoll < 0.62 ? 0 : cRoll < 0.82 ? 1 : 2; // blue, white, amber
        const g = r() < 0.33 ? 1 + Math.floor(r() * 3) : 0;
        dots.push({ y, c, g });
      }
      y += 8 + (r() < 0.1 ? 22 : 0);
    }
    cols.push({ x, dots });
  }
  const groups = [0, 1, 2].map(() => ({ p: pick(r, LOOP_PERIODS), ph: Math.floor(r() * 200) }));
  return { cols, groups };
});

const drawCabinet = (t: number) => {
  const alb = makeCanvas(TW, TH);
  const emi = makeCanvas(TW, TH);
  const msk = makeCanvas(TW, TH);
  alb.ctx.fillStyle = "#06080c";
  alb.ctx.fillRect(0, 0, TW, TH);
  // Faint server stack lines behind the glass.
  alb.ctx.fillStyle = "#121c2e";
  for (let y = 20; y < TH; y += 22) alb.ctx.fillRect(16, y, TW - 32, 9);
  emi.ctx.fillStyle = "#000";
  emi.ctx.fillRect(0, 0, TW, TH);
  msk.ctx.fillStyle = "#000";
  msk.ctx.fillRect(0, 0, TW, TH);
  const colors = ["#2fb8ff", "#d6f0ff", "#ffb43a"];
  for (const col of CAB_LAYOUTS[t].cols)
    for (const d of col.dots) {
      emi.ctx.fillStyle = colors[d.c];
      emi.ctx.globalAlpha = d.c === 0 ? 0.95 : 1;
      emi.ctx.fillRect(col.x - 2.5, d.y - 2, 5, 4);
      emi.ctx.globalAlpha = 1;
      if (d.g) {
        msk.ctx.fillStyle = d.g === 1 ? "#ff0000" : d.g === 2 ? "#00ff00" : "#0000ff";
        msk.ctx.fillRect(col.x - 5, d.y - 4, 10, 8);
      }
    }
  // A few small horizontal indicator bars.
  const r = mulberry32(0xbeef + t);
  for (let k = 0; k < 0; k++) {
    emi.ctx.fillStyle = "rgba(120,190,255,0.6)";
    emi.ctx.fillRect(40 + r() * (TW - 140), 60 + r() * (TH - 120), 40 + r() * 50, 3);
  }
  return { alb: alb.canvas, emi: emi.canvas, msk: msk.canvas };
};

// ---- Ribbons ----------------------------------------------------------------
// Each ribbon is a camera-facing strip along a 3D curve that is periodic in
// depth with a period dividing the 2.8 m camera travel.
const ribbonVert = /* glsl */ `
attribute vec4 iA; // type, x0, y0, radius
attribute vec4 iB; // periodK (cycles per 2.8 m), phase, width, base
attribute vec4 iC; // dashK (dashes per 2.8 m), dashCycles (per loop, signed), tail, brightness
uniform float uT;       // loop progress 0..1 (frame mod loop / loop)
uniform float uTravel;  // 2.8
uniform float uNear;
uniform float uFar;
uniform float uPixelAngle;
varying float vS;
varying float vAcross;
varying float vDist;
varying float vBase;
varying float vBright;
varying float vTail;
varying float vDashK;
varying float vDashC;

const float TAU = 6.28318530718;

vec3 curve(float zr) {
  // World depth phase: w / P = (zr - camZ) / P, with camZ = -uT * travel.
  float k = iB.x;
  float ph = TAU * (k * (-zr / uTravel) + k * uT) + iB.y;
  float type = iA.x;
  if (type < 0.5) {
    return vec3(iA.y, iA.z, zr); // straight streak
  } else if (type < 1.5) {
    // Helix around the aisle axis.
    return vec3(iA.y + iA.w * cos(ph), iA.z + iA.w * sin(ph) * 0.85, zr);
  } else if (type < 2.5) {
    // Horizontal looping curve (prolate trochoid) at height y0.
    return vec3(iA.y + iA.w * sin(ph), iA.z + 0.05 * sin(ph + 1.0), zr + iA.w * 1.3 * cos(ph));
  } else {
    // Looping curve in the plane of the cabinet faces (cursive loops).
    return vec3(iA.y + 0.03 * sin(ph), iA.z + iA.w * sin(ph), zr + iA.w * 1.3 * cos(ph));
  }
}

void main() {
  float t = position.y + 0.5; // 0..1 along the strip
  float zr = mix(uNear, uFar, pow(t, 1.6));
  float dz = (uFar - uNear) * 0.0015;
  vec3 p = curve(zr);
  vec3 p2 = curve(zr + dz);
  vec3 T = normalize(p2 - p + vec3(0.0, 0.0, 1e-5));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vec3 V = normalize(cameraPosition - wp.xyz);
  vec3 sd = cross(T, V);
  float sl = length(sd);
  vec3 side = sl > 1e-4 ? sd / sl : vec3(0.0, 1.0, 0.0);
  float depth = length(cameraPosition - wp.xyz);
  float w = max(iB.z, depth * uPixelAngle * 1.1);
  vBright = iC.w * (iB.z / w);
  wp.xyz += side * position.x * w * 2.0;
  // Dash coordinate in world depth, so dashes stay locked to the curve.
  vS = (-zr / uTravel) + uT;
  vAcross = position.x * 2.0;
  vDist = depth;
  vBase = iB.w;
  vTail = iC.z;
  vDashK = iC.x;
  vDashC = iC.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const ribbonFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uT;
varying float vS;
varying float vAcross;
varying float vDist;
varying float vBase;
varying float vBright;
varying float vTail;
varying float vDashK;
varying float vDashC;
void main() {
  float x = fract(vS * vDashK - uT * vDashC);
  // Bright head, soft exponential tail.
  float dash = smoothstep(0.0, 0.015, x) * exp(-x * vTail);
  float I = (vBase + 1.9 * dash) * vBright;
  float prof = exp(-vAcross * vAcross * 3.0);
  vec3 c = mix(uColor, vec3(1.0), smoothstep(0.7, 2.2, I * prof)) * I * prof;
  c *= exp(-vDist * 0.035);
  gl_FragColor = vec4(c, 1.0);
}
`;

type Ribbon = { a: [number, number, number, number]; b: [number, number, number, number]; c: [number, number, number, number] };
const ribbonRng = mulberry32(0x51b80);
const RIBBONS: Ribbon[] = (() => {
  const r = ribbonRng;
  const list: Ribbon[] = [];
  const dashKs = [1, 2, 4, 5]; // dashes per 2.8 m (2.8, 1.4, 0.7, 0.56 m apart)
  // Bright streams along the cabinet faces, bunched 3-5 together.
  for (let g = 0; g < 4; g++) {
    const side = g % 2 === 0 ? -1 : 1;
    const n = 3 + Math.floor(r() * 3);
    const y0 = range(r, 0.75, 1.55);
    const x = side * (HALF_AISLE - 0.07 - 0.06 * r());
    const cycles = (r() < 0.7 ? 1 : -1) * pick(r, [2, 3]);
    for (let k = 0; k < n && list.length < 12; k++)
      list.push({
        a: [0, x - side * 0.015 * k, y0 + k * range(r, 0.04, 0.07), 0],
        b: [0, 0, 0.009, 0.3],
        c: [pick(r, dashKs), cycles, range(r, 4, 8), range(r, 1.2, 1.7)],
      });
  }
  while (list.length < 14) {
    const side = list.length % 2 === 0 ? -1 : 1;
    list.push({
      a: [0, side * (HALF_AISLE - 0.08 - 0.1 * r()), range(r, 0.15, 2.35), 0],
      b: [0, 0, 0.008, 0.25],
      c: [pick(r, dashKs), pick(r, [2, 3]), range(r, 4, 8), range(r, 1.0, 1.4)],
    });
  }
  // Gentle S-swoops in the plane of the cabinet faces (non-looping), plus
  // two hooks that make a single loop near the near frames.
  for (let i = 0; i < 7; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const hook = i >= 5;
    const R = hook ? range(r, 0.22, 0.28) : range(r, 0.12, 0.26);
    list.push({
      a: [3, side * (HALF_AISLE - 0.12 - 0.1 * r()), range(r, 0.85, 1.55), R],
      b: [hook ? 2 : 1, r() * 6.28, 0.009, 0.22],
      c: [pick(r, [1, 2]), (i % 3 ? 1 : -1) * 2, range(r, 4, 7), range(r, 1.1, 1.5)],
    });
  }
  // Curves sweeping across the floor near the walls.
  for (let i = 0; i < 1; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const R = range(r, 0.3, 0.45);
    list.push({
      a: [2, side * (HALF_AISLE - R - 0.1), 0.03, R],
      b: [pick(r, [1, 2]), r() * 6.28, 0.009, 0.2],
      c: [pick(r, [1, 2]), 2, range(r, 4, 7), range(r, 1.0, 1.3)],
    });
  }
  return list;
})();

export const buildStreamCorridor = (gl: WebGLRenderer, p: StreamCorridorParams): LookRuntime => {
  const size = gl.getDrawingBufferSize(new Vector2());
  const scene = new Scene();
  // Background = fog colour, so the far end reads as a dim blue doorway.
  scene.background = new Color("#14325e");
  scene.fog = new FogExp2(new Color("#14325e").getHex(), 0.05);
  const pmrem = new PMREMGenerator(gl);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.25;

  const fov = 60;
  const camera = new PerspectiveCamera(fov, 16 / 9, 0.05, 90);
  const pixelAngle = (2 * Math.tan(((fov / 2) * Math.PI) / 180)) / size.y;
  const camY = 1.3;

  // ---- Cabinets -------------------------------------------------------------
  const nCab = N_BEHIND + N_AHEAD;
  const zOf = (i: number) => -(i - N_BEHIND) * PITCH; // cabinet centre depth
  const bodyMat = new MeshStandardMaterial({ color: 0x05070a, roughness: 0.5, metalness: 0.4 });
  const glassMat = new MeshStandardMaterial({
    color: 0x06101e,
    roughness: 0.04,
    metalness: 0.9,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const edgeColor = new Color(p.edge).multiplyScalar(3.2);
  const edgeMat = new MeshBasicMaterial({ color: edgeColor });
  // Local cabinet frame: front face in the plane x = 0 facing +x, centred on z.
  const bodyGeo = new BoxGeometry(CAB_D, CAB_H, PITCH - 0.01);
  bodyGeo.translate(-CAB_D / 2 - 0.03, CAB_H / 2, 0);
  const glassGeo = new PlaneGeometry(PITCH - 0.07, CAB_H - 0.2);
  glassGeo.rotateY(Math.PI / 2);
  glassGeo.translate(0.0, CAB_H / 2 + 0.03, 0);
  const ledGeo = new PlaneGeometry(PITCH - 0.09, CAB_H - 0.26);
  ledGeo.rotateY(Math.PI / 2);
  ledGeo.translate(-0.028, CAB_H / 2 + 0.03, 0);
  const ew = 0.022;
  const inset = 0.03;
  const zH = PITCH / 2 - inset;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
  };
  // Edge-light outlines span pairs of cabinets (wide glass doors).
  const zH2 = PITCH - inset;
  const edgeGeo = mergeGeometries([
    box(0.012, CAB_H - 0.12, ew, 0.004, CAB_H / 2 + 0.03, -zH2),
    box(0.012, CAB_H - 0.12, ew, 0.004, CAB_H / 2 + 0.03, zH2),
    box(0.012, ew, 2 * zH2, 0.004, CAB_H - 0.03, 0),
    box(0.012, ew * 0.7, 2 * zH2, 0.004, 0.09, 0),
  ])!;
  void zH;
  const plinthGeo = box(0.02, 0.05, PITCH, 0.01, 0.025, 0);
  const plinthMat = new MeshBasicMaterial({ color: new Color(p.edge).multiplyScalar(0.5) });

  const place = (i: number, side: number) => {
    const m = new Matrix4().makeTranslation(side * HALF_AISLE, 0, zOf(i));
    if (side < 0) return m; // left wall: front faces +x already
    return m.multiply(new Matrix4().makeRotationY(Math.PI));
  };
  const allInst = (geo: BoxGeometry | PlaneGeometry | ReturnType<typeof mergeGeometries>, mat: MeshBasicMaterial | MeshStandardMaterial) => {
    const im = new InstancedMesh(geo!, mat, nCab * 2);
    let k = 0;
    for (let i = 0; i < nCab; i++) for (const side of [-1, 1]) im.setMatrixAt(k++, place(i, side));
    im.frustumCulled = false;
    scene.add(im);
    return im;
  };
  allInst(bodyGeo, bodyMat);
  {
    const pairs: Matrix4[] = [];
    for (let i = 0; i < nCab; i += 2)
      for (const side of [-1, 1]) pairs.push(place(i, side).premultiply(new Matrix4().makeTranslation(0, 0, -PITCH / 2)));
    const im = new InstancedMesh(edgeGeo, edgeMat, pairs.length);
    pairs.forEach((m, k) => im.setMatrixAt(k, m));
    im.frustumCulled = false;
    scene.add(im);
  }
  allInst(plinthGeo, plinthMat);
  const glass = allInst(glassGeo, glassMat);
  glass.renderOrder = 3;

  const blinkU: { u: { value: { set: (a: number, b: number, c: number) => void } }; t: number }[] = [];
  for (let t = 0; t < TYPES; t++) {
    const { alb, emi, msk } = drawCabinet(t);
    const { material, uBlink } = makeLedMaterial({
      map: canvasTexture(gl, alb, true),
      emissiveMap: canvasTexture(gl, emi, true),
      blinkMap: canvasTexture(gl, msk, false),
      emissive: new Color(1, 1, 1),
      emissiveIntensity: 3.0,
      roughness: 0.6,
      metalness: 0.2,
    });
    blinkU.push({ u: uBlink, t });
    const slots: Matrix4[] = [];
    for (let i = 0; i < nCab; i++)
      for (const side of [-1, 1]) {
        // Left side uses type i mod 4, right side is offset by 2.
        const type = mod(i + (side > 0 ? 2 : 0), TYPES);
        if (type === t) slots.push(place(i, side));
      }
    const im = new InstancedMesh(ledGeo, material, slots.length);
    slots.forEach((m, k) => im.setMatrixAt(k, m));
    im.frustumCulled = false;
    scene.add(im);
  }

  // ---- Ceiling --------------------------------------------------------------
  const zFar = zOf(nCab);
  const zNear = zOf(0);
  const len = zNear - zFar;
  const zMid = (zNear + zFar) / 2;
  const darkMat = new MeshStandardMaterial({ color: 0x18222f, roughness: 0.6, metalness: 0.3 });
  const beamMat = new MeshStandardMaterial({ color: 0x2c3a4e, roughness: 0.5, metalness: 0.4 });
  const ceil = new Mesh(new PlaneGeometry(2 * HALF_AISLE + 2, len), darkMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, CEIL_Y, zMid);
  scene.add(ceil);
  // Cross beams every 1.4 m (two per loop period).
  const beams = new InstancedMesh(new BoxGeometry(2 * HALF_AISLE, 0.12, 0.14), beamMat, Math.ceil(len / 1.4));
  for (let k = 0; k < beams.count; k++) beams.setMatrixAt(k, new Matrix4().makeTranslation(0, CEIL_Y - 0.08, zNear - k * 1.4));
  beams.frustumCulled = false;
  scene.add(beams);
  // Short white light bars across the ceiling every 2.8 m (one per loop period).
  const barMat = new MeshBasicMaterial({ color: new Color(p.edge).multiplyScalar(1.0) });
  const bars = new InstancedMesh(new BoxGeometry(0.5, 0.015, 0.05), barMat, Math.ceil(len / 2.8) * 2);
  for (let k = 0; k < bars.count; k++)
    bars.setMatrixAt(k, new Matrix4().makeTranslation(k % 2 ? 0.45 : -0.45, CEIL_Y - 0.15, zNear - Math.floor(k / 2) * 2.8 - 0.7));
  bars.frustumCulled = false;
  scene.add(bars);
  // Lit doorway at the far end, travelling with the camera (no parallax at 38 m).
  const door = new Mesh(new PlaneGeometry(1.1, 2.0), new MeshBasicMaterial({ color: new Color(0.75, 0.85, 1).multiplyScalar(0.9), fog: false }));
  scene.add(door);
  // White light strips toward the vanishing point.
  const stripMat = new MeshBasicMaterial({ color: new Color(p.edge).multiplyScalar(2.6) });
  for (const x of [-0.92, 0.92]) {
    const s = new Mesh(new BoxGeometry(0.035, 0.015, len), stripMat);
    s.position.set(x, CEIL_Y - 0.16, zMid);
    scene.add(s);
  }
  const strip3Mat = new MeshBasicMaterial({ color: new Color(p.edge).multiplyScalar(1.3) });
  for (const x of [-0.55, -0.48, 0.48, 0.55]) {
    const s = new Mesh(new BoxGeometry(0.02, 0.012, len), strip3Mat);
    s.position.set(x, CEIL_Y - 0.15, zMid);
    scene.add(s);
  }
  const strip2Mat = new MeshBasicMaterial({ color: new Color(p.edge).multiplyScalar(1.4) });
  for (const x of [-HALF_AISLE + 0.04, HALF_AISLE - 0.04]) {
    const s = new Mesh(new BoxGeometry(0.03, 0.025, len), strip2Mat);
    s.position.set(x, CAB_H + 0.04, zMid);
    scene.add(s);
  }

  // ---- Ribbons --------------------------------------------------------------
  const strip = new PlaneGeometry(1, 1, 1, 900);
  const nR = RIBBONS.length;
  const iA = new Float32Array(nR * 4);
  const iB = new Float32Array(nR * 4);
  const iC = new Float32Array(nR * 4);
  RIBBONS.forEach((rb, k) => {
    iA.set(rb.a, k * 4);
    iB.set(rb.b, k * 4);
    iC.set(rb.c, k * 4);
  });
  strip.setAttribute("iA", new InstancedBufferAttribute(iA, 4));
  strip.setAttribute("iB", new InstancedBufferAttribute(iB, 4));
  strip.setAttribute("iC", new InstancedBufferAttribute(iC, 4));
  const ribbonMat = new ShaderMaterial({
    vertexShader: ribbonVert,
    fragmentShader: ribbonFrag,
    uniforms: {
      uT: { value: 0 },
      uTravel: { value: TRAVEL },
      uNear: { value: 1.2 },
      uFar: { value: -46 },
      uPixelAngle: { value: pixelAngle },
      uColor: { value: new Color(p.ribbon) },
    },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: 2,
  });
  const ribbons = new InstancedMesh(strip, ribbonMat, nR);
  ribbons.frustumCulled = false;
  ribbons.renderOrder = 5;
  scene.add(ribbons);
  const ribbonGroup = ribbons; // ribbons are defined camera-relative

  // ---- Floor ----------------------------------------------------------------
  const refl = new PlanarReflection(size.x / 2, size.y / 2, 0);
  const { material: floorMat, uniforms: floorU } = makeReflectiveFloorMaterial({
    color: new Color(0.003, 0.006, 0.014),
    roughness: 0.3,
    metalness: 0.2,
    reflection: refl,
    reflectStrength: 0.22,
    blur: 0.006,
    lod: 1.2,
    aoX: HALF_AISLE,
    aoWidth: 0.12,
    aoStrength: 0.5,
    tile: [0.6, 0.6],
    seamDarken: 0.6,
    tileVariation: 0.15,
  });
  const floor = new Mesh(new PlaneGeometry(2 * HALF_AISLE + 2, len), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zMid);
  scene.add(floor);
  refl.hide(floor);

  const pipe = makePipeline(gl, scene, camera, {
    grade: p.grade,
    bloom: { threshold: 1.0, smoothing: 0.3, intensity: 0.65, radius: 0.6 },
  });

  return {
    render: (frame) => {
      const f = mod(frame, p.loop);
      const u = f / p.loop;
      const camZ = -u * TRAVEL; // exactly 4 cabinet spacings per loop
      const sway = 0.1 * Math.sin(2 * Math.PI * u);
      const roll = ((1 * Math.PI) / 180) * Math.sin(2 * Math.PI * 2 * u);
      camera.position.set(sway, camY + 0.02 * Math.sin(2 * Math.PI * u + 1), camZ);
      camera.rotation.set(0, -0.012 * Math.sin(2 * Math.PI * u), roll, "YXZ");
      camera.updateMatrixWorld();
      // Ribbons are built in camera-relative depth; follow the camera's z.
      ribbonGroup.position.z = camZ;
      door.position.set(0, 1.0, camZ - 38);
      ribbonMat.uniforms.uT.value = u;
      floorU.uTileOffset.value.set(0, 0);
      for (const { u: uni, t } of blinkU) {
        const g = CAB_LAYOUTS[t].groups;
        uni.value.set(ledValue(f, g[0].p, g[0].ph, "blink"), ledValue(f, g[1].p, g[1].ph, "blink"), ledValue(f, g[2].p, g[2].ph, "breathe"));
      }
      pipe.final.set("seed", f);
      scene.updateMatrixWorld(true);
      refl.update(gl, scene, camera);
      pipe.render();
    },
    dispose: () => {
      pipe.dispose();
      refl.dispose();
      pmrem.dispose();
    },
  };
};

