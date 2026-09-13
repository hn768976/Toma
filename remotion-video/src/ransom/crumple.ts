import { hashRandom, randRange } from "./random";

// The unfold is driven entirely by a clip-path polygon morph. Both the
// crumpled wad and the flat tile are described by the SAME number of points,
// in the same order, so interpolating them point-by-point reads as a sheet of
// paper being pulled open rather than a shape cross-fade.

export type Pt = { x: number; y: number };

const POINTS_PER_EDGE = 5;
export const POLY_POINTS = POINTS_PER_EDGE * 4;

// The flat state: the tile's own rectangle, sampled evenly around its
// perimeter. Coordinates are normalised (0..1) so one shape serves any
// tile size and any output resolution.
export const rectPerimeter = (): Pt[] => {
  const pts: Pt[] = [];
  for (let k = 0; k < POLY_POINTS; k++) {
    const edge = Math.floor(k / POINTS_PER_EDGE);
    const f = (k % POINTS_PER_EDGE) / POINTS_PER_EDGE;
    if (edge === 0) pts.push({ x: f, y: 0 });
    else if (edge === 1) pts.push({ x: 1, y: f });
    else if (edge === 2) pts.push({ x: 1 - f, y: 1 });
    else pts.push({ x: 0, y: 1 - f });
  }
  return pts;
};

// The crumpled state: every perimeter point dragged toward the centre by a
// random amount and swung slightly around it. Because each point keeps its
// index, the morph back out to the rectangle looks like the creases relaxing.
export const crumpleShape = (seed: number): Pt[] => {
  const flat = rectPerimeter();
  return flat.map((p, k) => {
    const dx = p.x - 0.5;
    const dy = p.y - 0.5;
    const pull = randRange(seed * 131 + k * 17, 0.4, 1.0);
    const swing = randRange(seed * 977 + k * 41, -0.38, 0.38);
    const cos = Math.cos(swing);
    const sin = Math.sin(swing);
    return {
      x: 0.5 + (dx * cos - dy * sin) * pull,
      y: 0.5 + (dx * sin + dy * cos) * pull,
    };
  });
};

export const lerpShape = (a: Pt[], b: Pt[], t: number): Pt[] =>
  a.map((p, i) => ({
    x: p.x + (b[i].x - p.x) * t,
    y: p.y + (b[i].y - p.y) * t,
  }));

export const toClipPath = (pts: Pt[]): string =>
  `polygon(${pts
    .map((p) => `${(p.x * 100).toFixed(3)}% ${(p.y * 100).toFixed(3)}%`)
    .join(", ")})`;

// Creased facets, drawn over the tile while it is still bunched up. Each is a
// wedge from the centre out to two neighbouring silhouette points, shaded
// light or dark so the wad reads as folded paper catching light rather than a
// flat blob. They fade out as the sheet opens.
export type Facet = { clipPath: string; color: string };

export const crumpleFacets = (seed: number, pts: Pt[]): Facet[] => {
  const facets: Facet[] = [];
  const count = 5;
  for (let i = 0; i < count; i++) {
    const start =
      Math.floor(randRange(seed * 313 + i * 71, 0, POLY_POINTS)) % POLY_POINTS;
    const span = 3 + Math.floor(hashRandom(seed * 509 + i * 23) * 4);
    const wedge: Pt[] = [{ x: 0.5, y: 0.5 }];
    for (let s = 0; s <= span; s++) wedge.push(pts[(start + s) % POLY_POINTS]);
    const light = hashRandom(seed * 787 + i * 13) > 0.45;
    const alpha = randRange(seed * 149 + i * 59, 0.18, 0.46).toFixed(3);
    facets.push({
      clipPath: toClipPath(wedge),
      color: light
        ? `rgba(255, 252, 244, ${alpha})`
        : `rgba(0, 0, 0, ${alpha})`,
    });
  }
  return facets;
};
