import { createNoise3D } from "../gl/simplex";
import { mulberry32 } from "../gl/random";

// Strand classes, read by the particle shader.
export const CLASS_BLUE = 0;
export const CLASS_VIOLET = 1;
export const CLASS_MAGENTA = 2;
export const CLASS_FILL = 3;

const STRANDS = 1000;
const FILL_PARTICLES = 260_000;
const BEAD_SPACING = 0.011;
// Strength of the swirling component relative to the pull toward the poles.
const CURL_WEIGHT = 0.55;

export type OrbGeometry = {
  positions: Float32Array;
  info: Float32Array; // class, strand brightness, arc length, core-thread flag
  rands: Float32Array;
  count: number;
};

// Builds beaded energy strands by tracing streamlines of a divergence-free
// tangential flow on concentric shells (contours of a stretched noise
// potential), plus a dim speckle of particles filling the volume.
export const buildOrbGeometry = (seed: number): OrbGeometry => {
  const rand = mulberry32(seed);
  const noise = createNoise3D(seed ^ 0x5bd1e995);
  const potential = (x: number, y: number, z: number) =>
    noise(x * 1.1, y * 0.9, z * 1.1) + 0.3 * noise(x * 2.2 + 7.1, y * 1.8, z * 2.2 - 3.7);

  const pos: number[] = [];
  const info: number[] = [];
  const rnd: number[] = [];

  const push = (x: number, y: number, z: number, cls: number, bright: number, s: number, core: number, r4: number[]) => {
    pos.push(x, y, z);
    info.push(cls, bright, s, core);
    rnd.push(r4[0], r4[1], r4[2], r4[3]);
  };

  const eps = 1e-3;
  for (let k = 0; k < STRANDS; k++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const sxy = Math.sqrt(1 - u * u);
    const radius = rand() < 0.58 ? 0.95 + rand() * 0.045 : 0.45 + rand() * 0.47;
    let px = sxy * Math.cos(th) * radius;
    let py = u * radius;
    let pz = sxy * Math.sin(th) * radius;

    const roll = rand();
    const cls = roll < 0.42 ? CLASS_BLUE : roll < 0.67 ? CLASS_VIOLET : CLASS_MAGENTA;
    const bright = 0.35 + Math.pow(rand(), 2.2) * 0.95;
    const length = 0.9 + rand() * 2.4;
    const steps = Math.floor(length / BEAD_SPACING);
    const threads = cls === CLASS_MAGENTA ? 3 : 5;
    const width = 0.008 + rand() * 0.012;
    const strandRand = [rand(), rand(), rand(), rand()];

    // Start half-way back along the streamline so the seed sits mid-strand.
    let dir = -1;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < steps; i++) {
        const isTrace = pass === 0;
        const nx = px / radius, ny = py / radius, nz = pz / radius;
        const gx = (potential(px + eps, py, pz) - potential(px - eps, py, pz)) / (2 * eps);
        const gy = (potential(px, py + eps, pz) - potential(px, py - eps, pz)) / (2 * eps);
        const gz = (potential(px, py, pz + eps) - potential(px, py, pz - eps)) / (2 * eps);
        // Velocity = n × ∇Φ is tangent to the shell and follows Φ's contours,
        // plus a pull toward the poles, so strands stream like plasma-lamp
        // filaments that gather at the top of the orb.
        let cx = ny * gz - nz * gy;
        let cy = nz * gx - nx * gz;
        let cz = nx * gy - ny * gx;
        const cl = Math.hypot(cx, cy, cz) || 1;
        cx /= cl; cy /= cl; cz /= cl;
        let vx = cx * CURL_WEIGHT - ny * nx;
        let vy = cy * CURL_WEIGHT + (1 - ny * ny);
        let vz = cz * CURL_WEIGHT - ny * nz;
        const vl = Math.hypot(vx, vy, vz) || 1;
        vx /= vl; vy /= vl; vz /= vl;
        if (!isTrace) {
          const bx = ny * vz - nz * vy;
          const by = nz * vx - nx * vz;
          const bz = nx * vy - ny * vx;
          const sAlong = i * BEAD_SPACING;
          for (let t = 0; t < threads; t++) {
            const off = (t - (threads - 1) / 2) * width + (rand() - 0.5) * 0.004;
            const lift = (rand() - 0.5) * 0.006;
            push(
              px + bx * off + nx * lift,
              py + by * off + ny * lift,
              pz + bz * off + nz * lift,
              cls,
              bright,
              sAlong,
              t === (threads - 1) >> 1 ? 1 : 0,
              strandRand,
            );
          }
        }
        px += vx * BEAD_SPACING * dir;
        py += vy * BEAD_SPACING * dir;
        pz += vz * BEAD_SPACING * dir;
        const l = Math.hypot(px, py, pz) / radius;
        px /= l; py /= l; pz /= l;
        if (isTrace && i >= steps / 2) break;
      }
      dir = 1;
    }
  }

  for (let i = 0; i < FILL_PARTICLES; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const sxy = Math.sqrt(1 - u * u);
    const radius = rand() < 0.55 ? 0.94 + rand() * 0.06 : 0.3 + 0.64 * Math.cbrt(rand());
    push(
      sxy * Math.cos(th) * radius,
      u * radius,
      sxy * Math.sin(th) * radius,
      CLASS_FILL,
      0.4 + rand() * 0.6,
      rand() * 10,
      0,
      [rand(), rand(), rand(), rand()],
    );
  }

  return {
    positions: new Float32Array(pos),
    info: new Float32Array(info),
    rands: new Float32Array(rnd),
    count: pos.length / 3,
  };
};
