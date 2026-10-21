// Geometry builders for the steampunk machine.
import * as THREE from "three";
import { TAU } from "../lib/random";

export const shadowed = <T extends THREE.Object3D>(o: T) => {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
};

export const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => shadowed(new THREE.Mesh(g, m));

// --- Gears -----------------------------------------------------------------
// Tooth k is centred on angle 2*pi*k/N in the gear's local frame.
export type GearSpec = { teeth: number; module: number; thickness: number; spokes?: number; hub?: number };

export const pitchRadius = (g: GearSpec) => (g.module * g.teeth) / 2;

export const gearGeometry = (g: GearSpec) => {
  const rp = pitchRadius(g);
  const ra = rp + g.module;
  const rr = rp - 1.25 * g.module;
  const s = new THREE.Shape();
  const N = g.teeth;
  const pitchAng = TAU / N;
  // tooth: tip spans 0.22 of pitch, root spans 0.56, flanks between
  for (let k = 0; k < N; k++) {
    const c = k * pitchAng;
    const pts: [number, number][] = [
      [rr, c - pitchAng * 0.5],
      [rr, c - pitchAng * 0.27],
      [rp, c - pitchAng * 0.19],
      [ra, c - pitchAng * 0.11],
      [ra, c + pitchAng * 0.11],
      [rp, c + pitchAng * 0.19],
      [rr, c + pitchAng * 0.27],
    ];
    pts.forEach(([r, a], i) => {
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (k === 0 && i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hubR = g.hub ?? rp * 0.22;
  const bore = new THREE.Path();
  bore.absarc(0, 0, hubR * 0.45, 0, TAU, true);
  s.holes.push(bore);
  const spokes = g.spokes ?? 0;
  if (spokes > 0) {
    const r0 = hubR * 1.35;
    const r1 = rr - g.module * 1.1;
    const half = (TAU / spokes) * 0.5 - 0.22;
    for (let i = 0; i < spokes; i++) {
      const a = (i + 0.5) * (TAU / spokes);
      const h = new THREE.Path();
      h.moveTo(r0 * Math.cos(a - half * 0.6), r0 * Math.sin(a - half * 0.6));
      h.absarc(0, 0, r1, a - half, a + half, false);
      h.lineTo(r0 * Math.cos(a + half * 0.6), r0 * Math.sin(a + half * 0.6));
      h.closePath();
      s.holes.push(h);
    }
  }
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: g.thickness,
    bevelEnabled: true,
    bevelThickness: g.thickness * 0.12,
    bevelSize: g.module * 0.12,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -g.thickness / 2);
  return geo;
};

// Angle of a gear meshing with a driver. Driver at angle a1 (rad) with N1
// teeth; driven gear has N2 teeth and sits in direction `dir` from the
// driver. Teeth interleave: a driver tooth on the line of centres faces a gap.
export const meshAngle = (a1: number, N1: number, N2: number, dir: number) =>
  -(N1 / N2) * (a1 - dir) + dir + Math.PI + Math.PI / N2;

// --- Pipes -----------------------------------------------------------------
// Polyline with rounded corners -> CurvePath (lines + quadratic elbows).
export const elbowPath = (pts: THREE.Vector3[], bend: number) => {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let prev = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const r = Math.min(bend, a.distanceTo(b) * 0.45, b.distanceTo(c) * 0.45);
    const p1 = b.clone().add(a.clone().sub(b).setLength(r));
    const p2 = b.clone().add(c.clone().sub(b).setLength(r));
    if (prev.distanceTo(p1) > 1e-5) path.add(new THREE.LineCurve3(prev, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, pts[pts.length - 1].clone()));
  return path;
};

export const pipeGeometry = (pts: THREE.Vector3[], radius: number, bend = radius * 2.6) => {
  const path = elbowPath(pts, bend);
  const len = path.getLength();
  return new THREE.TubeGeometry(path, Math.max(40, Math.round(len * 90)), radius, 20, false);
};

// Flange with a ring of bolts, oriented along `dir`, centred at `at`.
export const flange = (at: THREE.Vector3, dir: THREE.Vector3, radius: number, mat: THREE.Material, boltMat: THREE.Material, bolts = 6) => {
  const g = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(radius * 1.65, radius * 1.65, radius * 0.55, 28), mat);
  g.add(disc);
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * TAU + 0.3;
    const b = mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, radius * 0.8, 6), boltMat);
    b.position.set(Math.cos(a) * radius * 1.32, 0, Math.sin(a) * radius * 1.32);
    g.add(b);
  }
  g.position.copy(at);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return g;
};

// Coil spring along +x from 0 to length.
export const coilGeometry = (radius: number, wire: number, turns: number, length: number) => {
  const pts: THREE.Vector3[] = [];
  const n = Math.round(turns * 48);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * TAU;
    pts.push(new THREE.Vector3(t * length, Math.cos(a) * radius, Math.sin(a) * radius));
  }
  const helix = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(helix, Math.round(turns * 40), wire, 12, false);
};

// --- Gauge faces -----------------------------------------------------------
// Numerals drawn as strokes (no font needed): segments on a 2x4 grid.
const DIGITS: Record<string, [number, number][][]> = {
  "0": [[[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]]],
  "1": [[[0.6, 0.8], [1.2, 0], [1.2, 4]]],
  "2": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 4], [2, 4]]],
  "3": [[[0, 0], [2, 0], [2, 4], [0, 4]], [[0.5, 2], [2, 2]]],
  "4": [[[0, 0], [0, 2], [2, 2]], [[2, 0], [2, 4]]],
  "5": [[[2, 0], [0, 0], [0, 2], [2, 2], [2, 4], [0, 4]]],
  "6": [[[2, 0], [0, 0], [0, 4], [2, 4], [2, 2], [0, 2]]],
  "7": [[[0, 0], [2, 0], [0.8, 4]]],
  "8": [[[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]], [[0, 2], [2, 2]]],
  "9": [[[2, 2], [0, 2], [0, 0], [2, 0], [2, 4], [0, 4]]],
};

const drawNumber = (ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, h: number) => {
  const u = h / 4;
  const w = text.length * 2 * u + (text.length - 1) * 0.9 * u;
  let x0 = cx - w / 2;
  for (const ch of text) {
    for (const line of DIGITS[ch]) {
      ctx.beginPath();
      line.forEach(([x, y], i) => (i ? ctx.lineTo(x0 + x * u, cy - h / 2 + y * u) : ctx.moveTo(x0 + x * u, cy - h / 2 + y * u)));
      ctx.stroke();
    }
    x0 += 2.9 * u;
  }
};

// Dial sweep: from -135deg to +135deg (clockwise), 0 at lower left.
export const DIAL_SWEEP = (270 * Math.PI) / 180;
export const dialTexture = (maxValue: number) => {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, "#f4f2ee");
  g.addColorStop(1, "#d9d4ca");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "#1a1612";
  ctx.lineCap = "round";
  const R = S * 0.42;
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const a = -DIAL_SWEEP / 2 + (i / steps) * DIAL_SWEEP; // from straight up
    const major = i % 5 === 0;
    const r0 = major ? R * 0.8 : R * 0.88;
    ctx.lineWidth = major ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.sin(a) * r0, S / 2 - Math.cos(a) * r0);
    ctx.lineTo(S / 2 + Math.sin(a) * R, S / 2 - Math.cos(a) * R);
    ctx.stroke();
    if (major) {
      ctx.lineWidth = 5;
      const v = Math.round((i / steps) * maxValue);
      drawNumber(ctx, String(v), S / 2 + Math.sin(a) * R * 0.6, S / 2 - Math.cos(a) * R * 0.6, 34);
    }
  }
  // red zone at the top end
  ctx.strokeStyle = "#a3160f";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, R * 1.04, -Math.PI / 2 + DIAL_SWEEP / 2 - 0.7, -Math.PI / 2 + DIAL_SWEEP / 2);
  ctx.stroke();
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, R * 1.1, 0, TAU);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};
