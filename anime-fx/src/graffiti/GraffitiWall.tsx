import React, { useMemo } from "react";
import { drip, jitterPts, markerStroke, paintMass, penStroke, sprayStroke, splat } from "../lib/brush";
import { CanvasComp, DrawFn, makeCanvas } from "../lib/CanvasComp";
import { LOOP_DRAWINGS, loopDrawing } from "../lib/loop";
import { clamp, mod } from "../lib/math";
import { catmull, pathLength, smoothPath, truncatePath } from "../lib/path";
import { hash01, Rand } from "../lib/rng";
import { bboxOf, dripsFor, GENS, Mark, Stroke } from "./marks";
import { GRAFFITI_PALETTES, GraffitiPalette } from "./palettes";

// Replacement schedule: 7 events per 10 s loop, on even frames ~1.43 s apart
// (0, 42, 86, 128, 172, 214, 258), 3 marks swapped per event. Each swapped
// slot changes twice per loop (A -> B -> A) so the loop closes.
export const EVENT_DRAWINGS = Array.from({ length: 7 }, (_, k) => Math.round((k * LOOP_DRAWINGS) / 7));
const SPRAY_ON = [0.4, 0.75, 1]; // 3 drawings = 6 frames to spray a new mark on
const BOIL_VARIANTS = 2;

type Slot = { a: Mark; b: Mark | null; e1: number; e2: number };

const makeMark = (r: Rand, gen: string, layer: number, cx: number, cy: number, S: number, pal: GraffitiPalette): Mark => {
  const strokes = GENS[gen](r, cx, cy, S, pal);
  return {
    layer,
    strokes,
    bbox: bboxOf(strokes),
    res: 1,
    drips: dripsFor(r, strokes, layer <= 1 ? 1.1 : 0.5),
    cx,
    cy,
  };
};

const buildWall = (id: string, pal: GraffitiPalette, W: number, H: number) => {
  const r = new Rand(id, "wall");
  const slots: Slot[] = [];
  const push = (m: Mark) => slots.push({ a: m, b: null, e1: -1, e2: -1 });

  // L0 colour washes, mostly around the edges
  const washAnchors = [
    [0.1, 0.08], [0.55, 0.03], [0.88, 0.12], [0.03, 0.62], [0.97, 0.55],
    [0.2, 0.95], [0.66, 0.97], [0.42, 0.62], [0.3, 0.3], [0.75, 0.4], [0.55, 0.78],
  ];
  washAnchors.forEach(([ax, ay], i) => {
    if (pal.washAlpha < 0.5 && i % 2 === 1) return; // paper: half the washes
    const strokes: Stroke[] = [];
    const color = pal.wash[i % pal.wash.length];
    const n = r.int(2, 4);
    for (let k = 0; k < n; k++) {
      const cx = (ax + r.range(-0.05, 0.05)) * W;
      const cy = (ay + r.range(-0.05, 0.05)) * H;
      const a = r.range(-0.9, 0.9) + (r.chance(0.5) ? 0 : Math.PI / 2);
      const L = r.range(350, 800);
      strokes.push({
        kind: "mist",
        pts: [
          [cx - Math.cos(a) * L * 0.5, cy - Math.sin(a) * L * 0.5],
          [cx + r.range(-70, 70), cy + r.range(-70, 70)],
          [cx + Math.cos(a) * L * 0.5, cy + Math.sin(a) * L * 0.5],
        ],
        w: r.range(420, 700) * (i === 7 ? 0.8 : 1),
        color,
      });
    }
    const m: Mark = { layer: 0, strokes, bbox: bboxOf(strokes), res: 0.5, drips: dripsFor(r, strokes, 0.5), cx: ax * W, cy: ay * H };
    push(m);
  });

  // L1 big spray marks on a jittered 5x3 grid
  const bigKinds = ["X", "ring", "loop", "ring", "zigzag", "X", "bigTri", "ring", "loop", "X", "zigzag", "ring"];
  let k = 0;
  for (let gy = 0; gy < 3; gy++)
    for (let gx = 0; gx < 5; gx++) {
      if (k >= bigKinds.length) break;
      const cx = ((gx + 0.5) / 5 + r.range(-0.06, 0.06)) * W;
      const cy = ((gy + 0.5) / 3 + r.range(-0.1, 0.1)) * H;
      const mk = makeMark(r, bigKinds[k], 1, cx, cy, r.range(600, 1000) * (bigKinds[k] === "X" ? 1.35 : 1), pal);
      mk.drips = dripsFor(new Rand(id, "bigdrip", k), mk.strokes, 2);
      push(mk);
      k++;
    }
  // L2 heavy brush strokes
  for (let i = 0; i < 8; i++) push(makeMark(r, "brush", 2, r.range(0, W), r.range(0, H), r.range(420, 800), pal));
  // L3 tags on a 5x4 grid
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 5; gx++) {
      if (r.chance(0.5)) continue;
      push(makeMark(r, "tag", 3, ((gx + 0.5) / 5 + r.range(-0.07, 0.07)) * W, ((gy + 0.5) / 4 + r.range(-0.08, 0.08)) * H, r.range(300, 520), pal));
    }
  // L4 symbols
  const sym = ["star", "arrow", "heart", "bolt", "smiley", "target", "arrow", "heart"];
  for (let i = 0; i < 14; i++) push(makeMark(r, sym[i % sym.length], 4, r.range(0.03, 0.97) * W, r.range(0.04, 0.96) * H, r.range(110, 300), pal));
  // L5 thin pen doodles
  const pens = ["penScribble", "penStar", "penBrush", "penRing", "penSwoosh", "penCross", "penBrush", "penSun", "penTri", "penSpiral"];
  for (let i = 0; i < 30; i++) push(makeMark(r, pens[i % pens.length], 5, r.range(0.02, 0.98) * W, r.range(0.03, 0.97) * H, r.range(150, 420), pal));
  // L6 splats and dot clusters
  for (let i = 0; i < 40; i++) push(makeMark(r, i % 3 === 0 ? "dots" : "splat", 6, r.range(0, W), r.range(0, H), r.range(60, 220), pal));
  for (let i = 0; i < 8; i++) push(makeMark(r, "speckle", 6, r.range(0, W), r.range(0, H), r.range(250, 600), pal));

  // replaceable slots: 3 per event, from the big / tag / symbol / pen layers
  const pools = [1, 3, 4, 5].map((L) => slots.filter((s) => s.a.layer === L));
  let pi = 0;
  for (let e = 0; e < 7; e++) {
    for (let j = 0; j < 3; j++) {
      const pool = pools[pi++ % pools.length];
      const free = pool.filter((s) => s.e1 < 0);
      if (!free.length) continue;
      const s = free[r.int(0, free.length)];
      const e2 = (e + r.int(2, 5)) % 7;
      s.e1 = Math.min(e, e2);
      s.e2 = Math.max(e, e2);
      const gens = s.a.layer === 1 ? bigKinds : s.a.layer === 3 ? ["tag"] : s.a.layer === 4 ? sym : pens;
      const rb = new Rand(id, "B", slots.indexOf(s));
      const S = (s.a.bbox[2] - s.a.bbox[0]) * 0.55;
      s.b = makeMark(rb, rb.pick(gens), s.a.layer, s.a.cx + rb.range(-120, 120), s.a.cy + rb.range(-100, 100), Math.max(120, S), pal);
    }
  }
  return slots;
};

// Paint one mark (in design coordinates) into ctx. `s` = device px per unit.
const paintMark = (ctx: CanvasRenderingContext2D, m: Mark, key: string, variant: number, progress: number, s: number, washAlpha: number) => {
  const r = new Rand("paint", key, variant);
  const lens = m.strokes.map((st) => (st.pts.length > 1 ? pathLength(catmull(st.pts, 4)) : 50));
  const total = lens.reduce((a, b) => a + b, 0);
  let budget = progress * total;
  m.strokes.forEach((st, i) => {
    if (budget <= 0) return;
    const frac = Math.min(1, budget / lens[i]);
    budget -= lens[i];
    const jamp = st.kind === "pen" ? 5 : st.kind === "mist" ? 25 : Math.max(3, st.w * 0.06);
    let pts = jitterPts(st.pts, r, jamp);
    if (frac < 1 && pts.length > 1) pts = truncatePath(catmull(pts, 4), frac);
    if (pts.length < 1) return;
    switch (st.kind) {
      case "mist":
        paintMass(ctx, pts, { width: st.w, color: st.color, r, s, alpha: washAlpha });
        break;
      case "spray":
        sprayStroke(ctx, pts, { width: st.w, color: st.color, r, s });
        break;
      case "marker":
        markerStroke(ctx, pts, { width: st.w, color: st.color, r });
        break;
      case "pen":
        penStroke(ctx, pts, { width: st.w, color: st.color });
        break;
      case "splat":
        splat(ctx, pts[0][0], pts[0][1], st.w, st.color, r);
        break;
      case "poly":
        ctx.fillStyle = st.color;
        ctx.beginPath();
        smoothPath(ctx, pts, true);
        ctx.fill();
        break;
      case "dots":
        ctx.fillStyle = st.color;
        pts.forEach(([x, y]) => {
          const rad = st.w * r.range(0.7, 1.3);
          ctx.beginPath();
          ctx.ellipse(x, y, rad, rad * r.range(0.8, 1.1), r.range(0, 3), 0, Math.PI * 2);
          ctx.fill();
        });
        break;
    }
  });
};

const makeDraw = (id: string, pal: GraffitiPalette): DrawFn => {
  let slots: Slot[] | null = null;
  const cache = new Map<string, { c: HTMLCanvasElement; x: number; y: number; w: number; h: number }>();
  const MAX_CACHE = 900;
  let grain: { x: number; y: number; rx: number; ry: number; a: number }[] = [];

  const cached = (m: Mark, key: string, variant: number, progress: number, s: number) => {
    const k = `${key}:${variant}:${progress}:${s}`;
    let e = cache.get(k);
    if (e) {
      cache.delete(k);
      cache.set(k, e);
      return e;
    }
    const [x0, y0, x1, y1] = m.bbox;
    const rs = s * m.res;
    const c = makeCanvas((x1 - x0) * rs, (y1 - y0) * rs);
    const cx = c.getContext("2d")!;
    cx.setTransform(rs, 0, 0, rs, -x0 * rs, -y0 * rs);
    paintMark(cx, m, key, variant, progress, rs, pal.washAlpha);
    e = { c, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    cache.set(k, e);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
    return e;
  };

  return (ctx, { frame, W, H, s }) => {
    if (!slots) {
      slots = buildWall(id, pal, W, H);
      const gr = new Rand(id, "grain");
      grain = pal.grain
        ? Array.from({ length: 900 }, () => ({ x: gr.range(0, W), y: gr.range(0, H), rx: gr.range(1.5, 5), ry: gr.range(1, 3), a: gr.range(0, 3) }))
        : [];
    }
    const d = loopDrawing(frame);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (pal.grain) {
      ctx.fillStyle = pal.grain;
      for (const g of grain) {
        ctx.beginPath();
        ctx.ellipse(g.x, g.y, g.rx, g.ry, g.a, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const sinceEvent = (e: number) => mod(d - EVENT_DRAWINGS[e], LOOP_DRAWINGS);

    slots.forEach((slot, i) => {
      let mark = slot.a;
      let key = `${i}A`;
      let age = Infinity; // drawings since this mark appeared
      let old: { m: Mark; key: string } | null = null;
      if (slot.b && slot.e1 >= 0) {
        const t1 = sinceEvent(slot.e1);
        const t2 = sinceEvent(slot.e2);
        // whichever event happened most recently decides what's showing
        if (t1 < t2) {
          mark = slot.b;
          key = `${i}B`;
          age = t1;
          old = { m: slot.a, key: `${i}A` };
        } else {
          age = t2;
          old = { m: slot.b, key: `${i}B` };
        }
      }
      const progress = age < SPRAY_ON.length ? SPRAY_ON[age] : 1;
      // boil: pick one of the cached variants + a small random offset
      const variant = Math.floor(hash01(i, d, 1) * BOIL_VARIANTS);
      const jr = new Rand(id, "boil", i, d);
      const dx = jr.range(-4, 4);
      const dy = jr.range(-4, 4);
      const ang = jr.range(-0.004, 0.004);

      const blit = (m: Mark, k: string, prog: number, alpha: number) => {
        const e = cached(m, k, variant, prog, s);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(m.cx + dx, m.cy + dy);
        ctx.rotate(ang);
        ctx.translate(-m.cx, -m.cy);
        ctx.drawImage(e.c, e.x, e.y, e.w, e.h);
        ctx.restore();
      };
      if (old && age === 0) blit(old.m, old.key, 1, 0.45);
      blit(mark, key, progress, 1);

      // drips run down over ~1-2 s after a mark is sprayed on
      const framesSince = age === Infinity ? 1e9 : age * 2;
      for (let q = 0; q < mark.drips.length; q++) {
        const dp = mark.drips[q];
        const startDelay = 6 + (q % 5) * 4;
        const grow = clamp((framesSince - startDelay) * dp.speed / dp.len);
        if (grow <= 0) continue;
        const L = dp.len * grow;
        drip(ctx, dp.x + dx, dp.y + dy, L, dp.w, dp.color, dp.wob);
      }
    });
  };
};

export const GraffitiWall: React.FC<{ variant: "neon" | "paper" }> = ({ variant }) => {
  const id = `GraffitiWall_${variant === "neon" ? "Neon" : "Paper"}`;
  const draw = useMemo(() => makeDraw(id, GRAFFITI_PALETTES[variant]), [id, variant]);
  return <CanvasComp draw={draw} />;
};
