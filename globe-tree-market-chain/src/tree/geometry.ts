import { hash01, mulberry32 } from "../lib/random";
import { TreeVersion } from "../versions";

// Circuit tree geometry, generated once at module level from fixed seeds.
export const W = 3840;
export const H = 2160;
export const BASE = { x: 1920, y: 2050 };
export const GROW_END = 240; // growth finishes at this frame
export const HOLD = 360; // frames 240..600 loop on themselves

export type Trace = {
  d: string;
  len: number;
  t0: number; // frame the trace starts drawing
  t1: number; // frame it is complete
  width: number;
  end: [number, number];
  pad: number; // 0 none, 1 normal, 2 pink
  bends: [number, number][];
  pulse: { period: number; off: number } | null;
};

const DIRS = [-2, -1, 0, 1, 2].map((h) => [Math.sin((h * Math.PI) / 4), -Math.cos((h * Math.PI) / 4)]);
const dir = (h: number) => DIRS[Math.max(-2, Math.min(2, h)) + 2];

type Raw = { pts: [number, number][]; d0: number; depth: number; width: number };

const generate = () => {
  const rnd = mulberry32(8128);
  const raws: Raw[] = [];
  const inCanopy = (x: number, y: number) => {
    const dx = (x - 1920) / 900;
    const dy = (y - 1130) / 700;
    return dx * dx + dy * dy < 1;
  };
  const grow = (x: number, y: number, h: number, len: number, depth: number, d0: number, width: number) => {
    const pts: [number, number][] = [[x, y]];
    let px = x;
    let py = y;
    let dist = 0;
    const side = h === 0 ? (rnd() < 0.5 ? -1 : 1) : Math.sign(h);
    const plan: [number, number][] = [
      [h, len * (0.3 + rnd() * 0.25)],
      [h + side * (rnd() < 0.6 ? 1 : -1), len * (0.2 + rnd() * 0.25)],
      [Math.abs(h) === 2 ? h - side : 0, len * (0.25 + rnd() * 0.3)],
    ];
    for (const [hh, l] of plan) {
      const [dx, dy] = dir(hh);
      const nx = px + dx * l;
      const ny = py + dy * l;
      if (!inCanopy(nx, ny) && depth > 0) break;
      px = nx;
      py = ny;
      dist += l;
      pts.push([Math.round(px), Math.round(py)]);
    }
    if (pts.length < 2) return;
    raws.push({ pts, d0, depth, width });
    const endH = Math.abs(h) === 2 ? h - side : 0;
    if (depth < 6 && len > 100) {
      const kids = depth < 2 ? 3 : 2;
      const opts = kids === 3 ? [endH - 1, endH, endH + 1] : [endH - 1, endH + 1];
      for (const nh of opts) {
        if (rnd() < 0.1 * depth) continue;
        grow(px, py, Math.max(-2, Math.min(2, nh)), len * (0.66 + rnd() * 0.12), depth + 1, d0 + dist, Math.max(3, width * 0.82));
      }
    }
  };
  // trunk: a bus of parallel traces rising from the base pad
  const lanes = 9;
  for (let i = 0; i < lanes; i++) {
    const off = (i - (lanes - 1) / 2) * 26;
    const x = BASE.x + off;
    const trunkTop = BASE.y - 330 - Math.abs(off) * 2.2;
    raws.push({ pts: [[x, BASE.y - 20], [x, trunkTop]], d0: 0, depth: 0, width: 7 });
    const hh = [-2, -1, -1, 0, 0, 0, 1, 1, 2][i];
    grow(x, trunkTop, hh, 520 + rnd() * 120, 1, BASE.y - 20 - trunkTop, 6);
  }
  // roots: short traces spreading below the pad
  const roots: string[] = [];
  for (let i = 0; i < 12; i++) {
    const s = i < 6 ? -1 : 1;
    const k = i % 6;
    const x0 = BASE.x + s * (20 + k * 18);
    const y0 = BASE.y + 10;
    const x1 = x0 + s * (40 + k * 46);
    const y1 = y0 + 30 + k * 6;
    roots.push(`M${x0},${y0} L${x0 + s * 20},${y0 + 20} L${x1},${y1} L${x1 + s * 60},${y1}`);
  }
  const maxD = Math.max(...raws.map((r) => r.d0 + polyLen(r.pts)));
  const speed = maxD / 200; // px per frame -> everything drawn by frame ~205
  const traces: Trace[] = raws.map((r, idx) => {
    const len = polyLen(r.pts);
    const t0 = 4 + r.d0 / speed;
    const t1 = t0 + len / speed;
    const leaf = !raws.some((o) => o !== r && o.d0 > r.d0 && near(o.pts[0], r.pts[r.pts.length - 1]));
    const p = hash01(idx, 11);
    return {
      d: "M" + r.pts.map((q) => q.join(",")).join(" L"),
      len,
      t0,
      t1,
      width: r.width,
      end: r.pts[r.pts.length - 1],
      pad: leaf || p < 0.2 ? (p < 0.32 ? 2 : 1) : 0,
      bends: r.pts.slice(1, -1),
      pulse: hash01(idx, 5) < 0.4 ? { period: [90, 120, 180][Math.floor(hash01(idx, 6) * 3)], off: Math.floor(hash01(idx, 7) * 180) } : null,
    };
  });
  return { traces, roots, speed };
};

const polyLen = (p: [number, number][]) => {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return l;
};
const near = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1;

export const TREE = generate();

// ---------- canopy icons ----------
export type Icon = {
  x: number;
  y: number;
  s: number;
  shape: number; // 0 heart 1 circle 2 plus 3 leaf 4 diamond
  color: number;
  rot: number;
  t: number; // appear frame
  tw: { k: number; ph: number; amp: number };
  drift: { period: number; off: number; rise: number; sway: number } | null;
};

export const makeIcons = (v: TreeVersion): Icon[] => {
  const rnd = mulberry32(31337);
  const icons: Icon[] = [];
  const total = v.iconWeights.reduce((a, b) => a + b, 0);
  const pickShape = () => {
    let r = rnd() * total;
    for (let i = 0; i < 5; i++) {
      r -= v.iconWeights[i];
      if (r <= 0) return i;
    }
    return 1;
  };
  const tips = TREE.traces.filter((t) => t.pad > 0 && t.end[1] < 1750);
  const add = (x: number, y: number, t: number) => {
    const isDrift = rnd() < 0.12;
    icons.push({
      x,
      y,
      s: 16 + Math.pow(rnd(), 2) * 30,
      shape: pickShape(),
      color: Math.floor(rnd() * v.canopy.length),
      rot: (rnd() - 0.5) * 50,
      t: Math.min(GROW_END - 12, t),
      tw: { k: 1 + Math.floor(rnd() * 3), ph: rnd() * Math.PI * 2, amp: 0.25 + rnd() * 0.45 },
      drift: isDrift
        ? { period: [120, 180, 360][Math.floor(rnd() * 3)], off: Math.floor(rnd() * 360), rise: 160 + rnd() * 320, sway: 10 + rnd() * 30 }
        : null,
    });
  };
  for (const tip of tips) {
    const n = 7 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 30 + Math.sqrt(rnd()) * 140;
      add(tip.end[0] + Math.cos(a) * r, tip.end[1] + Math.sin(a) * r * 0.85, tip.t1 + 6 + rnd() * 30);
    }
  }
  // fill the crown
  for (let i = 0; i < 300; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    const x = 1920 + Math.cos(a) * r * 960;
    const y = 1080 + Math.sin(a) * r * 560;
    if (y > 1720) continue;
    add(x, y, 150 + rnd() * 80);
  }
  return icons;
};

// unit icons (drawn in a 1x1 box centred on 0,0)
export const ICON_PATHS = [
  // heart
  "M0,0.38 C-0.55,0 -0.5,-0.42 -0.25,-0.42 C-0.1,-0.42 0,-0.3 0,-0.2 C0,-0.3 0.1,-0.42 0.25,-0.42 C0.5,-0.42 0.55,0 0,0.38 Z",
  // circle (ring drawn with even-odd)
  "M0.45,0 A0.45,0.45 0 1 1 -0.45,0 A0.45,0.45 0 1 1 0.45,0 Z M0.25,0 A0.25,0.25 0 1 0 -0.25,0 A0.25,0.25 0 1 0 0.25,0 Z",
  // plus
  "M-0.12,-0.45 H0.12 V-0.12 H0.45 V0.12 H0.12 V0.45 H-0.12 V0.12 H-0.45 V-0.12 H-0.12 Z",
  // leaf
  "M-0.4,0.4 C-0.45,-0.2 -0.05,-0.45 0.45,-0.45 C0.45,0.05 0.2,0.45 -0.4,0.4 Z M-0.4,0.4 L0.2,-0.2",
  // diamond
  "M0,-0.5 L0.38,0 L0,0.5 L-0.38,0 Z",
];

// ---------- grass + dust ----------
export const GRASS = (() => {
  const rnd = mulberry32(4242);
  const blades: { x: number; h: number; lean: number; sway: number; k: number; ph: number; w: number; a: number }[] = [];
  for (let i = 0; i < 620; i++) {
    const x = rnd() * W;
    const edge = Math.min(1, Math.abs(x - 1920) / 1500);
    blades.push({
      x,
      h: (70 + rnd() * 220) * (0.45 + edge * 0.9),
      lean: (rnd() - 0.5) * 80,
      sway: 10 + rnd() * 26,
      k: rnd() < 0.7 ? 1 : 2,
      ph: rnd() * Math.PI * 2 + x * 0.002,
      w: 1.8 + rnd() * 2.2,
      a: 0.25 + rnd() * 0.5,
    });
  }
  return blades;
})();

export const DUST = (() => {
  const rnd = mulberry32(777);
  return Array.from({ length: 340 }, () => ({
    x: rnd() * W,
    y: rnd() * H * 0.9,
    r: 1.2 + rnd() * 2.6,
    a: 0.15 + rnd() * 0.45,
    k: 1 + Math.floor(rnd() * 2),
    ph: rnd() * Math.PI * 2,
  }));
})();
