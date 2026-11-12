// Abstract graffiti mark generators. Everything here is shapes: X's,
// zigzags, rings, loops, arches, letter-like squiggles that never spell
// anything, stars, arrows, hearts, crowns, smiley circles, splats, dots.

import type { Pt } from "../lib/math";
import { catmull, pathLength } from "../lib/path";
import type { Rand } from "../lib/rng";
import type { GraffitiPalette } from "./palettes";

export type StrokeKind = "spray" | "marker" | "pen" | "mist" | "splat" | "poly" | "dots";
export type Stroke = { kind: StrokeKind; pts: Pt[]; w: number; color: string };
export type Drip = { x: number; y: number; len: number; w: number; color: string; speed: number; wob: number };
export type Mark = {
  layer: number;
  strokes: Stroke[];
  bbox: [number, number, number, number];
  res: number; // cache resolution factor (washes are blurry -> low res)
  drips: Drip[];
  cx: number;
  cy: number;
};

const rot = (p: Pt, a: number): Pt => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const place = (pts: Pt[], cx: number, cy: number, a: number): Pt[] => pts.map((p) => {
  const q = rot(p, a);
  return [q[0] + cx, q[1] + cy] as Pt;
});

const bent = (r: Rand, a: Pt, b: Pt, bend: number, n = 4): Pt[] => {
  const out: Pt[] = [];
  const nx = -(b[1] - a[1]);
  const ny = b[0] - a[0];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k = Math.sin(t * Math.PI) * bend + r.range(-0.015, 0.015);
    out.push([a[0] + (b[0] - a[0]) * t + nx * k, a[1] + (b[1] - a[1]) * t + ny * k]);
  }
  return out;
};

const ring = (r: Rand, rx: number, ry: number, turns = 1.12, n = 22, wob = 0.08): Pt[] => {
  const out: Pt[] = [];
  const a0 = r.range(0, Math.PI * 2);
  const m = Math.round(n * turns);
  for (let i = 0; i <= m; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const k = 1 + r.range(-wob, wob) + (i / m) * 0.08;
    out.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  return out;
};

const starPts = (r: Rand, R: number, spikes = 5): Pt[] => {
  const out: Pt[] = [];
  const a0 = -Math.PI / 2 + r.range(-0.3, 0.3);
  for (let i = 0; i <= spikes * 2; i++) {
    const a = a0 + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? R * r.range(0.9, 1.1) : R * r.range(0.38, 0.5);
    out.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return out;
};

const heartPts = (S: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    out.push([(x / 17) * S, (y / 17) * S]);
  }
  return out;
};

// Letter-like squiggle that is deliberately not any letter: random humps,
// loops and bars joined into one or two cursive runs, plus a swoosh.
const tagRuns = (r: Rand, h: number): Pt[][] => {
  const runs: Pt[][] = [];
  let run: Pt[] = [[0, 0]];
  let x = 0;
  const n = r.int(3, 6);
  for (let g = 0; g < n; g++) {
    const gw = h * r.range(0.35, 0.75);
    const hh = h * r.range(0.7, 1.25);
    const t = r.int(0, 6);
    if (t === 0) {
      // tight scribble knot
      for (let q = 0; q < 4; q++) run.push([x + gw * r.range(0, 1), -hh * r.range(0.1, 0.9)]);
    } else if (t === 1) {
      // loop up
      run.push([x + gw * 0.6, -hh * 0.8], [x + gw * 0.1, -hh * 0.9], [x + gw * 0.4, 0], [x + gw, -hh * 0.15]);
    } else if (t === 2) {
      // double hump
      run.push([x + gw * 0.25, -hh * 0.6], [x + gw * 0.45, 0], [x + gw * 0.7, -hh * 0.6], [x + gw, 0]);
    } else if (t === 3) {
      // sharp zig
      run.push([x + gw * 0.3, -hh], [x + gw * 0.55, -hh * 0.1], [x + gw * 0.9, -hh * 0.95], [x + gw, 0]);
    } else if (t === 4) {
      // open hook (kept away from digit-like closed s / 8 shapes)
      run.push([x + gw * 0.15, -hh * 0.75], [x + gw * 0.7, -hh * 1.0], [x + gw * 0.55, -hh * 0.2], [x + gw, 0]);
    } else {
      // jagged scrawl
      run.push([x + gw * 0.3, -hh * 0.4], [x + gw * 0.45, -hh * 1.05], [x + gw * 0.8, -hh * 0.2]);
    }
    // glyphs crowd and overlap so the run never reads as letters
    x += gw * r.range(0.45, 0.7);
  }
  runs.push(run);
  // swoosh underline
  runs.push([
    [-h * 0.3, h * 0.25],
    [x * 0.5, h * 0.4],
    [x + h * 0.3, h * 0.1],
    [x + h * 0.45, -h * 0.3],
  ]);
  const slant = r.range(-0.45, 0.25);
  const wob = r.range(0.05, 0.16) * h;
  return runs
    .filter((q) => q.length > 1)
    .map((q) => q.map(([px, py]) => [px - x / 2 - py * slant, py + h * 0.4 + Math.sin(px * 0.02) * wob] as Pt));
};

export type Gen = (r: Rand, cx: number, cy: number, S: number, pal: GraffitiPalette) => Stroke[];

export const GENS: Record<string, Gen> = {
  // ---- big spray marks
  X: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.spray);
    const a = r.range(-0.3, 0.3);
    const w = S * r.range(0.24, 0.3);
    const s1 = place(bent(r, [-S * 0.45, -S * 0.5], [S * 0.4, S * 0.5], r.range(-0.08, 0.08)), cx, cy, a);
    const s2 = place(bent(r, [S * 0.45, -S * 0.48], [-S * 0.42, S * 0.52], r.range(-0.08, 0.08)), cx, cy, a);
    return [
      { kind: "spray", pts: s1, w, color: col },
      { kind: "spray", pts: s2, w: w * 0.92, color: col },
    ];
  },
  zigzag: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.spray);
    const n = r.int(4, 7);
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) pts.push([(i / (n - 1) - 0.5) * S * 1.3, (i % 2 ? 0.3 : -0.3) * S + r.range(-0.08, 0.08) * S]);
    return [{ kind: "spray", pts: place(pts, cx, cy, r.range(-0.5, 0.5)), w: S * r.range(0.09, 0.13), color: col }];
  },
  ring: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.spray);
    const out: Stroke[] = [
      { kind: "spray", pts: place(ring(r, S * 0.45, S * r.range(0.38, 0.5)), cx, cy, r.range(0, 3)), w: S * r.range(0.15, 0.2), color: col },
    ];
    if (r.chance(0.5)) out.push({ kind: "spray", pts: place(ring(r, S * 0.16, S * 0.15), cx + r.range(-0.08, 0.08) * S, cy, 0), w: S * 0.08, color: r.pick(pal.spray) });
    return out;
  },
  loop: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.spray);
    const pts: Pt[] = [];
    const n = r.int(3, 5);
    for (let i = 0; i <= n * 8; i++) {
      const t = i / 8;
      const a = t * Math.PI * 2;
      const k = 0.6 + 0.8 * Math.abs(Math.sin(t * 1.7 + n));
      pts.push([(t / n - 0.5) * S * 1.4 + Math.cos(a + Math.PI) * S * 0.2 * k, Math.sin(a) * S * 0.3 * k + Math.sin(t * 2.3) * S * 0.12]);
    }
    return [{ kind: "spray", pts: place(pts, cx, cy, r.range(-0.4, 0.4)), w: S * r.range(0.06, 0.09), color: col }];
  },
  arch: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.spray);
    const out: Stroke[] = [];
    const n = r.int(2, 4);
    for (let k = 0; k < n; k++) {
      const x0 = (k / n - 0.5) * S * 1.1;
      out.push({
        kind: "spray",
        pts: place([[x0, S * 0.35], [x0 + S * 0.05, -S * 0.25], [x0 + S * 0.2, -S * 0.32], [x0 + S * 0.3, S * 0.3]], cx, cy, r.range(-0.2, 0.2)),
        w: S * r.range(0.08, 0.11),
        color: col,
      });
    }
    return out;
  },
  bigTri: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.spray);
    const pts = place([[-S * 0.45, S * 0.35], [0, -S * 0.45], [S * 0.45, S * 0.3], [-S * 0.5, S * 0.38]], cx, cy, r.range(-0.6, 0.6));
    return [{ kind: "spray", pts, w: S * 0.08, color: col }];
  },
  // ---- heavy dry brush
  brush: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.brush);
    const a = r.range(-0.9, 0.9);
    const out: Stroke[] = [];
    const n = r.int(1, 4);
    for (let k = 0; k < n; k++) {
      out.push({
        kind: "marker",
        pts: place(bent(r, [-S * 0.5, k * S * 0.18], [S * 0.5, k * S * 0.18 + r.range(-0.1, 0.1) * S], r.range(-0.12, 0.12), 5), cx, cy, a),
        w: S * r.range(0.08, 0.14),
        color: col,
      });
    }
    return out;
  },
  // ---- tags
  tag: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.marker);
    const w = S * r.range(0.07, 0.12);
    const a = r.range(-0.25, 0.25);
    return tagRuns(r, S * 0.55).map((run) => ({ kind: "marker" as StrokeKind, pts: place(run, cx, cy, a), w, color: col }));
  },
  // ---- symbols
  star: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.symbol);
    const pts = place(starPts(r, S * 0.5), cx, cy, r.range(-0.3, 0.3));
    return r.chance(0.4) ? [{ kind: "poly", pts, w: 0, color: col }] : [{ kind: "marker", pts, w: S * 0.06, color: col }];
  },
  arrow: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.symbol);
    const a = r.range(0, Math.PI * 2);
    const shaft = place(bent(r, [-S * 0.5, 0], [S * 0.45, 0], r.range(-0.25, 0.25), 6), cx, cy, a);
    const tip = shaft[shaft.length - 1];
    const prev = shaft[shaft.length - 2];
    const da = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
    const head: Pt[] = [
      [tip[0] + Math.cos(da + 2.5) * S * 0.25, tip[1] + Math.sin(da + 2.5) * S * 0.25],
      tip,
      [tip[0] + Math.cos(da - 2.5) * S * 0.25, tip[1] + Math.sin(da - 2.5) * S * 0.25],
    ];
    const w = S * 0.06;
    return [
      { kind: "marker", pts: shaft, w, color: col },
      { kind: "marker", pts: head, w, color: col },
    ];
  },
  heart: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.symbol);
    const pts = place(heartPts(S * 0.45), cx, cy, r.range(-0.4, 0.4));
    return r.chance(0.45) ? [{ kind: "poly", pts, w: 0, color: col }] : [{ kind: "marker", pts, w: S * 0.06, color: col }];
  },
  bolt: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.symbol);
    const pts = place([[S * 0.1, -S * 0.5], [-S * 0.2, S * 0.05], [S * 0.05, S * 0.02], [-S * 0.12, S * 0.5], [S * 0.25, -S * 0.08], [0, -S * 0.04], [S * 0.18, -S * 0.5]], cx, cy, r.range(-0.4, 0.4));
    return [{ kind: r.chance(0.5) ? "poly" : "marker", pts, w: S * 0.05, color: col }];
  },
  smiley: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.symbol);
    const w = S * 0.055;
    const R = S * 0.42;
    const mouth: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = 0.2 + (i / 8) * 0.6;
      mouth.push([cx + Math.cos(t * Math.PI) * R * 0.55 * -1, cy + R * 0.15 + Math.sin(t * Math.PI) * R * 0.38]);
    }
    return [
      { kind: "marker", pts: place(ring(r, R, R * r.range(0.9, 1.05), 1.05, 20, 0.05), cx, cy, 0), w, color: col },
      { kind: "dots", pts: [[cx - R * 0.33, cy - R * 0.2], [cx + R * 0.3, cy - R * 0.22]], w: S * 0.06, color: col },
      { kind: "marker", pts: mouth, w, color: col },
    ];
  },
  target: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.symbol);
    return [
      { kind: "marker", pts: place(ring(r, S * 0.45, S * 0.42), cx, cy, 0), w: S * 0.06, color: col },
      { kind: "marker", pts: place(ring(r, S * 0.25, S * 0.24), cx, cy, 0), w: S * 0.06, color: r.pick(pal.symbol) },
      { kind: "dots", pts: [[cx, cy]], w: S * 0.09, color: col },
    ];
  },
  splat: (r, cx, cy, S, pal) => [{ kind: "splat", pts: [[cx, cy]], w: S * 0.3, color: r.pick(pal.splat) }],
  speckle: (r, cx, cy, S, pal) => {
    const out: Stroke[] = [];
    for (let c = 0; c < 3; c++) {
      const col = r.pick(pal.splat);
      const pts: Pt[] = [];
      const n = r.int(25, 60);
      for (let i = 0; i < n; i++) pts.push([cx + r.gauss() * S * 0.5, cy + r.gauss() * S * 0.4]);
      out.push({ kind: "dots", pts, w: r.range(3, 7), color: col });
    }
    return out;
  },
  dots: (r, cx, cy, S, pal) => {
    const col = r.pick(pal.splat);
    const pts: Pt[] = [];
    const n = r.int(4, 12);
    for (let i = 0; i < n; i++) pts.push([cx + r.gauss() * S * 0.35, cy + r.gauss() * S * 0.35]);
    return [{ kind: "dots", pts, w: S * r.range(0.03, 0.07), color: col }];
  },
  // ---- thin pen doodles
  penBrush: (r, cx, cy, S, pal) => {
    const pts: Pt[] = [];
    const n = r.int(4, 7);
    for (let i = 0; i < n; i++) pts.push([(i / (n - 1) - 0.5) * S + r.range(-0.1, 0.1) * S, r.range(-0.35, 0.35) * S]);
    return [{ kind: "marker", pts: place(pts, cx, cy, r.range(-0.6, 0.6)), w: r.range(30, 60), color: pal.pen }];
  },
  penScribble: (r, cx, cy, S, pal) => {
    const pts: Pt[] = [];
    const n = r.int(10, 20);
    let x = -S * 0.5;
    for (let i = 0; i < n; i++) {
      x += (S / n) * r.range(0.6, 1.6);
      pts.push([x, r.range(-0.3, 0.3) * S]);
    }
    return [{ kind: "pen", pts: place(pts, cx, cy, r.range(-0.5, 0.5)), w: r.range(8, 20), color: pal.pen }];
  },
  penStar: (r, cx, cy, S, pal) => [{ kind: "pen", pts: place(starPts(r, S * 0.45), cx, cy, r.range(-0.4, 0.4)), w: r.range(8, 13), color: pal.pen }],
  penRing: (r, cx, cy, S, pal) => [{ kind: "pen", pts: place(ring(r, S * 0.45, S * r.range(0.25, 0.45), r.range(1.1, 2.4), 20, 0.12), cx, cy, r.range(0, 3)), w: r.range(7, 12), color: pal.pen }],
  penSwoosh: (r, cx, cy, S, pal) => [{ kind: "pen", pts: place([[-S * 0.6, S * 0.2], [-S * 0.1, -S * 0.25], [S * 0.3, S * 0.1], [S * 0.6, -S * 0.3], [S * 0.5, -S * 0.45]], cx, cy, r.range(-0.6, 0.6)), w: r.range(8, 14), color: pal.pen }],
  penCross: (r, cx, cy, S, pal) => {
    const a = r.range(0, 1);
    return [
      { kind: "pen", pts: place([[-S * 0.35, -S * 0.35], [S * 0.35, S * 0.35]], cx, cy, a), w: r.range(8, 13), color: pal.pen },
      { kind: "pen", pts: place([[S * 0.35, -S * 0.35], [-S * 0.35, S * 0.35]], cx, cy, a), w: r.range(8, 13), color: pal.pen },
    ];
  },
  penSun: (r, cx, cy, S, pal) => {
    const out: Stroke[] = [{ kind: "pen", pts: place(ring(r, S * 0.22, S * 0.22, 1.1, 16, 0.08), cx, cy, 0), w: 9, color: pal.pen }];
    const n = r.int(6, 10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push({ kind: "pen", pts: [[cx + Math.cos(a) * S * 0.32, cy + Math.sin(a) * S * 0.32], [cx + Math.cos(a) * S * 0.5, cy + Math.sin(a) * S * 0.5]], w: 8, color: pal.pen });
    }
    return out;
  },
  penTri: (r, cx, cy, S, pal) => [{ kind: "pen", pts: place([[-S * 0.4, S * 0.3], [0, -S * 0.42], [S * 0.42, S * 0.32], [-S * 0.45, S * 0.28], [-S * 0.2, 0]], cx, cy, r.range(-0.5, 0.5)), w: r.range(9, 14), color: pal.pen }],
  penSpiral: (r, cx, cy, S, pal) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = t * Math.PI * 2 * 2.6;
      pts.push([Math.cos(a) * S * 0.5 * t, Math.sin(a) * S * 0.5 * t]);
    }
    return [{ kind: "pen", pts: place(pts, cx, cy, r.range(0, 3)), w: r.range(7, 12), color: pal.pen }];
  },
};

export const bboxOf = (strokes: Stroke[]): [number, number, number, number] => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const st of strokes) {
    const m =
      st.kind === "splat" ? st.w * 3.4 : st.kind === "mist" ? st.w * 1.6 : st.kind === "spray" ? st.w * 1.9 : st.kind === "poly" ? 12 : st.w * 2 + 10;
    for (const [x, y] of st.pts) {
      x0 = Math.min(x0, x - m);
      y0 = Math.min(y0, y - m);
      x1 = Math.max(x1, x + m);
      y1 = Math.max(y1, y + m);
    }
  }
  return [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)];
};

export const dripsFor = (r: Rand, strokes: Stroke[], density: number): Drip[] => {
  const out: Drip[] = [];
  for (const st of strokes) {
    if (st.kind !== "spray" && st.kind !== "mist" && !(st.kind === "marker" && st.w > 30)) continue;
    const pts = catmull(st.pts, 6);
    const L = pathLength(pts);
    const n = r.chance(density > 1 ? 0.9 : 0.5) ? Math.round((L / (density > 1 ? 300 : 520)) * Math.min(1.5, density) * (st.kind === "mist" ? 0.5 : 1)) : 0;
    for (let i = 0; i < n; i++) {
      const p = pts[r.int(0, pts.length)];
      const w = Math.max(7, Math.min(34, st.w * (st.kind === "mist" ? r.range(0.04, 0.07) : r.range(0.1, 0.22))));
      out.push({
        x: p[0] + r.range(-0.3, 0.3) * st.w,
        y: p[1] + st.w * (st.kind === "mist" ? 0.25 : 0.32),
        len: r.range(120, 640) * Math.sqrt(Math.max(0.3, st.w / 100)),
        w,
        color: st.color,
        speed: r.range(3, 7),
        wob: r.range(-4, 4),
      });
    }
  }
  return out;
};
