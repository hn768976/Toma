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
    // drops near-vertically from the top, curls tightly near the vanishing
    // point and fans out to the upper right
    pts: [
      [0.52, -0.15, 30, 0.2],
      [0.47, 0.1, 20, 0.1],
      [0.47, 0.3, 13, 0.04],
      [0.51, 0.43, 9, 0.016],
      [0.61, 0.42, 6.5, 0.05],
      [0.77, 0.32, 4.5, 0.1],
      [0.97, 0.18, 3, 0.17],
      [1.25, 0.02, 1.8, 0.26],
    ],
    count: 9,
  },
  {
    // rises from the bottom centre, pinches near the vanishing point and
    // spreads into a wide fan toward the bottom-right corner
    pts: [
      [0.36, 1.2, 26, 0.06],
      [0.4, 0.86, 15, 0.04],
      [0.44, 0.62, 9.5, 0.016],
      [0.56, 0.62, 7, 0.04],
      [0.72, 0.7, 5, 0.11],
      [0.9, 0.88, 3.2, 0.2],
      [1.15, 1.1, 2, 0.3],
    ],
    count: 10,
  },
];

type Trail = {
  pts: THREE.Vector3[];
  len: number[];
  total: number;
  color: "main" | "deep" | "warm" | "hot";
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
      const color = r < 0.36 ? "main" : r < 0.68 ? "deep" : r < 0.94 ? "warm" : "hot";
      trails.push({
        pts,
        len,
        total: len[len.length - 1],
        color,
        intensity: range(rng, 0.6, 1.15) * (color === "hot" ? 0.8 : 1),
        width: range(rng, 0.035, 0.075),
        phase: rng(),
        k: Math.floor(range(rng, 14, 30)),
        dashes: Math.floor(range(rng, 2, 6)),
      });
    }
  });
  // A few huge soft streaks right next to the lens, following the bundles.
  const near: { a: THREE.Vector3; b: THREE.Vector3; w: number; color: "main" | "deep" | "warm" | "hot"; inten: number; phase: number; k: number }[] = [];
  const nearDefs: [number, number, number, number, number, number, number, "main" | "deep" | "warm" | "hot"][] = [
    // x0, y0, d0, x1, y1, d1, width, colour
    [0.74, 0.36, 4.2, 0.95, 0.16, 2.4, 0.7, "main"],
    [0.78, 0.38, 4.0, 0.94, 0.26, 2.6, 0.5, "hot"],
    [0.66, 0.68, 4.6, 1.05, 0.72, 2.4, 0.8, "deep"],
    [0.74, 0.78, 4.0, 1.05, 0.92, 2.2, 0.6, "warm"],
  ];
  nearDefs.forEach(([x0, y0, d0, x1, y1, d1, w, col]) => {
    near.push({
      a: toWorld(x0, y0, d0),
      b: toWorld(x1, y1, d1),
      w,
      color: col,
      inten: range(rng, 0.35, 0.55),
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
  float body = smoothstep(0.15, 0.98, q) * (1.0 - smoothstep(0.985, 1.0, q));
  float head = exp(-pow((q - 0.975) / 0.012, 2.0)) * 1.6;
  // faint continuous filament so the bundle reads even between dashes
  float fil = 0.1;
  // fade in from far away
  float far = smoothstep(0.0, 0.12, s);
  return (fil + body + head) * far;
}
`;

const NEAR_MOD = /* glsl */ `
uniform float uT;
float lineMod(float u, vec4 p) {
  float q = fract(u * 0.8 - uT * p.y + p.x);
  float pulse = 0.55 + 0.45 * sin(6.28318 * q);
  return pulse * smoothstep(0.0, 0.3, u) * smoothstep(1.0, 0.6, u);
}
`;

export const trailsLook: LookFactory<TrailParams> = ({ params }) => {
  const c = params.colors;
  const cols = {
    main: new THREE.Color(c.main),
    deep: new THREE.Color(c.main).lerp(new THREE.Color("#1E7BFF"), 0.6),
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
    dof: { focus: 9, range: 5, maxBlur: 0.018, nearOnly: true },
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
    feather: 2.6,
    lineMod: NEAR_MOD,
    uniforms: { uT },
  });
  scene.add(near);

  const update = (frame: number) => {
    uT.value = (frame % LOOP) / LOOP;
  };
  return { scene, camera, update };
};
