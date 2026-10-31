import * as THREE from "three";
import { TimedSpline, lerp, smoothstep } from "../engine/spline";

export type CrashCameraState = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  roll: number;
  fov: number;
  focus: number;
  /** defocus strength (px at 1080 for objects at infinity) */
  aperture: number;
};

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Key = { t: number; pos: THREE.Vector3; target: THREE.Vector3; roll: number; fov: number };

/**
 * Camera choreography matched to the reference (13.33 s):
 *  0.0–2.6  wide, slow push-in on the glowing chart field, flares, spark burst
 *  2.6–5.3  drift right and closer, LED dot chart sweeps past in foreground
 *  5.3–8.0  banked perspective view down the receding chart / candle rows
 *  8.0–10.7 descend along the falling line towards the ticker boards
 * 10.7–12.4 push into an extreme close-up of the ticker board
 * 12.4–13.3 gentle pull-back while focus racks to the foreground, so the
 *            boards and flares dissolve into orange bokeh (as in the reference)
 */
const KEYS: Key[] = [
  { t: 0.0, pos: v3(-2, 3, 62), target: v3(-2, 1, 0), roll: 0, fov: 45 },
  { t: 2.7, pos: v3(-6, 4, 38), target: v3(-1, 0, 0), roll: 0.02, fov: 45 },
  { t: 4.4, pos: v3(1, 6, 26), target: v3(9, -3, 0), roll: -0.06, fov: 46 },
  { t: 6.0, pos: v3(-5, 10, 24), target: v3(7, -3, 0), roll: -0.2, fov: 48 },
  { t: 7.8, pos: v3(6, 4, 22), target: v3(17, -9, 0), roll: -0.1, fov: 47 },
  { t: 9.3, pos: v3(17, -2, 24), target: v3(23, -15, -3), roll: 0.05, fov: 46 },
  { t: 10.8, pos: v3(27, -9, 19), target: v3(26, -21, -2), roll: 0.08, fov: 45 },
  { t: 12.4, pos: v3(21, -20, 6.5), target: v3(21, -22.3, -2), roll: 0.03, fov: 42 },
  { t: 13.34, pos: v3(18, -15, 16), target: v3(16, -17, -2), roll: -0.03, fov: 44 },
];

const rack = (t: number) => smoothstep(12.5, 13.2, t);

export const computeCrashCamera = (fps: number, frames: number) => {
  const pos = new TimedSpline(KEYS.map((k) => ({ t: k.t, v: k.pos })));
  const tgt = new TimedSpline(KEYS.map((k) => ({ t: k.t, v: k.target })));
  const misc = new TimedSpline(KEYS.map((k) => ({ t: k.t, v: v3(k.roll, k.fov, 0) })));
  const out: CrashCameraState[] = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const p = pos.at(t);
    // subtle hand-held float
    p.add(v3(Math.sin(t * 1.1) * 0.08, Math.sin(t * 1.5 + 2) * 0.08, 0));
    const target = tgt.at(t);
    const m = misc.at(t);
    out.push({
      pos: p,
      target,
      roll: m.x,
      fov: m.y,
      // focus on the look-at point, then rack to the foreground at the end
      focus: lerp(Math.max(4, p.distanceTo(target)), 1.5, rack(t)),
      aperture: lerp(9, 30, rack(t)),
    });
  }
  return out;
};
