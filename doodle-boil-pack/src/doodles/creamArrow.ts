import { CREAM } from "../inks";
import { outline, pressedEnds, Pt, samplePath, smoothPath, Stroke, toPath2D, unevenPressure } from "../lib/geom";
import { roughEdgeFill } from "../lib/ink";
import { Layer, scratch } from "../lib/layer";
import { rngFor } from "../lib/random";
import { roughFill } from "../lib/roughLines";
import { texOffset } from "../lib/scene";
import { singleDoodle, SPACING } from "./common";

// ---------- 3: chunky cream arrow, thick black outline, a few hatch lines ----------

// Corners of the arrow, clockwise from the tip. Edges bow slightly, as drawn freehand.
const CORNERS: Pt[] = [
  [2335, 700],
  [1350, 915],
  [1610, 1160],
  [1238, 1640],
  [1555, 1905],
  [1948, 1480],
  [2225, 1672],
];

const bowed = (corners: Pt[], bow: number): Pt[] => {
  const out: Pt[] = [];
  const n = corners.length;
  for (let i = 0; i <= n; i++) {
    const a = corners[i % n];
    const b = corners[(i + 1) % n];
    out.push(a);
    if (i === n) break;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const k = bow * (i % 2 === 0 ? 1 : -0.6);
    out.push([mx + nx * k * len, my + ny * k * len]);
  }
  return out;
};

export const creamArrow = (id: string) => {
  const rng = rngFor(id, "outline");
  const ring = bowed(CORNERS, 0.012);
  // Closed outline drawn as one stroke that runs a little past where it began.
  const loop: Pt[] = [...ring, ring[1], ring[2]];
  const linePts = samplePath(smoothPath(loop, 0.5), SPACING);
  const outlineStroke: Stroke = { pts: linePts, size: 60, thinning: 0.5, pressure: unevenPressure(linePts.length, rng, 0.42, 0.64) };

  // Hatching from rough.js in two patches on the upper-left side; keep 7 strokes.
  const patchA: Pt[] = [
    [1720, 960],
    [2080, 890],
    [2100, 1080],
    [1740, 1150],
  ];
  const patchB: Pt[] = [
    [1430, 1395],
    [1640, 1330],
    [1700, 1660],
    [1330, 1690],
  ];
  const hatch = [
    ...roughFill(patchA, { fillStyle: "hachure", hachureGap: 78, hachureAngle: 80, seed: 21, roughness: 0.5, bowing: 0.3 }).slice(0, 3),
    ...roughFill(patchB, { fillStyle: "hachure", hachureGap: 82, hachureAngle: 78, seed: 22, roughness: 0.5, bowing: 0.3 }).slice(0, 4),
  ].map((l) => {
    const pts = samplePath(smoothPath(l), SPACING);
    return { pts, size: 16, thinning: 0.7, pressure: pressedEnds(pts.length, 0.6, 0.25, 0.2) } as Stroke;
  });

  const base = [outlineStroke, ...hatch];
  // Arrow about 1150 across: 0.8% boil.
  return singleDoodle(id, base, 9, (layer, strokes, v) => inkCream(layer, strokes, v, id));
};

const inkCream = (layer: Layer, strokes: Stroke[], v: number, id: string) => {
  const [ring, ...hatch] = strokes;
  const off = texOffset(id, v);
  // Fill: the outline's centre line, so the black covers the fill edge with no gap.
  const fill = scratch("cream-fill", layer);
  fill.ctx.fillStyle = CREAM.fill;
  fill.ctx.fill(toPath2D([ring.pts]));
  // Paper grain: faint darker flecks, only on the fill.
  const fleck = scratch("cream-fleck", layer);
  fleck.draw(fill);
  fleck.mask("paperSpeckle", off);
  fleck.tint(CREAM.speckle);
  fill.draw(fleck, "source-atop", 0.5);
  layer.draw(fill);

  // Hatches and outline: black marker, ragged only at the outer edge.
  const ink = scratch("cream-ink", layer);
  roughEdgeFill(ink, [outline(ring)], "crayon", off, ring.size * 0.08);
  roughEdgeFill(ink, hatch.map((h) => outline(h)), "brush", [off[1], off[0]], 2);
  ink.tint(CREAM.outline);
  layer.draw(ink);
};
