import type {CompositionSpec} from "./compositions";
import type {Rng} from "./rng";

export type WaveField = {
  /** Vertical displacement in field-space px at (x, y). */
  at: (x: number, y: number) => number;
  /** Sum of the component amplitudes — the maximum possible displacement. */
  maxAmp: number;
};

/**
 * The height field: two or three sines at different frequencies, amplitudes and
 * angles, with seeded phases. Everything in the frame — land dots and ocean
 * dots alike — is displaced vertically by this.
 */
export const buildWaveField = (
  comp: CompositionSpec,
  rng: Rng,
  k: number,
): WaveField => {
  const parts = comp.wave.map((w, i) => {
    const a = (w.angle * Math.PI) / 180;
    return {
      amp: w.amp * k,
      kx: (Math.cos(a) * 2 * Math.PI) / (w.len * k),
      ky: (Math.sin(a) * 2 * Math.PI) / (w.len * k),
      phase: rng("wave", i, "phase") * Math.PI * 2,
      // A slight second-order term keeps the crests from looking like a
      // pure sine — the sheet bunches rather than repeating exactly.
      warp: 0.22 + rng("wave", i, "warp") * 0.3,
    };
  });
  const maxAmp = parts.reduce((s, p) => s + p.amp, 0);

  const at = (x: number, y: number) => {
    let sum = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const u = x * p.kx + y * p.ky + p.phase;
      sum += p.amp * (Math.sin(u) + p.warp * Math.sin(u * 2 + p.phase) * 0.5);
    }
    return sum;
  };

  return {at, maxAmp: maxAmp * 1.35};
};
