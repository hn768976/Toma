import { Easing, interpolate } from "remotion";

// A camera move is a list of keyframes over the dashboard plane. x/y/z
// are stage units (z is toward the viewer), rotations are degrees.
export type CameraKeyframe = {
  frame: number;
  x?: number;
  y?: number;
  z?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
};

const CHANNEL_DEFAULTS = {
  x: 0,
  y: 0,
  z: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1,
} as const;

type Channel = keyof typeof CHANNEL_DEFAULTS;

// Slow in, slow out. Every camera in these films is a continuous drift -
// nothing starts or stops hard - so a single gentle ease on all channels
// is both correct and keeps the four versions feeling related.
const DRIFT_EASING = Easing.bezier(0.36, 0, 0.24, 1);

const channelAt = (
  keyframes: CameraKeyframe[],
  channel: Channel,
  frame: number,
) => {
  const frames = keyframes.map((k) => k.frame);
  // Carry the previous keyframe's value forward when a keyframe omits a
  // channel, so a move can animate rotation over a span where scale is
  // deliberately held.
  let carried: number = CHANNEL_DEFAULTS[channel];
  const values = keyframes.map((k) => {
    const v = k[channel];
    if (v !== undefined) {
      carried = v;
    }
    return carried;
  });

  return interpolate(frame, frames, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT_EASING,
  });
};

export type CameraState = Record<Channel, number>;

export const cameraAt = (
  keyframes: CameraKeyframe[],
  frame: number,
): CameraState => ({
  x: channelAt(keyframes, "x", frame),
  y: channelAt(keyframes, "y", frame),
  z: channelAt(keyframes, "z", frame),
  rotateX: channelAt(keyframes, "rotateX", frame),
  rotateY: channelAt(keyframes, "rotateY", frame),
  rotateZ: channelAt(keyframes, "rotateZ", frame),
  scale: channelAt(keyframes, "scale", frame),
});

// Stage units are resolution-independent; CSS transforms are not, so the
// translation channels get multiplied by the resolution scale here (and
// only here) on the way into the transform string.
export const cameraTransform = (state: CameraState, resolutionScale: number) =>
  [
    `translate3d(${(state.x * resolutionScale).toFixed(3)}px, ${(state.y * resolutionScale).toFixed(3)}px, ${(state.z * resolutionScale).toFixed(3)}px)`,
    `rotateX(${state.rotateX.toFixed(3)}deg)`,
    `rotateY(${state.rotateY.toFixed(3)}deg)`,
    `rotateZ(${state.rotateZ.toFixed(3)}deg)`,
    `scale(${state.scale.toFixed(4)})`,
  ].join(" ");
