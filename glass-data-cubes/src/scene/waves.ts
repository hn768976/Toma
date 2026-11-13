import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { mulberry32, range } from "./random";

// Animated "wave graph" networks: a few stacked polylines that undulate and are
// cross-linked into a triangulated band, with node dots — the line-chart meshes
// floating inside the cubes of the reference.

export type WaveSpec = {
  origin: THREE.Vector3;
  width: number;
  depth: number;
  amp: number;
  rows: number;
  cols: number;
  freq: number;
  speed: number;
  phase: number;
  jitter: number[];
};

export const generateWaves = (seed: number, count: number, zNear: number, zFar: number) => {
  const rng = mulberry32(seed);
  const specs: WaveSpec[] = [];
  for (let i = 0; i < count; i++) {
    const rows = 3 + Math.floor(rng() * 5);
    const cols = 22 + Math.floor(rng() * 18);
    const side = rng() < 0.5 ? -1 : 1;
    const width = range(rng, 3.5, 8);
    const z = zNear - (i + range(rng, 0.1, 0.9)) * ((zNear - zFar) / count);
    // Either spans the corridor above/below the flight path, or sits to one side.
    const spans = rng() < 0.45;
    const x = spans ? range(rng, -2, 2) - width / 2 : side * range(rng, 1.6, 6) - (side < 0 ? width : 0);
    const y = spans ? (rng() < 0.5 ? -1 : 1) * range(rng, 1.4, 3.4) : range(rng, -3, 3);
    const jitter: number[] = [];
    for (let k = 0; k < rows * cols; k++) {
      jitter.push(rng() * 2 - 1);
    }
    specs.push({
      origin: new THREE.Vector3(x, y, z),
      width,
      depth: range(rng, 0.3, 1.0),
      amp: range(rng, 0.2, 0.5),
      rows,
      cols,
      freq: range(rng, 0.7, 1.5),
      speed: range(rng, 0.6, 1.4),
      phase: rng() * Math.PI * 2,
      jitter,
    });
  }
  return specs;
};

const nodePosition = (s: WaveSpec, r: number, c: number, t: number, out: THREE.Vector3) => {
  const u = c / (s.cols - 1);
  const x = u * s.width;
  const env = Math.sin(Math.PI * u) * 0.75 + 0.25; // taper at the ends
  const k = (x / s.width) * Math.PI * 2 * s.freq;
  const rowPhase = r * 0.55;
  const y =
    s.amp *
    env *
    (Math.sin(k + s.phase + rowPhase + t * s.speed) +
      0.35 * Math.sin(k * 1.9 - t * s.speed * 1.3 + r * 0.6) +
      0.06 * s.jitter[r * s.cols + c]);
  const z = (r / Math.max(1, s.rows - 1) - 0.5) * s.depth;
  out.set(s.origin.x + x, s.origin.y + y + r * 0.06, s.origin.z + z);
  return out;
};

export type WaveObject = {
  spec: WaveSpec;
  line: LineSegments2;
  lineGeo: LineSegmentsGeometry;
  lineMat: LineMaterial;
  points: THREE.Points;
  pointsMat: THREE.PointsMaterial;
  segs: Float32Array;
  dots: Float32Array;
};

const createDotTexture = () => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,1)");
  g.addColorStop(0.75, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
};

export const createWaveObjects = (
  specs: WaveSpec[],
  color: string,
  additive: boolean,
  lineWidthPx: number,
  dotSizePx: number,
  resolution: THREE.Vector2,
): WaveObject[] => {
  const dotTex = createDotTexture();
  return specs.map((spec) => {
    // segments: along each row + diagonals and verticals between rows
    const rowSegs = spec.rows * (spec.cols - 1);
    const linkSegs = (spec.rows - 1) * Math.ceil(spec.cols / 4);
    const segs = new Float32Array((rowSegs + linkSegs) * 6);
    const dots = new Float32Array(spec.rows * spec.cols * 3);
    const lineGeo = new LineSegmentsGeometry();
    lineGeo.setPositions(segs);
    const lineMat = new LineMaterial({
      color: new THREE.Color(color),
      linewidth: lineWidthPx,
      worldUnits: false,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    lineMat.resolution.copy(resolution);
    const line = new LineSegments2(lineGeo, lineMat);
    line.frustumCulled = false;

    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(dots, 3));
    const pointsMat = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: dotSizePx,
      sizeAttenuation: false,
      map: dotTex,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const points = new THREE.Points(pgeo, pointsMat);
    points.frustumCulled = false;
    return { spec, line, lineGeo, lineMat, points, pointsMat, segs, dots };
  });
};

const a = new THREE.Vector3();
const b = new THREE.Vector3();

export const updateWaveObject = (w: WaveObject, t: number) => {
  const s = w.spec;
  let i = 0;
  const push = (p: THREE.Vector3, q: THREE.Vector3) => {
    w.segs[i++] = p.x;
    w.segs[i++] = p.y;
    w.segs[i++] = p.z;
    w.segs[i++] = q.x;
    w.segs[i++] = q.y;
    w.segs[i++] = q.z;
  };
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols - 1; c++) {
      push(nodePosition(s, r, c, t, a), nodePosition(s, r, c + 1, t, b));
    }
  }
  for (let r = 0; r < s.rows - 1; r++) {
    for (let c = 0; c < s.cols; c += 4) {
      push(nodePosition(s, r, c, t, a), nodePosition(s, r + 1, c, t, b));
    }
  }
  w.lineGeo.setPositions(w.segs);
  let j = 0;
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      nodePosition(s, r, c, t, a);
      w.dots[j++] = a.x;
      w.dots[j++] = a.y;
      w.dots[j++] = a.z;
    }
  }
  const attr = w.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  attr.needsUpdate = true;
};
