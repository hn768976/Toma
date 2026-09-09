import { makeRandom, randRange } from "./rand";

export type Marker = {
  x: number;
  y: number;
  /** Halo radius in design px; the dot and ring are fractions of it. */
  radius: number;
  /** Frames per pulse cycle, staggered so the halos never breathe in unison. */
  pulsePeriod: number;
  pulsePhase: number;
};

/**
 * Scatters cluster markers across the plot area by rejection sampling against
 * a minimum separation, so they read as distinct clusters rather than a
 * clumped spray. Pure in `seed`: the same seed always yields the same layout,
 * which is what lets Remotion render frames out of order.
 */
export const buildMarkers = (
  seed: number,
  count: number,
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
    minSeparation: number;
  },
): Marker[] => {
  const rng = makeRandom(seed);
  const out: Marker[] = [];

  // Bounded so a too-tight separation degrades to fewer markers rather than
  // spinning forever.
  for (let guard = 0; guard < 6000 && out.length < count; guard++) {
    const x = box.x + rng() * box.width;
    const y = box.y + rng() * box.height;
    const radius = randRange(rng, 38, 74);
    const pulsePeriod = randRange(rng, 78, 132);
    const pulsePhase = rng();

    const tooClose = out.some(
      (m) => Math.hypot(m.x - x, m.y - y) < box.minSeparation,
    );
    if (tooClose) continue;

    out.push({ x, y, radius, pulsePeriod, pulsePhase });
  }

  return out;
};
