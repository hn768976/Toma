// Scene layout, camera and animation. Pure functions of (row, direction,
// frame): no clocks, no state carried between frames.
import * as THREE from 'three';
import {BAR_COUNT, HEIGHTS, flagRatio, type Direction, type Row} from '../data/rows';

export const FPS = 30;
export const DURATION = 360;

// ------------------------------------------------------------------ shared look
export const LOOK = {
  fov: 34, // vertical, degrees
  elevationStart: 35, // camera starts high...
  elevationEnd: 15, // ...and ends lower
  azimuthStart: -14, // degrees; negative = camera to the left
  azimuthEnd: 11, // 25° of orbit in total
  pushIn: 0.86, // distance multiplier reached at the last frame
  chartHeightFrac: 0.46, // tallest bar ≈ 40% of frame height (measured at frame 300)
  cardMaxWidthFrac: 0.55, // card never wider than 55% of the frame
  chartYaw: 30, // degrees: the bar row is turned so its right end recedes, as in the references
  // world units
  barSpacing: 1,
  barWidth: 0.78,
  barDepth: 0.78,
  chartHeight: 7,
  cardHeight: 10.2,
  cardZ: -4.2, // back face of the card
  cardX: 1.4, // card centre (world); the camera's move to the right shows it right of the chart
  arrowThickness: 0.62, // ribbon size within the chart plane
  arrowDepth: 0.42, // ribbon size toward the camera
  arrowHeadWidth: 1.6,
  arrowHeadLength: 1.25,
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number, s = 1.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

export const barX = (i: number) => (i - (BAR_COUNT - 1) / 2) * LOOK.barSpacing;
const Y = new THREE.Vector3(0, 1, 0);
/** Chart-local (bar row along x) -> world. */
export const chartToWorld = (v: THREE.Vector3) => v.clone().applyAxisAngle(Y, THREE.MathUtils.degToRad(LOOK.chartYaw));

/** Camera pose at a frame. */
export const cameraPose = (frame: number, target: THREE.Vector3, distance: number) => {
  const t = ease.inOutSine(clamp01(frame / (DURATION - 1)));
  const az = THREE.MathUtils.degToRad(lerp(LOOK.azimuthStart, LOOK.azimuthEnd, t));
  const el = THREE.MathUtils.degToRad(lerp(LOOK.elevationStart, LOOK.elevationEnd, t));
  const d = distance * lerp(1, LOOK.pushIn, t);
  const pos = new THREE.Vector3(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d).add(target);
  return {pos, target};
};

const makeCamera = (aspect: number, frame: number, target: THREE.Vector3, distance: number) => {
  const cam = new THREE.PerspectiveCamera(LOOK.fov, aspect, 0.5, 500);
  const {pos} = cameraPose(frame, target, distance);
  cam.position.copy(pos);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return cam;
};
const screenRect = (cam: THREE.Camera, pts: THREE.Vector3[]) => {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    const q = p.clone().project(cam);
    x0 = Math.min(x0, (q.x + 1) / 2);
    x1 = Math.max(x1, (q.x + 1) / 2);
    y0 = Math.min(y0, (1 - q.y) / 2);
    y1 = Math.max(y1, (1 - q.y) / 2);
  }
  return {x0, x1, y0, y1, w: x1 - x0, h: y1 - y0};
};

export type Layout = {
  heights: number[];
  target: THREE.Vector3;
  distance: number;
  cardW: number;
  cardH: number;
  cardCenter: THREE.Vector3; // centre of the card's front face footprint (x, 0, z)
  arrowPath: THREE.Vector2[]; // in the chart plane (x, y), ribbon body
  arrowZ: number;
  focusNearPoint: THREE.Vector3;
  focusFarPoint: THREE.Vector3;
};

export const computeLayout = (row: Row, dir: Direction, aspect: number): Layout => {
  const heights = HEIGHTS[row.id][dir];
  const H = LOOK.chartHeight;
  const target = new THREE.Vector3(1.6, H * 0.47, -1.6);

  // Distance so the tallest bar spans LOOK.chartHeightFrac of the frame at frame 300.
  let distance = 30;
  for (let i = 0; i < 30; i++) {
    const cam = makeCamera(aspect, 300, target, distance);
    const tallest = heights.indexOf(Math.max(...heights));
    const x = barX(tallest);
    const r = screenRect(cam, [chartToWorld(new THREE.Vector3(x, 0, LOOK.barDepth / 2)), chartToWorld(new THREE.Vector3(x, H * heights[tallest], LOOK.barDepth / 2))]);
    distance *= r.h / LOOK.chartHeightFrac;
  }
  const cam = makeCamera(aspect, 300, target, distance);

  // Card: constant height, width from the flag's ratio, shrunk to stay within 55% of the frame.
  const ratio = flagRatio(row);
  let cardH = LOOK.cardHeight;
  const cardBox = (h: number) => {
    const w = h * ratio;
    const cx = LOOK.cardX + (row.cardOffset?.x ?? 0) * w;
    const y0 = (row.cardOffset?.y ?? 0) * h;
    return [new THREE.Vector3(cx - w / 2, y0, LOOK.cardZ), new THREE.Vector3(cx + w / 2, y0, LOOK.cardZ), new THREE.Vector3(cx - w / 2, y0 + h, LOOK.cardZ), new THREE.Vector3(cx + w / 2, y0 + h, LOOK.cardZ)];
  };
  for (let i = 0; i < 20; i++) {
    const r = screenRect(cam, cardBox(cardH));
    if (r.w <= LOOK.cardMaxWidthFrac) break;
    cardH *= LOOK.cardMaxWidthFrac / r.w;
  }
  const cardW = cardH * ratio;
  const cardCenter = new THREE.Vector3(LOOK.cardX + (row.cardOffset?.x ?? 0) * cardW, (row.cardOffset?.y ?? 0) * cardH, LOOK.cardZ);

  // Arrow: through the bar tops (a little below them), from the first bar to the last.
  const below = 0.45;
  const pts = heights.map((h, i) => new THREE.Vector2(barX(i), Math.max(0.5, H * h - below)));
  pts.unshift(new THREE.Vector2(barX(0) - LOOK.barSpacing * 0.45, pts[0].y + (dir === 'Growth' ? -0.35 : 0.35)));
  const arrowZ = LOOK.barDepth / 2 + 0.08 + LOOK.arrowDepth / 2;

  return {
    heights,
    target,
    distance,
    cardW,
    cardH,
    cardCenter,
    arrowPath: pts,
    arrowZ,
    focusNearPoint: chartToWorld(new THREE.Vector3(barX(0) - 1, 0, arrowZ + 1)),
    focusFarPoint: new THREE.Vector3(cardCenter.x, cardH, LOOK.cardZ - 0.3),
  };
};

/** Sharp zone for the depth of field at this camera position. */
export const focusBand = (layout: Layout, camPos: THREE.Vector3) => ({
  near: camPos.distanceTo(layout.focusNearPoint) - 0.3,
  far: camPos.distanceTo(layout.focusFarPoint) + 0.6,
});

/** Every animated value, from the frame number alone. */
export const animate = (frame: number) => {
  const fade = ease.inOutSine(clamp01(frame / 15));
  // bars: staggered left to right, 10..70, ease-out with a small overshoot
  const bars = Array.from({length: BAR_COUNT}, (_, i) => {
    const start = 10 + (i * 35) / (BAR_COUNT - 1);
    const t = clamp01((frame - start) / 25);
    return t <= 0 ? 0 : ease.outBack(t, 1.1);
  });
  // arrow body draws 30..100, head pops in 98..110
  const draw = ease.inOutCubic(clamp01((frame - 30) / 70));
  const ht = clamp01((frame - 98) / 12);
  const head = ht <= 0 ? 0 : ease.outBack(ht, 2.2);
  // one reflection sweep across the card around frame 200
  const g = clamp01((frame - 178) / 44);
  const glintPos = lerp(-0.4, 1.8, ease.inOutCubic(g));
  const glintStrength = Math.sin(Math.PI * g) * 0.45;
  return {fade, bars, draw, head, glintPos, glintStrength};
};
