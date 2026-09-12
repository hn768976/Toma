import { DofLayer } from "./constants";

/**
 * A physical-ish camera looking at a monitor from off to one side.
 *
 * The screen is a single DOM plane. `yaw` swings one side of it away
 * from the lens, which produces the convergence the reference shot
 * lives on: clips shrinking and the track rows fanning out toward a
 * vanishing point off-frame. Under CSS perspective, horizontal lines on
 * the plane converge on
 *
 *     (originX + perspective * tan(yaw), originY)
 *
 * so `originY` below the frame is what tips the whole fan downward, and
 * `perspective * tan(yaw)` sets how far off to the side it collapses.
 *
 * The plane is pinned by a single point: UI-space (focusX, focusY) is
 * placed at frame-space (frameX, frameY) and every rotation happens
 * about it, so retiming the layout never slides the framing around.
 *
 * All lengths are 1x frame pixels (1920x1080), multiplied by
 * `resolutionScale` at render time - 4K is a true uniform 2x of this
 * exact projection, not a re-framing.
 */
export type Camera = {
  perspective: number;
  /** Perspective origin, as fractions of frame width / height. */
  originX: number;
  originY: number;
  /** UI-space point held still under the rotations. */
  focusX: number;
  focusY: number;
  /** Where that point sits in frame, as fractions of width / height. */
  frameX: number;
  frameY: number;
  yaw: number; // deg, + pushes the right side of the screen away
  pitch: number; // deg, + pushes the top of the screen away
  roll: number; // deg, in-plane tilt
  /** UI px -> frame px at the focus point. */
  scale: number;
  /** Handheld breathing amplitude, 1x px / deg. */
  driftPx: number;
  driftDeg: number;
};

export const CAMERA_A: Camera = {
  perspective: 1600,
  originX: 0.42,
  // Just below the frame: rows near the bottom of the shot run almost
  // level while rows higher up fan down hard toward the right, which is
  // the geometry that makes the reference read as a real lens rather
  // than a rotated rectangle.
  originY: 0.95,
  focusX: 1050,
  focusY: 380,
  frameX: 0.46,
  frameY: 0.54,
  yaw: 42,
  pitch: 0,
  roll: -1.2,
  scale: 1.06,
  driftPx: 1.6,
  driftDeg: 0.05,
};

// Variant B reverses the lens: the camera sits on the other side of the
// monitor, so the near edge is on the right and the timeline recedes to
// the left. Combined with the re-stacked tracks in script-b this reads
// as a different setup, not a mirrored render.
export const CAMERA_B: Camera = {
  perspective: 1750,
  originX: 0.6,
  // Above the frame, mirroring A: here the rows fan upward to the left,
  // so the same panel reads as a different camera position rather than
  // a flipped render.
  originY: -0.02,
  // B's far side is the left, so its focus sits deep into the edit:
  // everything to the left of it has to be timeline, not empty panel.
  focusX: 3450,
  focusY: 430,
  frameX: 0.55,
  frameY: 0.52,
  yaw: -39,
  pitch: 0,
  roll: 1.6,
  scale: 0.88,
  driftPx: 2.2,
  driftDeg: 0.08,
};

/**
 * Defocus stack. Each entry is a full copy of the stage blurred by
 * `blur` and masked to a band across the frame, ordered near -> far
 * along the receding axis. CSS applies `filter` before `mask`, so a
 * layer is blurred whole and only then cropped to its band; consecutive
 * bands overlap by their fade widths so blur ramps continuously instead
 * of stepping.
 *
 * `from`/`to` are fractions of frame width measured from the NEAR edge,
 * so one stack serves both cameras - variant B just reads it mirrored.
 */
export const DOF_A: DofLayer[] = [
  { blur: 30, from: -0.08, to: 0.14, fadeIn: 0, fadeOut: 0.1 },
  { blur: 12, from: 0.06, to: 0.28, fadeIn: 0.09, fadeOut: 0.09 },
  { blur: 4, from: 0.22, to: 0.4, fadeIn: 0.08, fadeOut: 0.07 },
  { blur: 0, from: 0.34, to: 0.56, fadeIn: 0.07, fadeOut: 0.09 },
  { blur: 6, from: 0.5, to: 0.74, fadeIn: 0.09, fadeOut: 0.1 },
  { blur: 18, from: 0.68, to: 1.08, fadeIn: 0.11, fadeOut: 0 },
];

// Variant B is shot a little wider open: the sharp band is narrower and
// sits further into the frame, so more of the edit falls away.
export const DOF_B: DofLayer[] = [
  { blur: 34, from: -0.08, to: 0.12, fadeIn: 0, fadeOut: 0.09 },
  { blur: 14, from: 0.05, to: 0.26, fadeIn: 0.08, fadeOut: 0.09 },
  { blur: 5, from: 0.2, to: 0.36, fadeIn: 0.08, fadeOut: 0.06 },
  { blur: 0, from: 0.31, to: 0.49, fadeIn: 0.06, fadeOut: 0.08 },
  { blur: 7, from: 0.44, to: 0.68, fadeIn: 0.08, fadeOut: 0.1 },
  { blur: 22, from: 0.62, to: 1.08, fadeIn: 0.12, fadeOut: 0 },
];

const stop = (pct: number, alpha: number) =>
  `rgba(255, 255, 255, ${alpha}) ${(pct * 100).toFixed(2)}%`;

/** Band mask for one defocus layer; `flip` mirrors it for a right-near camera. */
export const dofMask = (layer: DofLayer, flip: boolean) => {
  const stops = [
    stop(layer.from, 0),
    stop(layer.from + layer.fadeIn, 1),
    stop(layer.to - layer.fadeOut, 1),
    stop(layer.to, 0),
  ];
  // 90deg runs left -> right; bands are authored near -> far, so a
  // right-near camera reads the same stops right -> left.
  return `linear-gradient(${flip ? 270 : 90}deg, ${stops.join(", ")})`;
};

/**
 * Transform for the UI plane at a given resolution. Read right to left:
 * shift the focus point to the local origin, scale UI px into frame px
 * (times the resolution multiplier), then rotate about that origin.
 */
export const cameraTransform = (camera: Camera, resolutionScale: number) => {
  const k = camera.scale * resolutionScale;
  return [
    `rotateZ(${camera.roll}deg)`,
    `rotateX(${camera.pitch}deg)`,
    `rotateY(${camera.yaw}deg)`,
    `scale3d(${k}, ${k}, ${k})`,
    `translate(${-camera.focusX}px, ${-camera.focusY}px)`,
  ].join(" ");
};
