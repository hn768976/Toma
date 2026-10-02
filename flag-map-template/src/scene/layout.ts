// Camera, framing and per-frame animation. Everything here is a pure function
// of (shape, frame): no clocks, no state carried between frames.
import * as THREE from 'three';
import type {ShapeData} from '../geo/buildShape';

export const FPS = 30;
export const DURATION = 360;

// ------------------------------------------------------------------ look settings (shared by all 38)
export const LOOK = {
  fov: 24, // vertical, degrees (fairly long lens, as in the reference)
  elevationStart: 42, // camera angle above the floor at frame 0, degrees
  elevationEnd: 64, // ... at the last frame (the drift rises slightly, as in the reference)
  distance: 10, // camera-target distance at the start (world units)
  pushIn: 0.9, // distance multiplier reached at the last frame
  azimuthStart: -14, // degrees; negative = camera to the left of the shape
  azimuthEnd: 5,
  fitWidth: 0.45, // bbox <= 45% of frame width ...
  fitHeight: 0.5, // ... or 50% of frame height, whichever is tighter
  groupCenterY: 0.45, // vertical centre of shape + label (fraction of frame height from top)
  maxShapeCenterY: 0.4, // ...but the shape's own centre never sits lower than this
  labelCapHeight: 0.051, // cap height of the label, fraction of frame height (≈5% with descenders)
  labelGap: 0.022, // gap between shape bbox front and label, fraction of frame height
  depthRatio: 0.04, // extrusion depth, fraction of shape width
};

const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Camera pose at a frame, before the per-shape vertical offset. */
export const cameraPose = (frame: number, targetZ: number) => {
  const t = ease.inOutSine(clamp01(frame / (DURATION - 1)));
  const az = THREE.MathUtils.degToRad(lerp(LOOK.azimuthStart, LOOK.azimuthEnd, t));
  const el = THREE.MathUtils.degToRad(lerp(LOOK.elevationStart, LOOK.elevationEnd, t));
  const d = LOOK.distance * lerp(1, LOOK.pushIn, t);
  const target = new THREE.Vector3(0, 0, targetZ);
  const pos = new THREE.Vector3(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d).add(target);
  return {pos, target};
};

const makeCamera = (aspect: number, frame: number, targetZ: number) => {
  const cam = new THREE.PerspectiveCamera(LOOK.fov, aspect, 0.1, 500);
  const {pos, target} = cameraPose(frame, targetZ);
  cam.position.copy(pos);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

/** Screen rect (fractions of frame, y down) of a set of world points. */
const screenRect = (cam: THREE.Camera, pts: THREE.Vector3[]) => {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    const q = p.clone().project(cam);
    const x = (q.x + 1) / 2;
    const y = (1 - q.y) / 2;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return {x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cy: (y0 + y1) / 2};
};

export type Layout = {
  scale: number; // world units per normalised shape unit
  depth: number; // extrusion depth, normalised units
  targetZ: number;
  labelZ: number; // world z of the label's centre line
  labelHeight: number; // world size of the label's em box (font size)
  labelMaxWidth: number; // world
  focusNear: number;
  focusFar: number;
  shapeRect: ReturnType<typeof screenRect>;
};

/**
 * Fit the shape (bbox ≤ 45% of width or 50% of height) and place the label,
 * measured through the actual camera at frame 300.
 */
export const computeLayout = (shape: ShapeData, aspect: number): Layout => {
  const depth = LOOK.depthRatio * shape.w;
  const frame = 300;
  let scale = 4;
  let targetZ = 0;
  const footprint = (s: number) => {
    const pts: THREE.Vector3[] = [];
    for (const x of [-shape.w / 2, shape.w / 2])
      for (const z of [-shape.h / 2, shape.h / 2]) for (const y of [0, depth]) pts.push(new THREE.Vector3(x * s, y * s, -z * s));
    return pts;
  };
  let rect = screenRect(makeCamera(aspect, frame, targetZ), footprint(scale));
  for (let i = 0; i < 12; i++) {
    const cam = makeCamera(aspect, frame, targetZ);
    rect = screenRect(cam, footprint(scale));
    scale *= Math.min(LOOK.fitWidth / rect.w, LOOK.fitHeight / rect.h);
    // Centre shape + label vertically by sliding the target along z. The label
    // block below the shape is gap + cap height + descender room.
    const labelBlock = LOOK.labelGap + LOOK.labelCapHeight * 1.3;
    const groupCy = (r: ReturnType<typeof screenRect>) => Math.min((r.y0 + r.y1 + labelBlock) / 2 - LOOK.groupCenterY, r.cy - LOOK.maxShapeCenterY);
    const r2 = screenRect(makeCamera(aspect, frame, targetZ), footprint(scale));
    const r3 = screenRect(makeCamera(aspect, frame, targetZ + 0.01), footprint(scale));
    const slope = (groupCy(r3) - groupCy(r2)) / 0.01;
    targetZ -= groupCy(r2) / slope;
  }
  const cam = makeCamera(aspect, frame, targetZ);
  rect = screenRect(cam, footprint(scale));

  // Label: font size such that the cap height is LOOK.labelCapHeight of the
  // frame, its top edge LOOK.labelGap below the shape's bbox front edge.
  const frontZ = (shape.h / 2) * scale;
  const yAt = (z: number) => screenRect(cam, [new THREE.Vector3(0, 0, z)]).y0;
  const zForY = (y: number) => {
    let lo = frontZ;
    let hi = cam.position.z - 0.5; // stay in front of the camera
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (yAt(mid) < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const capTopZ = zForY(rect.y1 + LOOK.labelGap);
  const capBottomZ = zForY(rect.y1 + LOOK.labelGap + LOOK.labelCapHeight);
  const capWorld = capBottomZ - capTopZ;
  const labelHeight = capWorld / 0.727; // Inter cap height = 0.727 em
  const labelZ = (capTopZ + capBottomZ) / 2;

  const camDist = (p: THREE.Vector3) => cam.position.distanceTo(p);
  const focusNear = camDist(new THREE.Vector3(0, 0, capBottomZ + labelHeight * 0.3)) - 0.3;
  const focusFar = camDist(new THREE.Vector3(0, 0, -(shape.h / 2) * scale)) + 0.15;
  return {
    scale,
    depth,
    targetZ,
    labelZ,
    labelHeight,
    labelMaxWidth: Math.max(shape.w * scale, 0.3 * 2 * LOOK.distance * Math.tan(THREE.MathUtils.degToRad(LOOK.fov / 2)) * aspect),
    focusNear,
    focusFar,
    shapeRect: rect,
  };
};

/** Every animated value, from the frame number alone. */
export const animate = (frame: number) => {
  const fade = ease.inOutSine(clamp01(frame / 20));
  const rise = Math.max(0.002, ease.outCubic(clamp01((frame - 10) / 40)));
  const label = ease.outCubic(clamp01((frame - 30) / 30));
  // glint: one sweep, centred on frame 150
  const g = clamp01((frame - 126) / 48);
  const glintPos = lerp(-0.35, 1.75, ease.inOutCubic(g));
  const glintStrength = Math.sin(Math.PI * g) * 0.55;
  const flare = (0.15 + 0.85 * fade) * (1 + 0.07 * Math.sin((2 * Math.PI * frame) / 80));
  return {fade, rise, label, glintPos, glintStrength, flare};
};
