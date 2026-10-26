import { createNoise, mulberry32, Noise } from "./noise";

// Camera / scene constants shared by the field generator and the renderer.
// World space is camera space at t=0: camera at the origin looking down +z,
// +y up, +x right.
export const TAN_HALF_FOV_Y = Math.tan((20 * Math.PI) / 180);
export const ASPECT = 16 / 9;
export const Z_NEAR = 4.6;
export const Z_FAR = 13.0;
export const PARTICLE_RADIUS = 0.042;
// Grid spacing ~ particle diameter so the spheres pack densely.
const GRID = 0.074;
const SHELL = GRID * 2.4;
const SPRAY_DIST = 0.34;

export type FieldOptions = {
  seed: number;
  // Lower = larger blobs.
  frequency: number;
  // Half-thickness of the curved sheets, in noise units.
  sheetWidth: number;
  // Mask threshold that breaks the sheets into separate patches; higher =
  // fewer, smaller patches.
  maskThreshold: number;
};

export type Field = {
  count: number;
  base: Float32Array; // xyz per particle
  flow: Float32Array; // xyz current per particle, -1..1
  radius: Float32Array;
  tone: Float32Array; // 0..1 palette position (dark -> light)
  light: Float32Array; // baked blob-scale lighting multiplier
  spray: Float32Array; // 0 = part of a blob, >0 = loose particle trailing off an edge
  noise: Noise;
};

// Signed density, positive inside. The shapes are thick, curved sheets
// around the zero-set of one noise field, cut into separate folded patches
// (crescents, ribbons, kidney shapes) by a second, lower-frequency mask.
const density = (
  n: Noise,
  x: number,
  y: number,
  z: number,
  sheetWidth: number,
  maskThreshold: number,
) => {
  const sheet =
    sheetWidth -
    Math.abs(n.noise3(x, y, z) + 0.25 * n.noise3(x * 2.1 + 11.3, y * 2.1 - 7.1, z * 2.1 + 3.7));
  const mask = n.noise3(x * 0.55 + 71.1, y * 0.55 - 23.4, z * 0.55 + 9.9) - maskThreshold;
  return Math.min(sheet, mask * 0.6);
};

// Builds a static field of particles that sit on (and just inside) the
// surface of noise-defined blobs, plus loose "spray" particles just outside
// that surface. Animation is applied later by warping these base positions.
export const generateField = (
  { seed, frequency, sheetWidth, maskThreshold }: FieldOptions,
  // Total distance the field drifts over the clip; the generated volume is
  // extended so the frame stays filled for the whole duration.
  sweep: [number, number, number],
): Field => {
  const noise = createNoise(seed);
  const rand = mulberry32(seed * 7 + 1);
  const lateral = 1.18;
  const hx = Z_FAR * TAN_HALF_FOV_Y * ASPECT * lateral;
  const hy = Z_FAR * TAN_HALF_FOV_Y * lateral;
  // Base-space bounding box: the frustum box, unioned with itself shifted
  // back along the sweep.
  const x0 = Math.min(-hx, -hx - sweep[0]);
  const x1 = Math.max(hx, hx - sweep[0]);
  const y0 = Math.min(-hy, -hy - sweep[1]);
  const y1 = Math.max(hy, hy - sweep[1]);
  const z0 = Math.min(Z_NEAR, Z_NEAR - sweep[2]);
  const z1 = Math.max(Z_FAR, Z_FAR - sweep[2]);
  const nx = Math.ceil((x1 - x0) / GRID);
  const ny = Math.ceil((y1 - y0) / GRID);
  const nz = Math.ceil((z1 - z0) / GRID);
  const values = new Float32Array(nx * ny * nz).fill(-10);
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  // Is base point p inside the (padded) view volume at some point in time?
  const visibleEver = (x: number, y: number, z: number) => {
    for (let s = 0; s <= 1.0001; s += 0.125) {
      const vz = z + sweep[2] * s;
      if (vz < Z_NEAR - 2 * GRID || vz > Z_FAR) continue;
      const vx = x + sweep[0] * s;
      const vy = y + sweep[1] * s;
      const fx = vz * TAN_HALF_FOV_Y * ASPECT * lateral + 0.6;
      const fy = vz * TAN_HALF_FOV_Y * lateral + 0.6;
      if (Math.abs(vx) <= fx && Math.abs(vy) <= fy) return true;
    }
    return false;
  };

  for (let k = 0; k < nz; k++) {
    const z = z0 + k * GRID;
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * GRID;
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * GRID;
        if (!visibleEver(x, y, z)) continue;
        values[idx(i, j, k)] = density(
          noise,
          x * frequency,
          y * frequency,
          z * frequency,
          sheetWidth,
          maskThreshold,
        );
      }
    }
  }

  const base: number[] = [];
  const flow: number[] = [];
  const radius: number[] = [];
  const tone: number[] = [];
  const light: number[] = [];
  const spray: number[] = [];
  // Direction towards the key light (top-left, in front of the subject).
  const lx = -0.42;
  const ly = 0.72;
  const lz = -0.55;
  const ll = Math.hypot(lx, ly, lz);

  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const v = values[idx(i, j, k)];
        if (v < -5) continue;
        const gx = values[idx(i + 1, j, k)] - values[idx(i - 1, j, k)];
        const gy = values[idx(i, j + 1, k)] - values[idx(i, j - 1, k)];
        const gz = values[idx(i, j, k + 1)] - values[idx(i, j, k - 1)];
        if (
          values[idx(i + 1, j, k)] < -5 ||
          values[idx(i - 1, j, k)] < -5 ||
          values[idx(i, j + 1, k)] < -5 ||
          values[idx(i, j - 1, k)] < -5 ||
          values[idx(i, j, k + 1)] < -5 ||
          values[idx(i, j, k - 1)] < -5
        )
          continue;
        const g = Math.hypot(gx, gy, gz) / (2 * GRID);
        if (g < 1e-5) continue;
        // Signed distance to the iso-surface, positive inside the blob.
        const d = v / g;
        let sprayAmount = 0;
        if (d >= 0) {
          if (d > SHELL) continue;
        } else {
          if (d < -SPRAY_DIST) continue;
          const f = 1 + d / SPRAY_DIST;
          if (rand() > 0.07 * f * f) continue;
          sprayAmount = -d / SPRAY_DIST;
        }
        const jitter = GRID * 0.42;
        const x = x0 + i * GRID + (rand() * 2 - 1) * jitter;
        const y = y0 + j * GRID + (rand() * 2 - 1) * jitter;
        const z = z0 + k * GRID + (rand() * 2 - 1) * jitter;
        base.push(x, y, z);
        // Slow, spatially varying current: neighbouring particles share it,
        // so whole blobs glide, shear and fold relative to each other.
        flow.push(
          noise.noise3(x * 0.13 + 3.3, y * 0.13, z * 0.13),
          noise.noise3(x * 0.13, y * 0.13 + 8.1, z * 0.13),
          noise.noise3(x * 0.13, y * 0.13, z * 0.13 - 5.6),
        );
        radius.push(PARTICLE_RADIUS * (0.82 + rand() * 0.3) * (1 - 0.25 * sprayAmount));
        // Outward normal points down the density gradient.
        const inv = 1 / (g * 2 * GRID);
        const onx = -gx * inv;
        const ony = -gy * inv;
        const onz = -gz * inv;
        const lambert = (onx * lx + ony * ly + onz * lz) / ll;
        const depthAO = d > 0 ? 1 - 0.3 * (d / SHELL) : 1;
        light.push((0.8 + 0.34 * lambert) * depthAO);
        const regionTone = noise.noise3(x * 0.11 + 40.5, y * 0.11 - 12.25, z * 0.11 + 7.5);
        tone.push(Math.min(1, Math.max(0, 0.52 + regionTone * 0.7 + (rand() - 0.5) * 0.1)));
        spray.push(sprayAmount);
      }
    }
  }

  return {
    count: radius.length,
    base: new Float32Array(base),
    flow: new Float32Array(flow),
    radius: new Float32Array(radius),
    tone: new Float32Array(tone),
    light: new Float32Array(light),
    spray: new Float32Array(spray),
    noise,
  };
};

export type MotionOptions = {
  warpAmplitude: number;
  warpSpeed: number;
  // Speed (units/s) of the spatially varying current.
  flowSpeed: number;
  drift: [number, number, number];
  // Camera yaw / pitch (radians) as a function of normalized time 0..1.
  yawStart: number;
  yawEnd: number;
  pitchStart: number;
  pitchEnd: number;
  dollyStart: number;
  dollyEnd: number;
};

const PIVOT_Z = 8.5;

// Writes camera-space positions for time t (seconds) into out (xyz per
// particle). Each particle keeps its identity across frames: positions are a
// smooth, time-varying domain warp of the static base field, so blobs flow,
// stretch and fold without particles popping in or out.
export const positionsAt = (
  field: Field,
  t: number,
  progress: number,
  motion: MotionOptions,
  out: Float32Array,
) => {
  const { noise, base, flow, spray, count } = field;
  const fs = motion.flowSpeed * t;
  const n4 = noise.noise4;
  const a1 = motion.warpAmplitude;
  const a2 = motion.warpAmplitude * 0.3;
  const w1 = t * motion.warpSpeed;
  const w2 = t * motion.warpSpeed * 1.7 + 19.1;
  const e = progress * progress * (3 - 2 * progress);
  const yaw = motion.yawStart + (motion.yawEnd - motion.yawStart) * e;
  const pitch = motion.pitchStart + (motion.pitchEnd - motion.pitchStart) * e;
  const dolly = motion.dollyStart + (motion.dollyEnd - motion.dollyStart) * e;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const dx = motion.drift[0] * t;
  const dy = motion.drift[1] * t;
  const dz = motion.drift[2] * t;
  for (let i = 0; i < count; i++) {
    const bx = base[i * 3];
    const by = base[i * 3 + 1];
    const bz = base[i * 3 + 2];
    const s = spray[i];
    const qx = bx * 0.26;
    const qy = by * 0.26;
    const qz = bz * 0.26;
    const amp = a1 * (1 + 1.8 * s);
    let x = bx + amp * n4(qx, qy, qz, w1) + a2 * n4(bx * 0.7, by * 0.7, bz * 0.7, w2);
    let y = by + amp * n4(qx + 31.4, qy, qz, w1) + a2 * n4(bx * 0.7 + 13.7, by * 0.7, bz * 0.7, w2);
    let z = bz + amp * n4(qx, qy + 17.7, qz, w1) + a2 * n4(bx * 0.7, by * 0.7 + 5.3, bz * 0.7, w2);
    x += dx + flow[i * 3] * fs;
    y += dy + flow[i * 3 + 1] * fs;
    z += dz + flow[i * 3 + 2] * fs - PIVOT_Z;
    // Orbit the camera around a pivot in the middle of the volume.
    const rx = cy * x + sy * z;
    let rz = -sy * x + cy * z;
    const ry = cp * y - sp * rz;
    rz = sp * y + cp * rz;
    out[i * 3] = rx;
    out[i * 3 + 1] = ry;
    out[i * 3 + 2] = rz + PIVOT_Z - dolly;
  }
};
