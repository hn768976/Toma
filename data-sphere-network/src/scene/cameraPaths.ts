import { type CameraPose, type Key, type V3, spline } from "../engine/math";
import { CORE } from "./world";

export type CameraPath = (t: number) => CameraPose;

const FOV = 50;

/**
 * Version 1 – matches the reference: a straight dolly along the sphere/core
 * axis. Slow approach, punch through the sphere, decelerate into the network,
 * gentle drift with a slight roll, then an accelerating dive into the core.
 */
const V1_Z: Key[] = [
  { t: 0.0, v: [-25] },
  { t: 0.6, v: [-22.5] },
  { t: 1.1, v: [-17] },
  { t: 1.35, v: [-12.5] },
  { t: 1.7, v: [-7] },
  { t: 2.05, v: [-1] },
  { t: 2.45, v: [8] },
  { t: 2.85, v: [17] },
  { t: 3.4, v: [24] },
  { t: 3.8, v: [29] },
  { t: 6.5, v: [112] },
  { t: 9.5, v: [218] },
  { t: 10.5, v: [246] },
  { t: 11.2, v: [280] },
  { t: 11.9, v: [334] },
  { t: 12.4, v: [420] },
  { t: 12.75, v: [496] },
  { t: 12.95, v: [541] },
  { t: 13.4, v: [550] },
];
const V1_DRIFT: Key[] = [
  { t: 0, v: [0, 0, 0] },
  { t: 3.0, v: [0, 0, 0] },
  { t: 3.6, v: [0, 0, 0] },
  { t: 6.5, v: [3.5, 1.6, -0.22] },
  { t: 9.0, v: [2.0, 0.8, -0.34] },
  { t: 10.8, v: [0, 0, -0.04] },
  { t: 13.4, v: [0, 0, 0] },
];

export const cameraV1: CameraPath = (t) => {
  const [z] = spline(V1_Z, t);
  const [dx, dy, roll] = spline(V1_DRIFT, t);
  const pos: V3 = [dx, dy, z];
  return { pos, target: [CORE[0], CORE[1], Math.max(CORE[2], z + 60)], roll, fov: FOV };
};

/**
 * Version 2 – alternative camera: start high and to the side of the sphere and
 * orbit round it while closing in, punch through off-axis, then corkscrew
 * through the network on a helix with a continuous barrel roll, swoop up from
 * below onto the core axis and finish with a spinning dive into the chip.
 */
const helixKeys = (): { pos: Key[]; tgt: Key[] } => {
  const pos: Key[] = [
    { t: 0.0, v: [-23, 10, -12] },
    { t: 0.6, v: [-19.5, 8, -15] },
    { t: 1.2, v: [-12, 4.2, -12.5] },
    { t: 1.65, v: [-4.5, 1.5, -5.5] },
    { t: 2.3, v: [2, -0.5, 3] },
    { t: 3.0, v: [9, -3, 11] },
  ];
  const tgt: Key[] = [
    { t: 0.0, v: [0, 0, 0] },
    { t: 1.2, v: [0, 0, 0] },
    { t: 1.75, v: [0, 0, 8] },
    { t: 2.3, v: [0, 0, 40] },
    { t: 3.0, v: [0, 0, 90] },
  ];
  // corkscrew section, sampled every 0.4 s
  const t0 = 3.4;
  const t1 = 9.8;
  const steps = 16;
  for (let k = 0; k <= steps; k++) {
    const t = t0 + ((t1 - t0) * k) / steps;
    const u = k / steps;
    const phi = -0.3 + u * Math.PI * 1.55;
    const r = 18 - 4 * u;
    const z = 16 + u * 214;
    pos.push({ t, v: [Math.cos(phi) * r, Math.sin(phi) * r, z] });
    tgt.push({ t, v: [0, 0, z + 95] });
  }
  pos.push(
    { t: 10.6, v: [3, -15, 252] },
    { t: 11.3, v: [0.5, -7, 286] },
    { t: 12.0, v: [0, -2, 345] },
    { t: 12.5, v: [0, -0.4, 437] },
    { t: 12.8, v: [0, 0, 503] },
    { t: 12.95, v: [0, 0, 541] },
    { t: 13.4, v: [0, 0, 550] },
  );
  tgt.push({ t: 10.6, v: [0, 2, CORE[2]] }, { t: 11.3, v: [0, 0, CORE[2]] }, { t: 13.4, v: [0, 0, CORE[2]] });
  return { pos, tgt };
};
const V2 = helixKeys();
const V2_ROLL: Key[] = [
  { t: 0, v: [0.32] },
  { t: 1.5, v: [0.12] },
  { t: 3.4, v: [0.0] },
  { t: 9.8, v: [-1.75] },
  { t: 11.3, v: [-2.15] },
  { t: 12.95, v: [-3.1] },
  { t: 13.4, v: [-3.2] },
];

export const cameraV2: CameraPath = (t) => {
  const pos = spline(V2.pos, t) as V3;
  const target = spline(V2.tgt, t) as V3;
  const [roll] = spline(V2_ROLL, t);
  return { pos, target, roll, fov: FOV };
};
