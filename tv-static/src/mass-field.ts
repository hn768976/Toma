import { periodicNoise3 } from "./hash";

/**
 * Layer 2 of the effect, and the one that makes it read as analogue rather
 * than digital: large, soft light and dark regions drifting through the
 * frame that the speckle brightens and darkens against. Without these the
 * frame is a flat grey fizz.
 *
 * The field is built on a coarse grid and bilinearly expanded per row — it is
 * low-frequency by definition, so there is nothing to gain from evaluating it
 * per pixel.
 */

const TAU = Math.PI * 2;

type Octave = {
  /** Cells across the frame width, and across the same distance vertically.
   *  A higher freqY than freqX stretches the masses horizontally, which is
   *  how they sit on a scanned image. */
  freqX: number;
  freqY: number;
  weight: number;
  /** Lattice period, in cells, on each axis. */
  px: number;
  py: number;
  /** Time-lattice cells across the whole loop — the masses morph this often. */
  pz: number;
  /** Elliptical wander, in cells, over one loop. */
  wanderX: number;
  wanderY: number;
  phase: number;
  seed: number;
};

const OCTAVES: Octave[] = [
  {
    freqX: 2.0,
    freqY: 2.4,
    weight: 1,
    px: 6,
    py: 7,
    pz: 2,
    wanderX: 0.5,
    wanderY: 0.3,
    phase: 0.0,
    seed: 11,
  },
  {
    freqX: 4.1,
    freqY: 6.0,
    weight: 0.68,
    px: 11,
    py: 15,
    pz: 3,
    wanderX: 0.45,
    wanderY: 0.55,
    phase: 1.9,
    seed: 23,
  },
  {
    freqX: 8.3,
    freqY: 13.5,
    weight: 0.46,
    px: 21,
    py: 33,
    pz: 4,
    wanderX: 0.7,
    wanderY: 0.25,
    phase: 3.7,
    seed: 41,
  },
  {
    freqX: 17.0,
    freqY: 29.0,
    weight: 0.3,
    px: 43,
    py: 71,
    pz: 5,
    wanderX: 0.9,
    wanderY: 0.4,
    phase: 5.1,
    seed: 67,
  },
  {
    freqX: 34.0,
    freqY: 62.0,
    weight: 0.17,
    px: 87,
    py: 149,
    pz: 6,
    wanderX: 1.3,
    wanderY: 0.6,
    phase: 2.4,
    seed: 89,
  },
];

/**
 * Every frame is centred and rescaled to this RMS, so the masses carry the
 * same weight throughout the loop instead of fading whenever the octaves
 * happen to cancel. What would otherwise be an uncontrolled whole-frame
 * brightness wander is then reintroduced deliberately, and loops.
 */
const TARGET_RMS = 0.46;
const DC_AMP = 0.4;

export class MassField {
  private readonly gw: number;
  private readonly gh: number;
  private readonly step: number;
  private readonly invStep: number;
  private readonly grid: Float32Array;
  private readonly aspect: number;

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    // ~150 samples down the frame is plenty for masses this soft.
    this.step = Math.max(4, Math.round(height / 150));
    this.invStep = 1 / this.step;
    this.gw = Math.ceil(width / this.step) + 2;
    this.gh = Math.ceil(height / this.step) + 2;
    this.grid = new Float32Array(this.gw * this.gh);
    this.aspect = height / width;
  }

  /** @param t loop position in [0, 1) — must be `frame / durationInFrames`. */
  build(t: number, gain: number): void {
    const { gw, gh, step, width, aspect, grid } = this;
    const angle = TAU * t;
    const sinT = Math.sin(angle);
    const cosT = Math.cos(angle);
    const n = gw * gh;

    for (let gy = 0; gy < gh; gy++) {
      const ny = (gy * step) / width; // y in width units, so masses stay round
      for (let gx = 0; gx < gw; gx++) {
        const nx = (gx * step) / width;
        let sum = 0;
        for (let i = 0; i < OCTAVES.length; i++) {
          const o = OCTAVES[i];
          const ph = o.phase;
          const u =
            nx * o.freqX +
            o.wanderX * (sinT * Math.cos(ph) - cosT * Math.sin(ph));
          const v =
            ny * o.freqY +
            o.wanderY * (cosT * Math.cos(ph) + sinT * Math.sin(ph));
          const w = t * o.pz;
          sum +=
            o.weight *
            (periodicNoise3(u, v, w, o.px, o.py, o.pz, o.seed) - 0.5);
        }
        grid[gy * gw + gx] = sum;
      }
    }

    let mean = 0;
    for (let i = 0; i < n; i++) mean += grid[i];
    mean /= n;

    let variance = 0;
    for (let i = 0; i < n; i++) {
      const d = grid[i] - mean;
      variance += d * d;
    }
    const rms = Math.sqrt(variance / n);
    const k = rms > 1e-6 ? TARGET_RMS / rms : 0;
    const dc = DC_AMP * Math.sin(angle);

    for (let i = 0; i < n; i++) {
      let v = (grid[i] - mean) * k + dc;
      if (v > 1) v = 1;
      else if (v < -1) v = -1;
      grid[i] = v * gain;
    }

    // `aspect` is unused arithmetically but documents that y is expressed in
    // width units so the mass blobs stay circular rather than stretched.
    void aspect;
  }

  /** Expands one grid row to full output width. */
  expandRow(y: number, out: Float32Array): void {
    const { gw, invStep, grid, width } = this;
    const gy = y * invStep;
    const iy = Math.floor(gy);
    const fy = gy - iy;
    const rowA = iy * gw;
    const rowB = (iy + 1) * gw;

    for (let x = 0; x < width; x++) {
      const gx = x * invStep;
      const ix = gx | 0;
      const fx = gx - ix;
      const a = grid[rowA + ix];
      const b = grid[rowA + ix + 1];
      const c = grid[rowB + ix];
      const d = grid[rowB + ix + 1];
      const top = a + (b - a) * fx;
      const bot = c + (d - c) * fx;
      out[x] = top + (bot - top) * fy;
    }
  }
}
