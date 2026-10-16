import worldDots from "../../data/worldDots.json";
import { mulberry32 } from "../../lib/random";
import { buildTrain, buildTrainToward, gearShape, PlacedGear } from "./gear";

const rng = mulberry32(4067526391);

// Near train (sharp), module 5: chunky teeth, spread over the left 60%.
export const NEAR: PlacedGear[] = buildTrainToward({ x: 0, y: 330, N: 34, style: "spokes", phase: 0.1 }, 5, [
  { parent: 0, x: 95, y: 240, N: 10, style: "solid" }, // 1
  { parent: 0, x: 135, y: 365, N: 11, style: "spokes" }, // 2
  { parent: 2, x: 195, y: 455, N: 22, style: "holes" }, // 3
  { parent: 3, x: 118, y: 515, N: 10, style: "solid" }, // 4
  { parent: 3, x: 285, y: 390, N: 13, style: "spokes" }, // 5
  { parent: 5, x: 362, y: 305, N: 22, style: "spokes" }, // 6
  { parent: 6, x: 285, y: 235, N: 10, style: "solid" }, // 7
  { parent: 6, x: 470, y: 440, N: 36, style: "spokes" }, // 8
  { parent: 8, x: 632, y: 318, N: 30, style: "spokes" }, // 9
  { parent: 9, x: 735, y: 215, N: 20, style: "spokes" }, // 10
  { parent: 10, x: 668, y: 150, N: 10, style: "holes" }, // 11
  { parent: 9, x: 718, y: 425, N: 10, style: "solid" }, // 12
  { parent: 12, x: 772, y: 392, N: 10, style: "spokes" }, // 13
]);

// Far train (blurred, dimmer): fills the gap between the gear group and the gauge.
export const FAR: PlacedGear[] = buildTrain(
  800, 470, 16, 3,
  [
    [0, -80, 12, "solid"],
    [1, -60, 18, "holes"],
    [0, 30, 14, "spokes"],
  ],
  "spokes",
  0.4,
);
// Near-train gears drawn out of focus (depth).
export const SOFT_NEAR = new Set([3, 4, 8]);

// Gauge.
export const GAUGE = { x: 1032, y: 318, gear: gearShape(40, 9.2, "solid", 40) };

// World map dots (Natural Earth 1:110m land, public domain).
const SCALE = 4.4; // logical px per degree
export const MAP_DOTS = (worldDots.cells as number[]).map((cell) => {
  const r = Math.floor(cell / worldDots.cols);
  const c = cell % worldDots.cols;
  const lon = worldDots.lon0 + (c + 0.5) * worldDots.step;
  const lat = worldDots.lat0 - (r + 0.5) * worldDots.step;
  const x = 640 + (lon - 8) * SCALE;
  const y = 22 + (84 - lat) * SCALE;
  // patchy lighting: brighter near the left glow and the centre, dim elsewhere
  const patch = 0.35 + 0.65 * Math.max(Math.exp(-((x - 170) ** 2 + (y - 300) ** 2) / 70000), Math.exp(-((x - 560) ** 2 + (y - 300) ** 2) / 50000), 0.3 + 0.25 * Math.sin(x * 0.011 + 1) * Math.sin(y * 0.017 + 2));
  return { x, y, b: rng() * patch + 0.15 * patch, tw: rng() < 0.12 ? 1 + Math.floor(rng() * 3) : 0, ph: rng() };
});
export const MAP_DOT = worldDots.step * SCALE;

export const HEXES = [
  ...Array.from({ length: 21 }, (_, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    return { x: 250 + col * 124 + (row % 2) * 62, y: 520 + row * 108, a: 0.07 + rng() * 0.08, dark: false };
  }),
  ...Array.from({ length: 4 }, (_, i) => ({ x: 700 + i * 62 + (i % 2) * 20, y: 30 + (i % 2) * 54, a: 0.25, dark: true })),
].filter(() => rng() < 0.8);

export const SPECKS = Array.from({ length: 10 }, () => ({ x: rng() * 820, y: 120 + rng() * 480, r: 0.8 + rng() * 1.6, ph: rng(), k: 1 + Math.floor(rng() * 3) }));

export const LABELS = [
  { x: 92, y: 108, s: "[26/19]_index" },
  { x: 586, y: 107, s: "[26/19]" },
  { x: 96, y: 540, s: "[26/19]" },
  { x: 210, y: 420, s: "EXT [207025]" },
  { x: 418, y: 613, s: "SYS.[8754674]_x_7220" },
  { x: 950, y: 60, s: "534867/4096_index [n]" },
  { x: 790, y: 442, s: "IDX.47/33" },
  { x: 880, y: 577, s: "EXT [207876]" },
];
