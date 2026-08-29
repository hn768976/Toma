import { rnd, rndInt, rndRange, rndSigned } from "./rand";

/**
 * The three centre signals. Each is generated ONCE, seeded, as exactly one
 * period sampled over `width` pixels — so tiling it and translating by
 * (frame / DURATION) * width * cycles closes the loop perfectly and nothing
 * boils between frames. Per-frame degradation is applied as a transform of
 * this fixed data; no random value is ever re-rolled while scrolling.
 */

/**
 * One period per panel, in pixels — and each panel translates by exactly one
 * of these across the 600 frames. Panel 2's period is three times panel 1's,
 * so it scrolls three times as fast while still showing its whole signal
 * once and only once per loop. Speed differentiation and a closed loop come
 * from the same number.
 */
export const SIGNAL_WIDTHS: readonly number[] = [3600, 10800, 7200];

const TAU = Math.PI * 2;

/** Panel 1 — smooth, large-amplitude, rounded. Sum of four sine components. */
export type SmoothSignal = { kind: "smooth"; y: Float32Array };

/** Panel 2 — dense high-frequency noise drawn as a fuzzy band of hairs. */
export type NoiseSignal = {
  kind: "noise";
  /** Half-height of the band at each sample, 0..1. */
  band: Float32Array;
  /** Vertical offset of each hair inside the band, -1..1. */
  jitter: Float32Array;
  /** Per-hair brightness, 0..1. */
  weight: Float32Array;
};

/** Panel 3 — calm medium-frequency base punctuated by irregular spikes. */
export type Spike = {
  at: number;
  half: number;
  amp: number;
  /** 0..1 — low ranks fire even when the system is calm. */
  rank: number;
};
export type SpikeSignal = { kind: "spike"; base: Float32Array; spikes: Spike[] };

export type Signals = {
  smooth: SmoothSignal;
  noise: NoiseSignal;
  spike: SpikeSignal;
};

const buildSmooth = (seed: string, N: number): SmoothSignal => {
  // Integer harmonics only: each component completes a whole number of cycles
  // across the array, so sample N-1 joins back onto sample 0.
  const parts = [3, 4, 6, 9, 15].map((k0, i) => ({
    k: Math.round((k0 * N) / 3600),
    amp: rndRange(`${seed}-a${i}`, 0.28, 1) / (1 + i * 0.62),
    phase: rnd(`${seed}-p${i}`) * TAU,
  }));
  const y = new Float32Array(N);
  let peak = 0;
  for (let i = 0; i < N; i++) {
    let v = 0;
    for (const p of parts) v += p.amp * Math.sin((TAU * p.k * i) / N + p.phase);
    y[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  for (let i = 0; i < N; i++) y[i] /= peak;
  return { kind: "smooth", y };
};

const buildNoise = (seed: string, N: number): NoiseSignal => {
  const band = new Float32Array(N);
  const jitter = new Float32Array(N);
  const weight = new Float32Array(N);
  // A slow periodic envelope so the band breathes rather than sitting flat.
  const scale = N / 3600;
  const env = [
    { k: Math.round(2 * scale), amp: 0.3, phase: rnd(`${seed}-e0`) * TAU },
    { k: Math.round(5 * scale), amp: 0.22, phase: rnd(`${seed}-e1`) * TAU },
    { k: Math.round(11 * scale), amp: 0.12, phase: rnd(`${seed}-e2`) * TAU },
  ];
  for (let i = 0; i < N; i++) {
    let e = 0.42;
    for (const c of env) e += c.amp * Math.sin((TAU * c.k * i) / N + c.phase);
    const local = 0.35 + 0.65 * rnd(`${seed}-h${i}`);
    band[i] = Math.max(0.05, e) * local;
    jitter[i] = rndSigned(`${seed}-j${i}`) * 0.35;
    weight[i] = 0.25 + 0.75 * rnd(`${seed}-w${i}`);
  }
  return { kind: "noise", band, jitter, weight };
};

const buildSpike = (seed: string, N: number): SpikeSignal => {
  const base = new Float32Array(N);
  const parts = [7, 11, 17, 29].map((k0, i) => ({
    k: Math.round((k0 * N) / 3600),
    amp: rndRange(`${seed}-b${i}`, 0.35, 1) * 0.115,
    phase: rnd(`${seed}-q${i}`) * TAU,
  }));
  for (let i = 0; i < N; i++) {
    let v = 0;
    for (const p of parts) v += p.amp * Math.sin((TAU * p.k * i) / N + p.phase);
    base[i] = v;
  }
  // A generous pool of candidate spikes, scaled to the length of the signal. Only the lowest ranks fire while the
  // system is calm; the rest fade in as instability climbs.
  const COUNT = Math.round((54 * N) / 3600);
  const spikes: Spike[] = [];
  for (let s = 0; s < COUNT; s++) {
    spikes.push({
      at: rndInt(`${seed}-sp${s}`, 0, N - 1),
      half: rndInt(`${seed}-sw${s}`, 4, 14),
      amp: rndRange(`${seed}-sa${s}`, 0.45, 1) * (rnd(`${seed}-ss${s}`) < 0.5 ? -1 : 1),
      rank: (s + 0.5) / COUNT,
    });
  }
  return { kind: "spike", base, spikes };
};

export const buildSignals = (): Signals => ({
  smooth: buildSmooth("qi-smooth", SIGNAL_WIDTHS[0]),
  noise: buildNoise("hl-noise", SIGNAL_WIDTHS[1]),
  spike: buildSpike("er-spike", SIGNAL_WIDTHS[2]),
});

/**
 * Rebuild panel 3's sample array for the current instability. Cheap: a copy of
 * the fixed base plus ~50 short pulses. No randomness is touched, so a given
 * instability always yields exactly the same array.
 */
export const composeSpikeTrace = (
  sig: SpikeSignal,
  out: Float32Array,
  density: number,
  gain: number,
): void => {
  const N = out.length;
  out.set(sig.base);
  for (const sp of sig.spikes) {
    // Spikes fade in over a narrow band around the density threshold instead
    // of popping into existence.
    const w = Math.min(1, Math.max(0, (density - sp.rank) / 0.14));
    if (w <= 0) continue;
    const a = sp.amp * gain * w * w * (3 - 2 * w);
    for (let d = -sp.half; d <= sp.half; d++) {
      const t = 1 - Math.abs(d) / (sp.half + 1);
      const idx = (sp.at + d + N) % N;
      out[idx] += a * t * t;
    }
  }
};
