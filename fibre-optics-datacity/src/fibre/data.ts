// Fibre Optic Macro — static scene data, built once at module level from a
// seeded PRNG. Per-frame values are pure functions of the frame (see
// FibreOptic.tsx); nothing here changes after module load.
import { mulberry32, TAU } from "../lib/random";

export const FIBRE_COUNT = 2500;
export const LOOP_FRAMES = 600;

// Bundle origin (world units), below the bottom edge of frame.
export const BASE = { x: 0.85, y: -3.1, z: 0.0 };

export type FibreData = {
  // base offset inside the bundle
  bx: Float32Array;
  bz: Float32Array;
  // unit direction of the fibre at its tip
  dx: Float32Array;
  dy: Float32Array;
  dz: Float32Array;
  len: Float32Array;
  // stiffness: how long the fibre stays vertical before fanning out (0..1)
  stiff: Float32Array;
  // twinkle: integer cycles per loop and phase
  twCycles: Uint8Array;
  twPhase: Float32Array;
  twAmp: Float32Array;
  // individual sway
  swCycles: Uint8Array;
  swPhase: Float32Array;
  // base brightness and hue offset (multicolour)
  bright: Float32Array;
  hue: Float32Array;
};

const build = (): FibreData => {
  const rnd = mulberry32(0x0f1b4e);
  const n = FIBRE_COUNT;
  const d: FibreData = {
    bx: new Float32Array(n),
    bz: new Float32Array(n),
    dx: new Float32Array(n),
    dy: new Float32Array(n),
    dz: new Float32Array(n),
    len: new Float32Array(n),
    stiff: new Float32Array(n),
    twCycles: new Uint8Array(n),
    twPhase: new Float32Array(n),
    twAmp: new Float32Array(n),
    swCycles: new Uint8Array(n),
    swPhase: new Float32Array(n),
    bright: new Float32Array(n),
    hue: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    // bundle cross-section: dense disc
    const br = 0.09 * Math.sqrt(rnd());
    const ba = rnd() * TAU;
    d.bx[i] = Math.cos(ba) * br;
    d.bz[i] = Math.sin(ba) * br;
    // fan direction: polar angle from vertical, denser towards the rim of the
    // dome so the tips form a full arc; azimuth uniform.
    const u = rnd();
    let polar = 0.72 * Math.pow(u, 0.62); // narrow bundle: up to ~41 deg
    const az = ba + (rnd() - 0.5) * 1.2; // fibres keep roughly their side
    // lengths: most fibres long (the dome), a share shorter (fills inside)
    const lr = rnd();
    const isShort = lr >= 0.68;
    if (isShort) polar *= 0.8; // short fibres stay nearer the axis
    const sp = Math.sin(polar);
    d.dx[i] = sp * Math.cos(az) * 1.6; // wider horizontally (bundle spread)
    d.dy[i] = Math.cos(polar);
    d.dz[i] = sp * Math.sin(az) * 0.9;
    const l = Math.hypot(d.dx[i], d.dy[i], d.dz[i]);
    d.dx[i] /= l;
    d.dy[i] /= l;
    d.dz[i] /= l;
    d.len[i] = isShort ? 1.6 + rnd() * 2.1 : 3.85 + rnd() * 0.5;
    d.stiff[i] = 0.35 + rnd() * 0.3;
    d.twCycles[i] = 1 + Math.floor(rnd() * 6); // 1..6 cycles per 600 frames
    d.twPhase[i] = rnd() * TAU;
    d.twAmp[i] = 0.15 + rnd() * 0.45;
    d.swCycles[i] = 1 + Math.floor(rnd() * 3);
    d.swPhase[i] = rnd() * TAU;
    const b = rnd();
    d.bright[i] = 0.06 + 0.94 * Math.pow(b, 3.4);
    d.hue[i] = rnd();
  }
  return d;
};

export const FIBRES = build();
