/**
 * tornEdge — an irregular edge at two noise scales, with an optional fibre band.
 *
 * WHAT: Returns a polyline running between two points that deviates from the
 * straight line at a coarse scale and a fine scale, plus a band of short
 * perpendicular fibres along it.
 *
 * WHY TWO SCALES: a single noise scale reads as a wobble, not a tear. Real torn
 * paper has large-scale wander — where the tear chose to go — and small-scale
 * roughness from the fibre structure. Reproducing only one gives you either a
 * gentle curve or a buzzy zigzag; you need both.
 *
 * WHY THE FIBRE BAND: a clean torn line still reads as a cut. The short fibres
 * standing proud of the edge are what say "paper". They are optional because on
 * a torn metal or glass edge you do not want them.
 *
 * PARAMETERS
 *   from, to      Endpoints of the edge.
 *   rng           Seeded generator. Required.
 *   segments      Samples along the edge. Default 120.
 *   coarseAmp     Large-scale deviation in px. Default 14.
 *   coarseScale   How many coarse waves span the edge. Default 3.
 *   fineAmp       Small-scale deviation in px. Default 3.5.
 *   fineScale     How many fine waves span the edge. Default 40.
 *   fibres        How many fibres to emit. Default 0 (off).
 *   fibreLength   [min, max] fibre length in px. Default [3, 11].
 *
 * RETURNS `{ points, fibres }`. `fibres` is a list of {from, to} segments
 * standing perpendicular to the edge, for the caller to stroke thin and faint.
 *
 * GOTCHA: the deviation is perpendicular to the straight from->to line, not to
 * the local tangent. Over a long edge with high coarseAmp this can make the
 * fibres look slightly sheared. For a heavily wandering edge, generate it in
 * segments instead.
 *
 * EXAMPLE
 *   const { points, fibres } = tornEdge({
 *     from: { x: 0, y: 400 }, to: { x: 1920, y: 380 }, rng, fibres: 200,
 *   });
 */
import type { Point, Rng } from '../types';

export type Fibre = { from: Point; to: Point };

export type TornEdgeOptions = {
  from: Point;
  to: Point;
  rng: Rng;
  segments?: number;
  coarseAmp?: number;
  coarseScale?: number;
  fineAmp?: number;
  fineScale?: number;
  fibres?: number;
  fibreLength?: [number, number];
};

export type TornEdgeResult = {
  points: Point[];
  fibres: Fibre[];
};

/**
 * A seeded sum-of-sines, used instead of a noise library so the module has no
 * dependencies. Phases are drawn once from the rng, so the field is
 * deterministic and continuous.
 */
const makeWave = (rng: Rng, octaves: number): ((t: number) => number) => {
  const phases: number[] = [];
  const weights: number[] = [];
  for (let i = 0; i < octaves; i++) {
    phases.push(rng() * Math.PI * 2);
    weights.push(1 / (i + 1));
  }
  const norm = weights.reduce((a, b) => a + b, 0);
  return (t: number) => {
    let sum = 0;
    for (let i = 0; i < octaves; i++) {
      sum += Math.sin(t * (i + 1) + phases[i]) * weights[i];
    }
    return sum / norm;
  };
};

export const tornEdge = ({
  from,
  to,
  rng,
  segments = 120,
  coarseAmp = 14,
  coarseScale = 3,
  fineAmp = 3.5,
  fineScale = 40,
  fibres = 0,
  fibreLength = [3, 11],
}: TornEdgeOptions): TornEdgeResult => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const perpX = -dy / length;
  const perpY = dx / length;

  const coarse = makeWave(rng, 3);
  const fine = makeWave(rng, 2);

  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Taper the deviation to zero at both ends so the edge meets its endpoints
    // exactly — otherwise a torn edge detaches from the corner it belongs to.
    const taper = Math.sin(t * Math.PI);
    const offset =
      (coarse(t * coarseScale * Math.PI * 2) * coarseAmp +
        fine(t * fineScale * Math.PI * 2) * fineAmp) *
      taper;

    points.push({
      x: from.x + dx * t + perpX * offset,
      y: from.y + dy * t + perpY * offset,
    });
  }

  const out: Fibre[] = [];
  const [fMin, fMax] = fibreLength;
  for (let i = 0; i < fibres; i++) {
    const at = Math.min(points.length - 1, Math.floor(rng() * points.length));
    const base = points[at];
    const len = fMin + rng() * (fMax - fMin);
    // Fibres stand mostly perpendicular but lean along the edge a little, so
    // they do not read as a comb.
    const lean = (rng() * 2 - 1) * 0.5;
    const side = rng() < 0.5 ? -1 : 1;
    out.push({
      from: base,
      to: {
        x: base.x + (perpX * side + (dx / length) * lean) * len,
        y: base.y + (perpY * side + (dy / length) * lean) * len,
      },
    });
  }

  return { points, fibres: out };
};
