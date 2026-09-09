import { mulberry32, range } from "./random";

export type Ghost = {
  /** Position along the source -> frame-centre axis. 1.0 is frame centre. */
  k: number;
  /** Radius, as a fraction of frame height. */
  rad: number;
  /** 0 = round, 1 = hexagonal (aperture blades). */
  shape: number;
  /** Relative brightness. */
  amp: number;
  /** 0 picks ghostA, 1 picks ghostB. */
  tint: number;
};

/**
 * Ghost layout is drawn once, at module scope, from a fixed seed -- so every
 * thread of a distributed render lays the ghosts out identically.
 */
const build = (seed: number): Ghost[] => {
  const rnd = mulberry32(seed);
  // Spaced along the axis running from the source through frame centre and out
  // the far corner. The two past centre are the large, faint ones.
  const ks = [0.44, 0.70, 0.98, 1.24, 1.52, 1.80];
  return ks.map((k, i) => ({
    k,
    // Ghosts grow as they get further from the source, as real ones do.
    rad: range(rnd, 0.035, 0.058) * (0.55 + 0.72 * k),
    shape: i % 2 === 0 ? range(rnd, 0.75, 1.0) : range(rnd, 0.0, 0.2),
    amp: range(rnd, 0.22, 1.0) * (i === 2 ? 0.55 : 1.0), // thin the one sitting on centre
    tint: i % 2 === 0 ? 0 : 1,
  }));
};

export const GHOSTS = build(0x5eed1a7e);
export const GHOST_COUNT = GHOSTS.length;
