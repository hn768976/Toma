/**
 * The driving signal: a synthetic spectrum.
 *
 * `spectrumAt(frame)` is a pure function of the frame number — no state, no
 * accumulation. Each band is a sum of three sinusoids whose frequencies are
 * *integer* cycles per loop, so the whole signal is periodic over
 * DURATION_IN_FRAMES and the animation closes seamlessly.
 *
 * Band index maps to an angle around the core: band 0 sits at the top of the
 * frame. Low bands (near the top) move slowly with a large amplitude; high
 * bands (near the bottom) flicker faster with a smaller one. The profile is
 * mirrored around the circle so there is no seam where band N-1 meets band 0.
 */

import {
  BEAT_DECAY,
  BEAT_INTERVAL,
  DURATION_IN_FRAMES,
  NUM_BANDS,
  TAU,
} from "./constants";
import { clamp01, lerp, mulberry32 } from "./random";

type BandDef = {
  k1: number;
  k2: number;
  k3: number;
  a1: number;
  a2: number;
  a3: number;
  p1: number;
  p2: number;
  p3: number;
  env: number;
  beatGain: number;
};

const BANDS: BandDef[] = (() => {
  const rnd = mulberry32(0x5eed01);
  const defs: BandDef[] = [];
  for (let i = 0; i < NUM_BANDS; i++) {
    // 0 at the top of the circle, 1 at the bottom, back to 0 — mirrored so the
    // "low vs high frequency" character has no discontinuity at the wrap.
    const t = 1 - Math.abs((2 * i) / NUM_BANDS - 1);
    defs.push({
      k1: 1 + Math.floor(t * 3 + rnd() * 1.4),
      k2: 3 + Math.floor(t * 11 + rnd() * 3),
      k3: 7 + Math.floor(t * 20 + rnd() * 5),
      a1: lerp(0.66, 0.2, t),
      a2: lerp(0.24, 0.3, t),
      a3: lerp(0.05, 0.28, t),
      p1: rnd(),
      p2: rnd(),
      p3: rnd(),
      // Spectral envelope: high bands carry less energy, as in real audio.
      env: lerp(1, 0.46, Math.pow(t, 1.15)),
      beatGain: 0.55 + 0.45 * rnd(),
    });
  }
  return defs;
})();

/**
 * Global beat pulse: an instant lift that eases back out over BEAT_DECAY
 * frames. BEAT_INTERVAL divides DURATION_IN_FRAMES, so the envelope loops.
 */
export const beatEnvelope = (frame: number): number => {
  const since = ((frame % BEAT_INTERVAL) + BEAT_INTERVAL) % BEAT_INTERVAL;
  if (since >= BEAT_DECAY) {
    return 0;
  }
  const u = since / BEAT_DECAY;
  return Math.pow(1 - u, 2.2);
};

export const spectrumAt = (
  frame: number,
  duration: number = DURATION_IN_FRAMES,
): Float32Array => {
  const out = new Float32Array(NUM_BANDS);
  const beat = beatEnvelope(frame);
  const f = frame / duration;
  for (let i = 0; i < NUM_BANDS; i++) {
    const b = BANDS[i];
    const raw =
      b.a1 * Math.sin(TAU * (b.k1 * f + b.p1)) +
      b.a2 * Math.sin(TAU * (b.k2 * f + b.p2)) +
      b.a3 * Math.sin(TAU * (b.k3 * f + b.p3));
    const v = (0.5 + raw * 0.62) * b.env + beat * 0.34 * b.beatGain;
    out[i] = clamp01(v);
  }
  return out;
};

/** Angle (radians, screen convention) at which band `i` sits before rotation. */
export const bandAngle = (i: number) => -Math.PI / 2 + (i * TAU) / NUM_BANDS;

/** Inverse of `bandAngle`: which band drives an element at this field angle. */
export const bandIndexAt = (theta: number): number => {
  const u = (theta + Math.PI / 2) / TAU;
  const w = u - Math.floor(u);
  const idx = Math.floor(w * NUM_BANDS);
  return idx >= NUM_BANDS ? NUM_BANDS - 1 : idx;
};
