import { createNoise, mulberry32, Noise } from "./noise";

// Deterministic particle-smoke simulation, modelled on a vortex-ring burst:
// material is thrown out from a source as an expanding shell (a cap facing
// +x) that stops expanding and then drifts forward, while turbulence curls it
// into wisps. Particles are grouped into "strands": each strand is a short
// curved arc of directions on the shell, launched at one moment, so drawing a
// line between neighbouring particles of a strand gives fibres that lie
// along the surface of the cloud rather than radiating from the source.

type Falloff = { base: number; extra: number; decay: number };
const falloff = (f: Falloff, te: number) => f.base + f.extra * Math.exp(-te / f.decay);

export type SimOptions = {
  seed: number;
  strands: number;
  particlesPerStrand: number;
  // Angular step between neighbouring particles of a strand (radians).
  arcStep: number;
  // Emission window, seconds.
  emitStart: number;
  emitEnd: number;
  source: [number, number, number];
  // All of these are functions of the emission time te:
  // final shell radius, top forward drift speed, and the band of the shell
  // (inner / outer angle in degrees from +x) the material covers. Early
  // material fills a lampshade-like band, which reads as a crescent from the
  // side; later material fills the whole sphere.
  shellRadius: Falloff;
  forwardSpeed: Falloff;
  coneInner: Falloff;
  coneAngle: Falloff;
  // Shell expansion decay rate (1/s) and forward-drift ramp time (s).
  expansionDrag: number;
  forwardRamp: number;
  turbulence: number;
  turbulenceScale: number;
};

export type SimState = {
  frame: number;
  t: number;
  pos: Float32Array;
  vel: Float32Array;
  born: Uint8Array;
};

export type Sim = {
  opts: SimOptions;
  count: number;
  emitTime: Float32Array;
  launch: Float32Array; // initial expansion velocity, xyz
  forward: Float32Array; // top forward drift speed per particle
  strandHue: Float32Array; // per particle, -1..1 colour offset of its strand
  noise: Noise;
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// An impulsive opening burst (which becomes the hollow leading cap),
// followed by a steady flow that fills the body of the cloud from behind.
const emissionWeight = (te: number) =>
  3.2 * Math.exp(-(((te - 0.22) / 0.2) ** 2)) + 1.15 * smoothstep(0.45, 1.4, te);

export const createSim = (opts: SimOptions): Sim => {
  const rand = mulberry32(opts.seed);
  const noise = createNoise(opts.seed + 101);
  const { strands, particlesPerStrand: per } = opts;
  const count = strands * per;

  // Tabulated inverse CDF of the emission weight.
  const steps = 2048;
  const cdf = new Float64Array(steps + 1);
  for (let i = 1; i <= steps; i++) {
    const te = opts.emitStart + ((opts.emitEnd - opts.emitStart) * (i - 0.5)) / steps;
    cdf[i] = cdf[i - 1] + emissionWeight(te);
  }
  const total = cdf[steps];
  const invCdf = (u: number) => {
    const target = u * total;
    let lo = 0;
    let hi = steps;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid;
      else hi = mid;
    }
    const f = (target - cdf[lo]) / Math.max(1e-9, cdf[hi] - cdf[lo]);
    return opts.emitStart + ((opts.emitEnd - opts.emitStart) * (lo + f)) / steps;
  };

  const emitTime = new Float32Array(count);
  const launch = new Float32Array(count * 3);
  const forward = new Float32Array(count);
  const strandHue = new Float32Array(count);
  for (let s = 0; s < strands; s++) {
    // Stratified emission times so the flow has no gaps or pulses.
    const te = invCdf(Math.min(0.99999, (s + rand()) / strands));
    const maxTheta = (Math.min(180, falloff(opts.coneAngle, te)) * Math.PI) / 180;
    const minTheta = (Math.max(0, falloff(opts.coneInner, te)) * Math.PI) / 180;
    const radius = falloff(opts.shellRadius, te) * (0.8 + 0.22 * rand());
    const fwd = falloff(opts.forwardSpeed, te) * (0.94 + rand() * 0.12);
    const hue = rand() * 2 - 1;
    // Start direction: uniform on the spherical band between the angles.
    const c0 = Math.cos(minTheta);
    const c1 = Math.cos(maxTheta);
    let cosT = c0 - rand() * (c0 - c1);
    let theta = Math.acos(cosT);
    let phi = rand() * Math.PI * 2;
    // Heading of the arc on the sphere, turning smoothly as it goes.
    let heading = rand() * Math.PI * 2;
    const turn = (rand() - 0.5) * 0.12;
    for (let k = 0; k < per; k++) {
      const i = s * per + k;
      emitTime[i] = te + k * 0.0015;
      const sinT = Math.sin(theta);
      cosT = Math.cos(theta);
      // Radius varies smoothly along the strand so fibres stay continuous.
      const r = radius * (1 + 0.06 * Math.sin(k * 0.21 + hue * 9));
      const v = r * opts.expansionDrag;
      launch[i * 3] = v * cosT;
      launch[i * 3 + 1] = v * sinT * Math.cos(phi);
      launch[i * 3 + 2] = v * sinT * Math.sin(phi);
      forward[i] = fwd;
      strandHue[i] = hue;
      // Walk along the sphere surface.
      heading += turn + (rand() - 0.5) * 0.08;
      theta += Math.cos(heading) * opts.arcStep;
      if (theta < Math.max(0.02, minTheta)) {
        theta = Math.max(0.02, minTheta);
        heading = Math.PI - heading;
      }
      if (theta > maxTheta) {
        theta = maxTheta;
        heading = Math.PI - heading;
      }
      phi += (Math.sin(heading) * opts.arcStep) / Math.max(0.15, Math.sin(theta));
    }
  }
  return { opts, count, emitTime, launch, forward, strandHue, noise };
};

export const initialState = (sim: Sim): SimState => ({
  frame: 0,
  t: 0,
  pos: new Float32Array(sim.count * 3),
  vel: new Float32Array(sim.count * 3),
  born: new Uint8Array(sim.count),
});

export const cloneState = (s: SimState): SimState => ({
  frame: s.frame,
  t: s.t,
  pos: s.pos.slice(),
  vel: s.vel.slice(),
  born: s.born.slice(),
});

// Advances the state by one step of dt seconds.
export const step = (sim: Sim, state: SimState, dt: number) => {
  const { opts, noise, emitTime, launch, forward, count } = sim;
  const { pos, vel, born } = state;
  const t0 = state.t;
  const t1 = t0 + dt;
  const fe = Math.exp(-opts.expansionDrag * dt);
  const tau = opts.forwardRamp;
  const k = opts.turbulenceScale;
  const tt = t1 * 0.22;
  const n3 = noise.noise3;
  const [sx, sy, sz] = opts.source;
  for (let i = 0; i < count; i++) {
    const te = emitTime[i];
    if (te > t1) continue;
    const o = i * 3;
    let h = dt;
    if (!born[i]) {
      born[i] = 1;
      pos[o] = sx;
      pos[o + 1] = sy;
      pos[o + 2] = sz;
      vel[o] = launch[o];
      vel[o + 1] = launch[o + 1];
      vel[o + 2] = launch[o + 2];
      h = t1 - Math.max(te, t0);
    }
    const age = t1 - te;
    vel[o] *= fe;
    vel[o + 1] *= fe;
    vel[o + 2] *= fe;
    const vf = forward[i] * (1 - Math.exp(-age / tau));
    const x = pos[o];
    const y = pos[o + 1];
    const z = pos[o + 2];
    // Turbulence ramps in with age so the launch shape reads first.
    const amp = opts.turbulence * Math.min(1, age / 0.8);
    const qx = x * k;
    const qy = y * k;
    const qz = z * k;
    const tx = n3(qx + tt, qy, qz) + 0.3 * n3(qx * 2.3 + 5.1, qy * 2.3 + tt, qz * 2.3);
    const ty = n3(qx + 19.3, qy - tt, qz + 4.7) + 0.3 * n3(qx * 2.3, qy * 2.3 + 9.4, qz * 2.3 - tt);
    const tz = n3(qx - 7.9, qy + 13.1, qz + tt) + 0.3 * n3(qx * 2.3 + tt, qy * 2.3, qz * 2.3 + 2.2);
    pos[o] = x + (vel[o] + vf + amp * tx) * h;
    pos[o + 1] = y + (vel[o + 1] + amp * ty) * h;
    pos[o + 2] = z + (vel[o + 2] + amp * tz) * h;
  }
  state.t = t1;
};

// Per-tab cache: simulation is advanced incrementally as Remotion asks for
// increasing frames, with periodic snapshots so seeking backwards only
// re-simulates from the closest earlier snapshot. Results are identical
// regardless of the order frames are requested in.
const SNAPSHOT_EVERY = 15;

export class SimRunner {
  private state: SimState;
  private snapshots = new Map<number, SimState>();
  constructor(
    public sim: Sim,
    private fps: number,
  ) {
    this.state = initialState(sim);
    this.snapshots.set(0, cloneState(this.state));
  }

  at(frame: number): SimState {
    if (frame < this.state.frame) {
      let best = 0;
      for (const f of this.snapshots.keys()) if (f <= frame && f > best) best = f;
      this.state = cloneState(this.snapshots.get(best)!);
    }
    while (this.state.frame < frame) {
      step(this.sim, this.state, 1 / this.fps);
      this.state.frame++;
      if (this.state.frame % SNAPSHOT_EVERY === 0 && !this.snapshots.has(this.state.frame)) {
        this.snapshots.set(this.state.frame, cloneState(this.state));
      }
    }
    return this.state;
  }
}
