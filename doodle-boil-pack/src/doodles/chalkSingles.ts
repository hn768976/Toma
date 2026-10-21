import { CHALK } from "../inks";
import { pressedEnds, Pt, samplePath, smoothPath, Stroke, transformPts } from "../lib/geom";
import { chalkInk } from "../lib/ink";
import { range, rngFor } from "../lib/random";
import { roughFill } from "../lib/roughLines";
import { texOffset } from "../lib/scene";
import { chevron, endDir, singleDoodle, SPACING, strokeFrom } from "./common";

// ---------- 4: one chalk arrow curving up and to the right ----------

export const chalkArrowCurved = (id: string) => {
  const shaft = strokeFrom(
    [
      [470, 1760],
      [760, 1440],
      [1100, 1170],
      [1520, 960],
      [1980, 845],
      [2460, 800],
      [2930, 808],
    ],
    128,
    { pressure: (n) => pressedEnds(n, 0.5, 0.66, 0.05) },
  );
  const head = strokeFrom(chevron(shaft.pts[shaft.pts.length - 1], endDir(shaft.pts) + 0.02, 400, 0.62, 0.04), 124, {
    straight: true,
    pressure: (n) => pressedEnds(n, 0.5, 0.68, 0.08),
  });
  // Doodle about 2500 wide: 0.8% boil.
  return singleDoodle(id, [shaft, head], 20, (layer, s, v) => chalkInk(layer, s, CHALK, texOffset(id, v)));
};

// ---------- 5: chalk heart with scribble fill, two tiny hearts ----------

/** Heart outline, drawn from the top dip round and slightly past the start (hand overlap). */
const heartLine = (cx: number, cy: number, w: number, h: number, rot: number, overlap = 0.06, start = 0): Pt[] => {
  const pts: Pt[] = [];
  const N = 90;
  for (let i = 0; i <= N * (1 + overlap); i++) {
    const t = start + (i / N) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([(x / 32) * w, ((y - 2.5) / 29) * h]);
  }
  return transformPts(pts, 1, rot, cx, cy);
};

const fromPts = (raw: Pt[], size: number, pressure: (n: number) => number[]): Stroke => {
  const pts = samplePath(smoothPath(raw), SPACING);
  return { pts, size, pressure: pressure(pts.length) };
};

const scribble = (
  poly: Pt[],
  gap: number,
  angle: number,
  seed: number,
  size: number,
): Stroke[] =>
  roughFill(poly, { fillStyle: "zigzag", hachureGap: gap, hachureAngle: angle, seed, roughness: 0.7, bowing: 0.8 }, gap * 0.9).map((l) =>
    fromPts(l, size, (n) => pressedEnds(n, 0.47, 0.62, 0.04)),
  );

export const chalkHearts = (id: string) => {
  const rng = rngFor(id, "layout");
  const big = { cx: 1880, cy: 1000, w: 1220, h: 1240, rot: 0.05 };
  const left = { cx: 1335, cy: 1610, w: 370, h: 300, rot: -0.2 };
  const right = { cx: 2580, cy: 1480, w: 260, h: 215, rot: 0.22 };
  const outlines = [big, left, right].map((hp, i) =>
    fromPts(heartLine(hp.cx, hp.cy, hp.w, hp.h, hp.rot, 0.07, range(rng, -0.08, 0.05)), i === 0 ? 68 : 40, (n) =>
      pressedEnds(n, 0.5, 0.66, 0.04),
    ),
  );
  // Fill lines stay inside the outline: rough.js zigzag over a shrunk heart.
  const inner = (hp: typeof big, k: number) => heartLine(hp.cx, hp.cy + hp.h * 0.02, hp.w * k, hp.h * k, hp.rot, 0);
  const fills = [
    ...scribble(inner(big, 0.8), 92, -6, 11, 30),
    ...scribble(inner(left, 0.68), 46, 25, 12, 18),
    ...scribble(inner(right, 0.66), 40, -25, 13, 16),
  ];
  // Heart is about 1250 across: 0.8% boil.
  return singleDoodle(id, [...outlines, ...fills], 10, (layer, s, v) => chalkInk(layer, s, CHALK, texOffset(id, v)));
};

// ---------- 6: three chalk arrows fanning in, pointing down ----------

export const chalkArrowsDown = (id: string) => {
  const shafts: Pt[][] = [
    [
      [990, 790],
      [1250, 1180],
      [1490, 1540],
      [1672, 1905],
    ],
    [
      [1832, 492],
      [1858, 900],
      [1884, 1400],
      [1902, 1885],
    ],
    [
      [2737, 660],
      [2600, 1060],
      [2380, 1460],
      [2112, 1800],
    ],
  ];
  const strokes: Stroke[] = [];
  shafts.forEach((ctrl, i) => {
    const s = strokeFrom(ctrl, 74, { pressure: (n) => pressedEnds(n, 0.5, 0.7, 0.05) });
    strokes.push(s);
    const skew = [0.12, 0, -0.1][i];
    strokes.push(
      strokeFrom(chevron(s.pts[s.pts.length - 1], endDir(s.pts), 330, 0.62, skew), 72, {
        straight: true,
            pressure: (n) => pressedEnds(n, 0.5, 0.66, 0.08),
      }),
    );
  });
  // Group about 1800 across: 0.7% boil.
  return singleDoodle(id, strokes, 12, (layer, s, v) => chalkInk(layer, s, CHALK, texOffset(id, v)));
};
