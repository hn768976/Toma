import React, { useMemo } from "react";
import rough from "roughjs";
import { freehand, fillOutline, penStroke } from "../lib/brush";
import { CanvasComp, DrawFn } from "../lib/CanvasComp";
import { clamp, easeInOut, easeOut, lerp, Pt, smoothstep } from "../lib/math";
import { catmull as catmullPts, smoothPath } from "../lib/path";
import { Rand } from "../lib/rng";
import { FACE, LIPS, NECK_JOINT, PartName, PARTS, partAt, PIVOT, SHOULDER_L, SHOULDER_R, WAIST } from "./figure";

export const INK_FRAMES = 360;
export const INK_COLORS = {
  bg: "#74A6E0",
  ink: "#020202",
  scratch: "#8DB4E6", // pale blue scratches: the background showing through the ink
  white: "#FFFFFF",
  lips: "#FF3A7A",
  hatch: "#4F82C8", // blue hatching on the white version and the ribbons
};

// Timeline (frames at 30 fps)
const T = {
  swarmEnd: 45, // 0-1.5 s dots gather
  burst: 150, // 5 s burst
  empty: 180, // 6 s
  whiteStart: 195, // 6.5 s white version draws on from the top
  whiteDone: 225, // 7.5 s
  bands: 300, // 10 s ribbons
  hold: 336, // 11.2 s hold last pose
};

type PoseP = { theta: number; bend: number; tilt: number; swingL: number; swingR: number };
const DEG = Math.PI / 180;

const poseAt = (t: number): PoseP => {
  if (t < T.empty) {
    // black version: sway and tilt her head (to her left first)
    const u = Math.max(0, t - T.swarmEnd) / 78;
    const env = smoothstep(T.swarmEnd - 4, T.swarmEnd + 20, t);
    const w = Math.sin(u * Math.PI * 2);
    const w2 = Math.sin(u * Math.PI * 2 - 0.7);
    return { theta: 5 * DEG * w * env, bend: -4 * DEG * w * env, tilt: (36 * w2 + 16) * DEG * env, swingL: 4 * DEG * w2 * env, swingR: 4 * DEG * w2 * env };
  }
  // white version: the other way
  const tt = Math.min(t, T.hold);
  const u = Math.max(0, tt - T.whiteDone + 10) / 84;
  const env = smoothstep(T.whiteStart, T.whiteDone, t);
  const w = Math.sin(u * Math.PI * 2);
  const w2 = Math.sin(u * Math.PI * 2 - 0.7);
  return { theta: -5 * DEG * w * env, bend: 4 * DEG * w * env, tilt: (-36 * w2 - 16) * DEG * env, swingL: -4 * DEG * w2 * env, swingR: -4 * DEG * w2 * env };
};

const rotAbout = (p: Pt, c: Pt, a: number): Pt => {
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
};

type Kind = "body" | "arm" | "armL" | "armR" | "head" | "neck";
const kindOf = (n: PartName): Kind => (n === "armL" ? "armL" : n === "armR" ? "armR" : n === "body" ? "body" : n === "neck" ? "neck" : "head");

// rest-pose point -> posed point (relative to centre line; caller adds cx)
const deform = (p: Pt, kind: Kind, P: PoseP): Pt => {
  let q = p;
  if (kind === "head") q = rotAbout(q, NECK_JOINT, P.tilt);
  if (kind === "neck") q = rotAbout(q, NECK_JOINT, P.tilt * smoothstep(820, 660, p[1]));
  if (kind === "armL") q = rotAbout(q, SHOULDER_L, P.swingL);
  if (kind === "armR") q = rotAbout(q, SHOULDER_R, P.swingR);
  const w = kind === "body" ? smoothstep(1540, 1260, p[1]) : 1;
  q = rotAbout(q, WAIST, P.bend * w);
  return rotAbout(q, PIVOT, P.theta);
};

const makeDraw = (): DrawFn => {
  // dot targets inside the rest-pose figure
  const dr = new Rand("InkFigure", "dots");
  const dots: { p: Pt; r: number; kind: Kind; delay: number; sx: number; sy: number; vx: number; vy: number; drift: boolean }[] = [];
  let tries = 0;
  while (dots.length < 240 && tries < 20000) {
    tries++;
    const p: Pt = [dr.range(-440, 440), dr.range(330, 2150)];
    const part = partAt(p);
    if (!part) continue;
    const r = dr.range(15, 38);
    if (dots.some((d) => Math.hypot(d.p[0] - p[0], d.p[1] - p[1]) < (d.r + r) * 0.95)) continue;
    dots.push({
      p,
      r,
      kind: kindOf(part),
      delay: dr.range(0, 14),
      sx: -dr.range(250, 1700),
      sy: p[1] + dr.range(-450, 450),
      vx: dr.range(-14, 22),
      vy: dr.range(-30, -6),
      drift: false,
    });
  }
  for (let i = 0; i < 9; i++) dots[i * 17].drift = true;

  // dry-brush streaks + hatch lines in rest coordinates
  const sr = new Rand("InkFigure", "streaks");
  const streaks = Array.from({ length: 34 }, () => {
    let p: Pt = [0, 0];
    let part: PartName | null = null;
    for (let k = 0; k < 40 && !part; k++) {
      p = [sr.range(-430, 430), sr.range(700, 2150)];
      part = partAt(p);
    }
    const L = sr.range(36, 140);
    const a = Math.PI / 2 + sr.range(-0.12, 0.12);
    return { a: p, b: [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L] as Pt, w: sr.range(5, 10), kind: kindOf(part ?? "body") };
  });
  // long scratches that follow the anatomy: inner arms, under the shoulders, dress folds
  const contours: { pts: Pt[]; kind: Kind }[] = [
    { pts: [[338, 980], [362, 1200], [386, 1420], [410, 1640], [432, 1860]], kind: "armR" },
    { pts: [[-338, 980], [-362, 1200], [-386, 1420], [-410, 1640], [-432, 1860]], kind: "armL" },
    { pts: [[-250, 880], [-120, 925], [0, 940], [120, 925], [250, 880]], kind: "body" },
    { pts: [[-150, 1150], [-90, 1270], [-60, 1330]], kind: "body" },
    { pts: [[160, 1150], [100, 1270], [70, 1330]], kind: "body" },
    { pts: [[-120, 1480], [-150, 1700], [-170, 1950], [-180, 2250]], kind: "body" },
    { pts: [[90, 1500], [130, 1760], [150, 2000], [160, 2250]], kind: "body" },
    { pts: [[0, 1560], [10, 1800], [0, 2100]], kind: "body" },
  ];
  // small white chalk specks on the body
  const specks = Array.from({ length: 26 }, () => {
    let p: Pt = [0, 0];
    let part: PartName | null = null;
    for (let k = 0; k < 40 && !part; k++) {
      p = [sr.range(-430, 430), sr.range(760, 2150)];
      part = partAt(p);
    }
    return { p, r: sr.range(2, 5), kind: kindOf(part ?? "body") };
  });
  // blue hatching as broken streaks (dry-brush), not full-length stripes
  const hatchLines: { a: Pt; b: Pt }[] = [];
  const hr = new Rand("InkFigure", "hatch");
  for (let x = -520; x < 520; x += 34) {
    let y = 260 + hr.range(0, 200);
    while (y < 2250) {
      const L = hr.range(90, 320);
      const k = 140 / 1950; // slant
      hatchLines.push({ a: [x + y * k + hr.range(-6, 6), y], b: [x + (y + L) * k, y + L] });
      y += L + hr.range(40, 220);
    }
  }

  const bands = [
    { y: 1010, k: 0.42, w: 64 },
    { y: 1330, k: -0.36, w: 72 },
    { y: 1640, k: 0.4, w: 70 },
    { y: 1950, k: -0.32, w: 66 },
  ];

  return (ctx, { frame, W, H }) => {
    ctx.fillStyle = INK_COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    const t = Math.floor(frame / 2) * 2; // everything moves on twos
    const boil = Math.floor(frame / 2) % 4;
    const white = t >= T.whiteStart;
    const cx = W * (white ? 0.52 : 0.49);
    const P = poseAt(t);
    const X = (p: Pt, kind: Kind): Pt => {
      const q = deform(p, kind, P);
      return [q[0] + cx, q[1]];
    };
    const br = new Rand("InkFigure", "boil", boil);

    const buildUnion = () => {
      const path = new Path2D();
      for (const part of PARTS) {
        const k = kindOf(part.name);
        const pts = part.pts.map((p) => {
          const q = X(p, k);
          return [q[0] + br.range(-6, 6), q[1] + br.range(-6, 6)] as Pt;
        });
        smoothPath(path, pts, true);
      }
      return path;
    };

    const fingers = (col: string) => {
      for (const [side, kind] of [[1, "armR"], [-1, "armL"]] as const) {
        for (let k = 0; k < 3; k++) {
          const x0 = side * (446 + k * 12);
          const pts: Pt[] = [
            [x0, 1990],
            [x0 + side * (6 + k * 4), 2050 + k * 10],
            [x0 + side * (2 + k * 6) - side * 10, 2095 + k * 8],
          ];
          penStroke(ctx, pts.map((p) => X([p[0] + br.range(-2, 2), p[1]], kind)), { width: 13, color: col });
        }
      }
    };

    const drawFace = (lineCol: string) => {
      const fp = Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2;
        return X([FACE.c[0] + Math.cos(a) * FACE.rx + br.range(-2, 2), FACE.c[1] + Math.sin(a) * FACE.ry * (a > Math.PI ? 0.96 : 1)], "head");
      });
      ctx.fillStyle = INK_COLORS.bg;
      ctx.beginPath();
      smoothPath(ctx, fp, true);
      ctx.fill();
      const line = (pts: Pt[], w: number) => penStroke(ctx, pts.map((p) => X([p[0] + br.range(-1.2, 1.2), p[1] + br.range(-1.2, 1.2)], "head")), { width: w, color: lineCol });
      const fc = FACE.c;
      // closed eyes (downward lash curves), short brows, a hint of nose
      for (const sx of [-1, 1]) {
        line([[fc[0] + sx * 22, fc[1] - 2], [fc[0] + sx * 42, fc[1] + 8], [fc[0] + sx * 62, fc[1] - 1]], 7);
        line([[fc[0] + sx * 26, fc[1] - 44], [fc[0] + sx * 50, fc[1] - 50], [fc[0] + sx * 66, fc[1] - 44]], 6);
      }
      line([[fc[0] + 3, fc[1] + 18], [fc[0] - 4, fc[1] + 46], [fc[0] + 5, fc[1] + 50]], 5);
      const lp = X(LIPS, "head");
      ctx.fillStyle = INK_COLORS.lips;
      ctx.beginPath();
      ctx.ellipse(lp[0], lp[1], 24, 15, P.tilt, 0, Math.PI * 2);
      ctx.strokeStyle = INK_COLORS.lips;
      ctx.lineWidth = 8;
      ctx.stroke();
    };

    const blot = (x: number, y: number, r: number, seed: number, color: string) => {
      const rr = new Rand("blot", seed, boil);
      const pts = Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const k = r * rr.range(0.86, 1.1);
        return [x + Math.cos(a) * k, y + Math.sin(a) * k] as Pt;
      });
      ctx.fillStyle = color;
      ctx.beginPath();
      smoothPath(ctx, pts, true);
      ctx.fill();
    };

    // ---------------------------------------------------------------- dots in
    if (t < T.swarmEnd) {
      dots.forEach((d, i) => {
        const target = X(d.p, d.kind);
        const u = clamp((t - d.delay) / (T.swarmEnd - 6 - d.delay));
        const e = easeOut(u);
        const x = lerp(d.sx, target[0], e);
        const y = lerp(d.sy, target[1], e) + Math.sin(u * Math.PI) * (d.sy > target[1] ? -120 : 120);
        blot(x, y, d.r * (u > 0.85 ? 1 + (u - 0.85) * 2.5 : 1), i, INK_COLORS.ink);
      });
      const lp = X(LIPS, "head");
      const u = clamp((t - 4) / 32);
      blot(lerp(-300, lp[0], easeOut(u)), lerp(lp[1] - 260, lp[1], easeOut(u)), 18, 999, INK_COLORS.lips);
      return;
    }

    // ------------------------------------------------------------ black figure
    if (t < T.burst) {
      const union = buildUnion();
      ctx.fillStyle = INK_COLORS.ink;
      ctx.fill(union);
      ctx.save();
      ctx.clip(union);
      for (const st of streaks) {
        const a = X([st.a[0] + br.range(-2, 2), st.a[1]], st.kind);
        const b = X([st.b[0] + br.range(-2, 2), st.b[1]], st.kind);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = INK_COLORS.scratch;
        // broken scratch: two short dashes with a gap
        const m1: Pt = [a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45];
        const m2: Pt = [a[0] + (b[0] - a[0]) * 0.6, a[1] + (b[1] - a[1]) * 0.6];
        fillOutline(ctx, freehand([a, m1], st.w, { thinning: 0.3, taperStart: 8, taperEnd: 20, jagged: true }));
        fillOutline(ctx, freehand([m2, b], st.w * 0.8, { thinning: 0.3, taperStart: 8, taperEnd: 20, jagged: true }));
      }
      ctx.globalAlpha = 0.95;
      contours.forEach((c, ci) => {
        const dense = catmullPts(c.pts.map((p) => X([p[0] + br.range(-3, 3), p[1]], c.kind)));
        // break the line into 2-4 dashes of varying weight
        const cuts = 2 + (ci % 3);
        for (let q = 0; q < cuts; q++) {
          const a0 = Math.floor((q / cuts) * dense.length);
          const a1 = Math.floor(((q + 0.72) / cuts) * dense.length);
          const seg = dense.slice(a0, Math.max(a0 + 2, a1));
          fillOutline(ctx, freehand(seg, 7 + (ci % 3) * 2, { thinning: 0.5, taperStart: 30, taperEnd: 50 }));
        }
      });
      ctx.globalAlpha = 1;
      for (const sp of specks) {
        const q = X(sp.p, sp.kind);
        ctx.beginPath();
        ctx.ellipse(q[0] + br.range(-1, 1), q[1], sp.r * 1.6, sp.r * 0.7, br.range(0, 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      fingers(INK_COLORS.ink);
      drawFace(INK_COLORS.ink);
      // the swarm's last dots still settling in for one drawing
      if (t < T.swarmEnd + 2) dots.forEach((d, i) => { const q = X(d.p, d.kind); blot(q[0], q[1], d.r * 1.3, i, INK_COLORS.ink); });
      return;
    }

    // ------------------------------------------------------------ burst
    if (t < T.whiteStart) {
      const P0 = poseAt(T.burst);
      const tt = t - T.burst;
      const ctr: Pt = [cx, 1300];
      dots.forEach((d, i) => {
        const q0 = deform(d.p, d.kind, P0);
        const p0: Pt = [q0[0] + cx, q0[1]];
        const out: Pt = [(p0[0] - ctr[0]) * 0.03, (p0[1] - ctr[1]) * 0.012];
        let x: number;
        let y: number;
        let r = d.r;
        if (d.drift) {
          x = p0[0] + (out[0] * 6 + d.vx * 0.5) * tt * 0.6;
          y = p0[1] + d.vy * 0.4 * tt + 0.02 * tt * tt;
          r *= 0.8;
          if (t > T.whiteStart - 8) r *= (T.whiteStart - t) / 8;
        } else {
          x = p0[0] + (out[0] * 4 + d.vx) * tt;
          y = p0[1] + (out[1] * 4 + d.vy) * tt + 1.6 * tt * tt;
          r *= Math.max(0, 1 - tt / 34);
        }
        if (y - r < H + 50 && r > 1) blot(x, y, r, i, INK_COLORS.ink);
      });
      // the pink dot lingers
      const l0 = deform(LIPS, "head", P0);
      const fade = t < T.whiteStart - 6 ? 1 : (T.whiteStart - t) / 6;
      if (fade > 0) blot(l0[0] + cx + tt * 1.2, l0[1] - tt * 2.2, 18 * fade, 999, INK_COLORS.lips);
      return;
    }

    // ------------------------------------------------------------ white figure
    const reveal = easeInOut(clamp((t - T.whiteStart) / (T.whiteDone - T.whiteStart)));
    ctx.save();
    if (reveal < 1) {
      // ragged brush edge sweeping down from the top
      const yR = lerp(250, 2260, reveal);
      const clip = new Path2D();
      clip.moveTo(0, -10);
      clip.lineTo(W, -10);
      for (let x = W; x >= 0; x -= 60) clip.lineTo(x, yR + br.range(-40, 40) + Math.sin(x * 0.01) * 30);
      clip.closePath();
      ctx.clip(clip);
    }
    const union = buildUnion();
    ctx.fillStyle = INK_COLORS.white;
    ctx.fill(union);
    // blue hatching (Rough.js), deformed with the body
    ctx.save();
    ctx.clip(union);
    const rc = rough.canvas(ctx.canvas);
    hatchLines.forEach((hl, i) => {
      const a = X(hl.a, "body");
      const b = X(hl.b, "body");
      rc.line(a[0], a[1], b[0], b[1], { seed: 7 + i + boil * 101, roughness: 2.2, bowing: 1.6, stroke: INK_COLORS.hatch, strokeWidth: 1.4 + ((i * 37) % 10) * 0.3 });
    });
    // ribbons wrapping the body
    if (t >= T.bands) {
      bands.forEach((b, i) => {
        const prog = easeOut(clamp((t - T.bands - i * 9) / 16));
        if (prog <= 0) return;
        const x0 = -480;
        const x1 = lerp(-480, 480, prog);
        const edge = (x: number, side: number): Pt => X([x, b.y + b.k * x + (side * b.w) / 2], "body");
        const poly: Pt[] = [];
        for (let x = x0; x <= x1; x += 40) poly.push(edge(x, -1));
        poly.push(edge(x1, -1));
        for (let x = x1; x >= x0; x -= 40) poly.push(edge(x, 1));
        ctx.fillStyle = INK_COLORS.bg;
        ctx.beginPath();
        smoothPath(ctx, poly.map(([x, y]) => [x + br.range(-1.5, 1.5), y + br.range(-1.5, 1.5)] as Pt), true);
        ctx.fill();
        for (let x = x0 + 10; x < x1; x += 22) {
          const p = X([x, b.y + b.k * x - b.w * 0.4], "body");
          const q = X([x + 14, b.y + b.k * (x + 14) + b.w * 0.4], "body");
          rc.line(p[0], p[1], q[0], q[1], { seed: 300 + i * 50 + Math.round(x) + boil * 7, roughness: 0.8, stroke: INK_COLORS.hatch, strokeWidth: 2.6 });
        }
      });
    }
    ctx.restore();
    fingers(INK_COLORS.white);
    drawFace(INK_COLORS.ink);
    ctx.restore();
  };
};

export const InkFigure: React.FC = () => {
  const draw = useMemo(() => makeDraw(), []);
  return <CanvasComp draw={draw} />;
};
