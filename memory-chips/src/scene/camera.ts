import { CAMERAS, VIDEO, type Key3, type Variant } from "../config";
import type { CameraPath, CameraState } from "../three/Stage";

const rad = (d: number) => (d * Math.PI) / 180;
/** smooth curve through three values placed at t = 0, 0.5 and 1 (quadratic) */
const mix = (a: Key3, t: number) =>
  a[0] * 2 * (t - 0.5) * (t - 1) - a[1] * 4 * t * (t - 1) + a[2] * 2 * t * (t - 0.5);

/**
 * Camera for a frame: a constant-speed glide along the module. The camera
 * orbits a ground point that travels along the board; everything is a pure
 * function of the (possibly fractional) frame number.
 */
const pathFor = (variant: Variant): CameraPath => {
  const rig = CAMERAS[variant];
  return (frame: number): CameraState => {
    const t = frame / (VIDEO.durationInFrames - 1);
    const gx = mix(rig.lookX, t);
    const gy = mix(rig.lookY, t);
    const el = rad(mix(rig.elevationDeg, t));
    const yaw = rad(mix(rig.yawDeg, t));
    // heading on the ground, rotated left of the module axis by `yaw`
    const hx = -Math.sin(yaw);
    const hy = Math.cos(yaw);
    const back = rig.distance * Math.cos(el);
    const cx = gx - hx * back;
    const cy = gy - hy * back;
    const ch = rig.distance * Math.sin(el);
    // module (x, y, height) -> world (x, height, -y)
    return {
      position: [cx, ch, -cy],
      target: [gx, 0, -gy],
      rollDeg: mix(rig.rollDeg, t),
      fovDeg: rig.fovDeg,
      focusDistance: rig.distance * rig.focusBias,
    };
  };
};

/** Stable (module-level) camera paths, one per version. */
export const CAMERA_PATHS: Record<Variant, CameraPath> = {
  v1: pathFor("v1"),
  v2: pathFor("v2"),
};
