import * as THREE from "three";
import { makeLines, Seg } from "../engine/lines";
import { mulberry32, range } from "../engine/random";
import { LookFactory } from "../engine/Stage";
import { TrailColors } from "../versions";

// Look 5 - Speed Trails, on pure black (meant for Screen/Add blending).
// Two curved bundles of glowing ribbons (upper and lower) sweep around a
// bend toward and past the camera. Dashes race along each ribbon (shader
// driven); a few huge soft streaks pass right by the lens; strong DOF.
//
// Loop: every dash pattern moves by a whole number of repeats per 600 frames.

export type TrailParams = { colors: TrailColors };

const LOOP = 600;
const SAMPLES = 90;

const FOV = 55;
const ASPECT = 16 / 9;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// Screen-designed paths: (x, y) in 0..1 frame coords (y down), d = depth.
// Points are unprojected through the fixed camera, so the bundles land
// where the reference has them while depth still drives width and blur.
const toWorld = (x: number, y: number, d: number) =>
  new THREE.Vector3((2 * x - 1) * TAN * ASPECT * d, (1 - 2 * y) * TAN * d, -d);

type Bundle = {
  // x, y, depth, spread (frame units, perpendicular on screen)
  pts: [number, number, number, number][];
  count: number;
};

// Upper bundle fans in from the top, pinches at a bend left of centre and
// shoots out to the right; the lower bundle mirrors it from below.
const BUNDLES: Bundle[] = [
  {
    pts: [
      [0.3, -0.12, 34, 0.16],
      [0.31, 0.12, 22, 0.1],
      [0.35, 0.3, 14, 0.055],
      [0.42, 0.4, 10, 0.03],
      [0.53, 0.38, 7.5, 0.05],
      [0.7, 0.3, 5.2, 0.09],
      [0.92, 0.2, 3.4, 0.15],
      [1.2, 0.08, 2.0, 0.22],
    ],
    count: 40,
  },
  {
    pts: [
      [0.3, 1.14, 34, 0.14],
      [0.32, 0.88, 22, 0.09],
      [0.36, 0.7, 14, 0.05],
      [0.43, 0.61, 10, 0.03],
      [0.55, 0.63, 7.5, 0.05],
      [0.72, 0.7, 5.2, 0.1],
      [0.93, 0.8, 3.4, 0.16],
      [1.2, 0.92, 2.0, 0.24],
    ],
    count: 42,
  },
];

type Trail = {
  pts: THREE.Vector3[];
  len: number[];
  total: number;
  color: "main" | "warm" | "hot";
  intensity: number;
  width: number;
  phase: number;
  k: number; // whole repeats per loop
  dashes: number; // dash count along the ribbon
};

const buildTrails = () => {
  const rng = mulberry32(0x7a11);
  const trails: Trail[] = [];
  BUNDLES.forEach((b) => {
    // screen-space centre line and its normals
    const P = b.pts;
    for (let i = 0; i < b.count; i++) {
      const off = Math.pow(rng(), 0.8) * (rng() < 0.5 ? -1 : 1);
      const dOff = range(rng, -0.12, 0.12);
      const ctrl = P.map(([x, y, d, sp], j) => {
        const pa = P[Math.max(0, j - 1)];
        const pb = P[Math.min(P.length - 1, j + 1)];
        let tx = pb[0] - pa[0];
        let ty = (pb[1] - pa[1]) / ASPECT;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        // perpendicular in aspect-correct screen space
        const nx = -ty;
        const ny = tx * ASPECT;
        return toWorld(x + nx * off * sp, y + ny * off * sp, d * (1 + dOff));
      });
      const curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal");
      const pts = curve.getSpacedPoints(SAMPLES);
      const len = [0];
      for (let s = 1; s < pts.length; s++) len.push(len[s - 1] + pts[s].distanceTo(pts[s - 1]));
      const r = rng();
      const color = r < 0.64 ? "main" : r < 0.88 ? "warm" : "hot";
      trails.push({
        pts,
        len,
        total: len[len.length - 1],
        color,
        intensity: range(rng, 0.6, 2.4) * (color === "hot" ? 0.8 : 1),
        width: rng() < 0.2 ? range(rng, 0.03, 0.05) : range(rng, 0.01, 0.022),
        phase: rng(),
        k: Math.floor(range(rng, 14, 30)),
        dashes: Math.floor(range(rng, 1, 4)),
      });
    }
  });
  // A few huge soft streaks right next to the lens, following the bundles.
  const near: { a: THREE.Vector3; b: THREE.Vector3; w: number; color: "main" | "warm" | "hot"; inten: number; phase: number; k: number }[] = [];
  const nearDefs: [number, number, number, number, number, number, number, "main" | "warm" | "hot"][] = [
    // x0, y0, d0, x1, y1, d1, width, colour
    [0.56, 0.3, 6.0, 1.05, 0.12, 2.2, 0.7, "main"],
    [0.6, 0.36, 5.5, 1.1, 0.24, 2.0, 0.55, "hot"],
    [0.56, 0.68, 6.0, 1.05, 0.86, 2.2, 0.7, "warm"],
    [0.62, 0.72, 5.2, 1.1, 0.95, 1.8, 0.6, "main"],
  ];
  nearDefs.forEach(([x0, y0, d0, x1, y1, d1, w, col]) => {
    near.push({
      a: toWorld(x0, y0, d0),
      b: toWorld(x1, y1, d1),
      w,
      color: col,
      inten: range(rng, 0.5, 0.9),
      phase: rng(),
      k: Math.floor(range(rng, 3, 6)),
    });
  });
  return { trails, near };
};
const TRAILS = buildTrails();

// p.x/p.y: arc-length range of this segment (0..1 along the ribbon)
// p.z: phase, p.w: dashes * 64 + k
const TRAIL_MOD = /* glsl */ `
uniform float uT;
float lineMod(float u, vec4 p) {
  float s = mix(p.x, p.y, u);
  float k = mod(p.w, 64.0);
  float dashes = floor(p.w / 64.0);
  float q = fract(s * dashes - uT * k + p.z);
  // q runs 0..1 inside a dash cell; head at q = 1, tail fading back.
  float body = smoothstep(0.35, 0.98, q) * (1.0 - smoothstep(0.985, 1.0, q));
  float head = exp(-pow((q - 0.975) / 0.012, 2.0)) * 1.6;
  // faint continuous filament so the bundle reads even between dashes
  float fil = 0.07;
  // fade in from far away
  float far = smoothstep(0.0, 0.12, s);
  return (fil + body + head) * far;
}
`;

const NEAR_MOD = /* glsl */ `
uniform float uT;
float lineMod(float u, vec4 p) {
  float q = fract(u * 0.8 - uT * p.y + p.x);
  return smoothstep(0.0, 0.45, q) * smoothstep(1.0, 0.75, q) * smoothstep(0.0, 0.15, u) * smoothstep(1.0, 0.7, u);
}
`;

export const trailsLook: LookFactory<TrailParams> = ({ params }) => {
  const c = params.colors;
  const cols = {
    main: new THREE.Color(c.main),
    warm: new THREE.Color(c.warm),
    hot: new THREE.Color(c.hot),
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.2, 200);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);

  const uT = { value: 0 };
  const segs: Seg[] = [];
  TRAILS.trails.forEach((tr) => {
    for (let s = 1; s < tr.pts.length; s++) {
      const a = tr.pts[s - 1];
      const b = tr.pts[s];
      segs.push({
        a: [a.x, a.y, a.z],
        b: [b.x, b.y, b.z],
        color: cols[tr.color],
        intensity: tr.intensity,
        widthA: tr.width,
        param: [tr.len[s - 1] / tr.total, tr.len[s] / tr.total, tr.phase, tr.dashes * 64 + tr.k],
      });
    }
  });
  const lines = makeLines(segs, {
    worldWidth: true,
    softness: 0.35,
    lineMod: TRAIL_MOD,
    uniforms: { uT },
    minHalfPx: 0.55,
    dof: { focus: 10, range: 7, maxBlur: 0.009, nearOnly: true },
  });
  scene.add(lines);

  const nearSegs: Seg[] = TRAILS.near.map((n) => ({
    a: [n.a.x, n.a.y, n.a.z],
    b: [n.b.x, n.b.y, n.b.z],
    color: cols[n.color],
    intensity: n.inten,
    widthA: n.w,
    param: [n.phase, n.k, 0, 0],
  }));
  const near = makeLines(nearSegs, {
    worldWidth: true,
    softness: 1,
    feather: 1.7,
    lineMod: NEAR_MOD,
    uniforms: { uT },
  });
  scene.add(near);

  const update = (frame: number) => {
    uT.value = (frame % LOOP) / LOOP;
  };
  return { scene, camera, update };
};
