import { mulberry32, pickWeighted, Rng } from "../lib/rng";

// ---------------------------------------------------------------------------------------
// Gear layout: ~120 gears in 6 depth layers, each layer filled with seeded meshing chains.
// Pure data, built once at module level from a fixed seed.
// ---------------------------------------------------------------------------------------

export const TOOTH_COUNTS = [12, 15, 20, 24, 30, 40, 60, 120] as const; // all divide 120
export const LAYERS = 6;
export const LAYER_SPACING = 1.5;
export const LAYER_Z = (l: number) => -LAYER_SPACING * l;
// Gears per layer (total 120). The near and focus layers are kept sparse so the frame keeps
// the black gaps of the references; the far layers carry more, smaller-on-screen gears.
const LAYER_COUNTS = [7, 16, 17, 22, 28, 30];

// Camera path (see NeonGears.tsx) — used here to size each layer's region.
export const CAM_Z0 = 3.4;
export const CAM_PUSH = 2.0;
export const CAM_DRIFT_X = 3.0;
export const CAM_DRIFT_Y = 1.2;
export const FOV_DEG = 45;
const SPREAD = 1.45;
export const FOCUS_REF = CAM_Z0 + 2.25; // average focus distance (between layers 2 and 3)

export type GearStyle = "spoked" | "web" | "pinion" | "ring";

export type Gear = {
  layer: number;
  x: number;
  y: number;
  N: number;
  m: number; // module: pitch radius = m * N / 2
  dir: 1 | -1;
  phase: number; // angle at frame 0
  style: GearStyle;
  spokes: number;
  cutouts: number;
  colorIndex: number; // into the palette list (2B mixes per gear)
  brightness: number; // per-gear intensity spread (some gears burn hotter)
  seed: number;
};

const toothWeights: (readonly [number, number])[] = [
  [12, 1.4],
  [15, 1.3],
  [20, 1.4],
  [24, 1.2],
  [30, 1.2],
  [40, 1.1],
  [60, 1.2],
  [120, 0.3],
];

const pitchR = (g: { N: number; m: number }) => (g.m * g.N) / 2;
export const tipR = (g: { N: number; m: number }) => pitchR(g) + g.m;

const styleFor = (rng: Rng, N: number): GearStyle => {
  if (N <= 15) return rng() < 0.75 ? "pinion" : "ring";
  if (N <= 24) return rng() < 0.5 ? "web" : rng() < 0.5 ? "pinion" : "spoked";
  if (N <= 40) return rng() < 0.6 ? "spoked" : "web";
  return rng() < 0.85 ? "spoked" : "web";
};

// Meshing phase: with A's tooth fraction uA at the contact direction theta, B must present
// a gap there: uA + uB = 0.5 (mod 1). Both gears then keep meshing for all t because every
// gear advances exactly the same number of teeth per loop.
const meshPhase = (a: Gear, theta: number, Nb: number) => {
  const uA = ((((theta - a.phase) * a.N) / (Math.PI * 2)) % 1 + 1) % 1;
  return theta + Math.PI - ((0.5 - uA) * Math.PI * 2) / Nb;
};

const buildLayout = (): Gear[] => {
  const rng = mulberry32(0x6ea25);
  const gears: Gear[] = [];
  const tanH = Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
  for (let l = 0; l < LAYERS; l++) {
    const z = LAYER_Z(l);
    const dMax = CAM_Z0 + CAM_PUSH - z;
    const hh = dMax * tanH;
    const hw = hh * (16 / 9);
    // Visible rectangle swept by the roll, plus the lateral drift.
    const rv = Math.hypot(hw, hh);
    // Spread wider than strictly needed so the frame keeps black gaps between chains.
    const RX = (rv + CAM_DRIFT_X) * SPREAD;
    const RY = (rv + CAM_DRIFT_Y) * SPREAD;
    const scale = (CAM_Z0 - z) / FOCUS_REF; // keep screen-space gear size similar per layer
    const layerGears: Gear[] = [];
    const target = LAYER_COUNTS[l];
    const fits = (x: number, y: number, r: number, except?: Gear) => {
      if ((x / RX) ** 2 + (y / RY) ** 2 > 1.15) return false;
      for (const o of layerGears) {
        if (o === except) continue;
        if (Math.hypot(o.x - x, o.y - y) < tipR(o) + r + 0.04 * scale) return false;
      }
      return true;
    };
    let attempts = 0;
    while (layerGears.length < target && attempts < 4000) {
      attempts++;
      // Start a chain.
      const m = (0.065 + rng() * 0.09) * scale;
      const N0 = pickWeighted(rng, toothWeights);
      const a = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng());
      const x = Math.cos(a) * rr * RX;
      const y = Math.sin(a) * rr * RY;
      if (!fits(x, y, (m * N0) / 2 + m)) continue;
      const root: Gear = {
        layer: l,
        x,
        y,
        N: N0,
        m,
        dir: rng() < 0.5 ? 1 : -1,
        phase: rng() * Math.PI * 2,
        style: styleFor(rng, N0),
        spokes: rng() < 0.5 ? 5 : 6,
        cutouts: 3 + Math.floor(rng() * 4),
        colorIndex: Math.floor(rng() * 4),
        brightness: 0.6 + rng() * 0.8,
        seed: Math.floor(rng() * 1e9),
      };
      layerGears.push(root);
      const chain = [root];
      const chainLen = 3 + Math.floor(rng() * 5);
      let tries = 0;
      while (chain.length < chainLen && tries < 60 && layerGears.length < target) {
        tries++;
        const parent = chain[Math.floor(rng() * chain.length)];
        const N = pickWeighted(rng, toothWeights);
        const theta = rng() * Math.PI * 2;
        const dist = pitchR(parent) + (m * N) / 2;
        const cx = parent.x + Math.cos(theta) * dist;
        const cy = parent.y + Math.sin(theta) * dist;
        // Only the parent may touch (they mesh); everyone else must be clear.
        if (!fits(cx, cy, (m * N) / 2 + m, parent)) continue;
        const child: Gear = {
          layer: l,
          x: cx,
          y: cy,
          N,
          m,
          dir: (-parent.dir) as 1 | -1,
          phase: meshPhase(parent, theta, N),
          style: styleFor(rng, N),
          spokes: rng() < 0.5 ? 5 : 6,
          cutouts: 3 + Math.floor(rng() * 4),
          colorIndex: Math.floor(rng() * 4),
          brightness: 0.6 + rng() * 0.8,
          seed: Math.floor(rng() * 1e9),
        };
        // Children of the parent must also clear the parent's other mesh partners.
        layerGears.push(child);
        chain.push(child);
      }
    }
    gears.push(...layerGears);
  }
  return gears;
};

export const GEARS: Gear[] = buildLayout();

// Angle at loop phase t: every gear advances exactly 120 teeth per loop, i.e. 120/N turns.
export const gearAngle = (g: Gear, t: number) => g.phase + g.dir * Math.PI * 2 * (120 / g.N) * t;
