import { mulberry32 } from "../../lib/random";

// Static diagram layout in 1280x720 logical px. Routing is fixed data plus
// seeded decoration, generated once at module level.
export const CHIP = { x: 618, y: 362, r: 86 };

export type Badge = { icon: string; x: number; y: number; r: number; ring: 0 | 1; ink: 0 | 1; hot?: boolean };
// ring / ink: 0 = primary colour, 1 = secondary colour
export const BADGES: Badge[] = [
  { icon: "satellite", x: 278, y: 165, r: 78, ring: 1, ink: 0, hot: true },
  { icon: "folder", x: 590, y: 104, r: 55, ring: 0, ink: 1 },
  { icon: "cloud", x: 960, y: 170, r: 68, ring: 0, ink: 0 },
  { icon: "atom", x: 1188, y: 362, r: 80, ring: 1, ink: 0, hot: true },
  { icon: "brain", x: 843, y: 535, r: 78, ring: 0, ink: 1 },
  { icon: "server", x: 597, y: 600, r: 63, ring: 0, ink: 0 },
  { icon: "robotArm", x: 350, y: 480, r: 59, ring: 0, ink: 1 },
  { icon: "chart", x: 88, y: 495, r: 72, ring: 0, ink: 0 },
];

export type Route = { pts: number[]; t0: number; badge: number; ink: 0 | 1; len: number; arrive: number; width: number; dotted?: boolean };
const SPEED = 260; // logical px per second

const mk = (pts: number[], t0: number, badge: number, ink: 0 | 1 = 0, width = 1.1, dotted = false): Route => {
  let len = 0;
  for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  const trim = badge >= 0 ? BADGES[badge].r : 0;
  return { pts, t0, badge, ink, len, arrive: t0 + (len - trim) / SPEED, width, dotted };
};

// Spokes from the chip to each badge.
export const ROUTES: Route[] = [
  mk([600, 360, 600, 100], 1.6, 1, 1),
  mk([616, 330, 420, 330, 420, 166, 280, 166], 1.7, 0),
  mk([646, 330, 646, 252, 958, 252, 958, 168], 1.8, 2),
  mk([616, 372, 1010, 372, 1010, 360, 1188, 360], 1.9, 3),
  mk([636, 392, 700, 392, 700, 456, 846, 456, 846, 536], 2.0, 4, 1),
  mk([596, 372, 596, 604], 2.1, 5),
  mk([600, 404, 470, 404, 470, 480, 350, 480], 2.2, 6, 1),
  mk([590, 360, 170, 360, 170, 494, 84, 494], 2.3, 7),
];

// Outer contour and secondary links, start when the nearest badge is lit.
const after = (i: number, d = 0.2) => ROUTES[i].arrive + d;
export const LOOPS: Route[] = [
  mk([84, 428, 34, 380, 34, 228, 96, 166, 210, 166], after(7), -1),
  mk([130, 552, 240, 610, 450, 610, 540, 640], after(7, 0.4), -1),
  mk([280, 236, 280, 290, 214, 290, 214, 330], after(1), -1, 1, 1),
  mk([642, 100, 772, 100, 796, 124, 892, 124], after(0), -1, 1, 1),
  mk([1020, 168, 1100, 190, 1155, 250, 1160, 286], after(2), -1),
  mk([1160, 434, 1160, 520, 1045, 585, 918, 560], after(3), -1),
  mk([350, 536, 350, 588, 460, 588], after(6), -1, 1, 1),
  mk([420, 330, 420, 270, 520, 270, 520, 210], after(1, 0.5), -1, 0, 1),
  mk([958, 252, 1060, 252, 1060, 300, 1114, 300], after(2, 0.4), -1, 0, 1),
  mk([1010, 372, 1010, 450, 1090, 450], after(3, 0.3), -1, 0, 1),
  // dotted secondary lines around the hub
  mk([490, 420, 560, 420, 560, 530, 760, 530], after(5, 0.1), -1, 1, 1),
  mk([700, 404, 1060, 404], after(3, 0.1), -1, 1, 1),
  mk([660, 440, 660, 500, 740, 500], after(4, 0.1), -1, 1, 1),
  mk([500, 300, 540, 300, 540, 250], after(1, 0.2), -1, 1, 1),
];

const rng = mulberry32(3445057433);

// Short stubs with dot terminals hanging off the routes.
export const STUBS = Array.from({ length: 26 }, () => {
  const r = rng() < 0.5 ? ROUTES[Math.floor(rng() * ROUTES.length)] : LOOPS[Math.floor(rng() * LOOPS.length)];
  const seg = Math.floor(rng() * (r.pts.length / 2 - 1));
  const u = 0.25 + rng() * 0.5;
  const ax = r.pts[seg * 2] + (r.pts[seg * 2 + 2] - r.pts[seg * 2]) * u;
  const ay = r.pts[seg * 2 + 1] + (r.pts[seg * 2 + 3] - r.pts[seg * 2 + 1]) * u;
  const horiz = Math.abs(r.pts[seg * 2 + 2] - r.pts[seg * 2]) > 0.5;
  const L = 12 + rng() * 26;
  const s = rng() < 0.5 ? -1 : 1;
  return { x0: ax, y0: ay, x1: horiz ? ax : ax + s * L, y1: horiz ? ay + s * L : ay, t: r.t0 + 0.6 + rng() * 1.5, ink: (rng() < 0.3 ? 1 : 0) as 0 | 1 };
});

export type Panel = { x: number; y: number; w: number; h: number; kind: number; ink: 0 | 1; t: number; seed: number };
// kind: 0 text lines, 1 numbers + bars, 2 vertical bars, 3 label + bar, 4 waveform, 5 text block (no frame)
export const PANELS: Panel[] = [
  [660, 40, 76, 46, 0], [372, 124, 60, 40, 5], [86, 250, 48, 56, 2], [440, 212, 76, 24, 3],
  [664, 148, 74, 46, 2], [840, 236, 70, 52, 5], [972, 268, 30, 84, 2], [1040, 470, 76, 40, 5],
  [680, 574, 52, 52, 0], [172, 444, 86, 22, 1], [975, 515, 70, 28, 5], [748, 290, 80, 26, 0],
  [258, 88, 52, 34, 5], [492, 450, 50, 24, 5], [470, 415, 64, 30, 0], [700, 580, 60, 30, 5],
  [400, 150, 60, 30, 0], [520, 250, 66, 26, 5], [880, 285, 60, 40, 0],
  [320, 228, 66, 22, 5], [760, 180, 56, 26, 5], [470, 520, 60, 30, 0],
].map(([x, y, w, h, kind], i) => ({ x, y, w, h, kind, ink: (i % 5 === 1 || i % 7 === 3 ? 1 : 0) as 0 | 1, t: 2.2 + (i % 12) * 0.38 + rng() * 0.3, seed: Math.floor(rng() * 1e6) }));

// Small HUD gauges (ticked rings with an arc).
export const RADARS = [[185, 290, 35], [418, 240, 38], [810, 260, 25]].map(([x, y, r]) => ({ x, y, r, t: 2.8 }));
export const KNOBS = { x: 330, y: 340, n: 5, gap: 22, t: 3.4 };
export const DIALS = [
  [700, 262, 14], [810, 262, 12], [140, 200, 18],
  [1110, 240, 11], [930, 612, 15], [252, 380, 13], [770, 352, 12],
].map(([x, y, r]) => ({ x, y, r, t: 2.5 + rng() * 4, phase: rng() }));

// Rows of small round buttons, square icon rows, crosshairs.
export const BUTTON_ROWS = [
  { x: 905, y: 440, n: 6, r: 14, gap: 38 },
  { x: 780, y: 190, n: 3, r: 9, gap: 32 },
  { x: 540, y: 140, n: 3, r: 5, gap: 22 },
].map((b) => ({ ...b, t: 3 + rng() * 3 }));
export const SQUARE_ROWS = [
  { x: 180, y: 420, n: 5, s: 9, gap: 20 },
  { x: 1040, y: 530, n: 4, s: 8, gap: 16 },
].map((b) => ({ ...b, t: 3 + rng() * 3 }));
export const CROSSES = [[270, 357], [895, 365]].map(([x, y]) => ({ x, y, t: 3 + rng() * 3 }));
export const TRIANGLE = { x: 490, y: 150, s: 26, t: 3.2 };
export const SLIDER = { x: 100, y: 312, w: 46, h: 46, t: 3.6 };
export const READOUTS = [
  { x: 700, y: 438, s: "2736.197", t: 4.2 },
  { x: 742, y: 395, s: "49", t: 4.4, box: true },
  { x: 672, y: 160, s: "SAT", t: 4.0 },
];
export const ELEMENTS = { x: 290, y: 568, w: 210, t: 4.6 };
