import { Rng, int, range } from "./random";
import { TAU } from "./constants";

/**
 * Builds a waveform as a closed loop of N samples: sample N would equal
 * sample 0. Every component wraps cleanly:
 *  - jitter: per-sample noise, smoothed with a circular kernel
 *  - swells: sines with a whole number of cycles in N
 *  - bursts: packets placed by circular distance, so one straddling the end
 *    continues at the start
 *  - spikes: single tall peaks, also placed by circular distance
 */
export type WaveSpec = {
  n: number;
  jitter: number; // amplitude of base noise
  jitterSmooth?: number; // circular box-blur radius in samples
  jitterEnvelope?: { cycles: number; depth: number }[]; // slow modulation of the noise amplitude
  swells?: { cycles: number; amp: number }[];
  bursts?: { count: number; amp: [number, number]; width: [number, number]; period: [number, number] };
  spikes?: { count: number; amp: [number, number] };
};

export type Burst = { center: number; width: number; amp: number; period: number; phase: number };

export type Wave = { samples: Float32Array; bursts: Burst[] };

export const circDist = (i: number, c: number, n: number) => {
  let d = (i - c) % n;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
};

export const makeLoopWave = (rng: Rng, spec: WaveSpec): Wave => {
  const { n } = spec;
  const out = new Float32Array(n);

  // Base jitter
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = rng() * 2 - 1;
  const r = spec.jitterSmooth ?? 0;
  const env = (spec.jitterEnvelope ?? []).map((e) => ({ ...e, phase: rng() * TAU }));
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += raw[(i + k + n) % n];
    let e = 1;
    for (const m of env) e *= 1 - m.depth * (0.5 + 0.5 * Math.sin((TAU * m.cycles * i) / n + m.phase));
    out[i] = (acc / (2 * r + 1)) * spec.jitter * e * (r > 0 ? Math.sqrt(2 * r + 1) : 1);
  }

  // Swells: integer cycles over N so they close.
  for (const s of spec.swells ?? []) {
    const phase = rng() * TAU;
    for (let i = 0; i < n; i++) out[i] += s.amp * Math.sin((TAU * s.cycles * i) / n + phase);
  }

  // Bursts: fast oscillation under a smooth bell envelope.
  const bursts: Burst[] = [];
  if (spec.bursts) {
    const b = spec.bursts;
    for (let j = 0; j < b.count; j++) {
      bursts.push({
        center: ((j + range(rng, 0.15, 0.85)) / b.count) * n,
        width: range(rng, b.width[0], b.width[1]),
        amp: range(rng, b.amp[0], b.amp[1]),
        period: range(rng, b.period[0], b.period[1]),
        phase: rng() * TAU,
      });
    }
    for (const bu of bursts) {
      const reach = Math.ceil(bu.width * 3);
      for (let k = -reach; k <= reach; k++) {
        const i = ((Math.round(bu.center) + k) % n + n) % n;
        const d = circDist(i, bu.center, n);
        const envl = Math.exp(-((d / bu.width) ** 2));
        out[i] += bu.amp * envl * Math.sin((TAU * d) / bu.period + bu.phase);
      }
    }
  }

  // Spikes: one tall sample with short shoulders.
  if (spec.spikes) {
    for (let j = 0; j < spec.spikes.count; j++) {
      const c = int(rng, 0, n - 1);
      const a = range(rng, spec.spikes.amp[0], spec.spikes.amp[1]) * (rng() < 0.5 ? -1 : 1);
      out[c] += a;
      out[(c + 1) % n] -= a * 0.45;
      out[(c - 1 + n) % n] -= a * 0.3;
    }
  }
  return { samples: out, bursts };
};

/**
 * SVG path for a window of a looping waveform.
 * offset: how many samples have scrolled past (may be fractional).
 * Sample index wraps modulo N, so offset N draws exactly what offset 0 draws.
 */
export const wavePath = (
  samples: Float32Array,
  offset: number,
  opts: { x0: number; x1: number; y: number; scaleY: number; count: number; gain?: (sampleIndex: number) => number },
) => {
  const n = samples.length;
  const o = ((offset % n) + n) % n;
  const base = Math.floor(o);
  const frac = o - base;
  const dx = (opts.x1 - opts.x0) / (opts.count - 1);
  let d = "";
  for (let j = 0; j <= opts.count; j++) {
    const idx = (base + j) % n;
    const g = opts.gain ? opts.gain(idx) : 1;
    const x = opts.x0 + (j - frac) * dx;
    const y = opts.y - samples[idx] * g * opts.scaleY;
    d += (j === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  return d;
};
