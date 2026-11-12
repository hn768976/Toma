import React, { useMemo } from "react";
import rough from "roughjs";
import { penStroke } from "../lib/brush";
import { CanvasComp, DrawFn, makeCanvas } from "../lib/CanvasComp";
import { mix } from "../lib/color";
import { lerp, Pt } from "../lib/math";
import { smoothPath } from "../lib/path";
import { Rand } from "../lib/rng";
import { Bone, makeRig, Pose } from "./rig";

export const STYLE_FRAMES = 39;
export const WALK_FRAMES = 390;

// One row per cut: background colour + drawing style (10 cuts x 39 frames).
export const WALK_STYLES: { bg: string; style: Style }[] = [
  { bg: "#F5820A", style: "scribble" },
  { bg: "#FF1A3A", style: "scribbleDense" },
  { bg: "#FF3AE0", style: "lineLoops" },
  { bg: "#9A4AFF", style: "halftone" },
  { bg: "#4A7AFF", style: "solid" },
  { bg: "#3AFFF8", style: "spiral" },
  { bg: "#22F04A", style: "hatch" },
  { bg: "#66FF00", style: "solidRings" },
  { bg: "#F5D80A", style: "blobs" },
  { bg: "#F5820A", style: "scribble" },
];
export const INK = "#141414";
export const INK_FAR = "#2E2E2E"; // far-side arm and leg in the filled styles

type Style = "scribble" | "scribbleDense" | "lineLoops" | "halftone" | "solid" | "spiral" | "hatch" | "solidRings" | "blobs";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const signedArea = (pts: Pt[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

// Union of all body parts: same winding for every sub-path + nonzero fill.
const unionPath = (pose: Pose, r: Rand, jit: number, filter?: (depth: number) => boolean) => {
  const path = new Path2D();
  for (const part of pose.parts) {
    if (filter && !filter(part.depth)) continue;
    let pts = part.pts.map(([x, y]) => [x + r.range(-jit, jit), y + r.range(-jit, jit)] as Pt);
    if (signedArea(pts) < 0) pts = pts.reverse();
    smoothPath(path, pts, true);
  }
  return path;
};

const boneFrame = (b: Bone) => {
  const dx = b.b[0] - b.a[0];
  const dy = b.b[1] - b.a[1];
  const L = Math.hypot(dx, dy) || 1;
  return { L, t: [dx / L, dy / L] as Pt, n: [dy / L, -dx / L] as Pt };
};

// A coil of loops travelling down a bone (side view of a spring).
const coil = (b: Bone, r: Rand, density: number, loose: number): Pt[] => {
  const { L, t, n } = boneFrame(b);
  const wAvg = (b.wa + b.wb) / 2;
  const loops = Math.max(2, Math.round((L / wAvg) * density));
  const steps = loops * 12;
  const out: Pt[] = [];
  let wob = 0;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const ph = u * loops * Math.PI * 2 + r.range(-0.15, 0.15);
    wob = wob * 0.85 + r.range(-0.12, 0.12);
    const w = (lerp(b.wa, b.wb, u) / 2) * (0.95 + wob) * loose;
    const along = u * L + Math.sin(ph) * w * 0.45;
    const across = Math.cos(ph) * w;
    out.push([b.a[0] + t[0] * along + n[0] * across, b.a[1] + t[1] * along + n[1] * across]);
  }
  return out;
};

const headCoil = (c: Pt, R: number, r: Rand, loops: number, loose: number): Pt[] => {
  const out: Pt[] = [];
  const steps = loops * 12;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = u * loops * Math.PI * 2;
    const rr = R * loose * (0.35 + 0.6 * Math.abs(Math.sin(u * Math.PI * 1.5 + 0.3))) * (1 + r.range(-0.08, 0.08));
    out.push([c[0] + Math.cos(a) * rr + (u - 0.5) * R * 0.5, c[1] + Math.sin(a) * rr * 1.1 + (u - 0.5) * R * 0.6]);
  }
  return out;
};

const makeDraw = (forceCut?: number): DrawFn => {
  let rig: ReturnType<typeof makeRig> | null = null;
  let tex: { squig: Pt[][]; curves: Pt[][]; specks: [number, number, number][] } | null = null;
  let off: HTMLCanvasElement | null = null;

  return (ctx, { frame, W, H, s, pw, ph }) => {
    if (!rig) {
      rig = makeRig({ height: H * 0.75, groundY: H * 0.905, x0: -0.04 * W, x1: 1.04 * W, tEnd: WALK_FRAMES });
      const tr = new Rand("StyleWalk", "paper");
      tex = {
        // short pen ticks and dashes
        squig: Array.from({ length: 110 }, () => {
          const x = tr.range(0, W);
          const y = tr.range(0, H);
          const a = tr.range(0, Math.PI * 2);
          const L = tr.range(16, 80);
          const bend = tr.range(-0.25, 0.25) * L;
          return [
            [x, y],
            [x + (Math.cos(a) * L) / 2 - (Math.sin(a) * bend) / 2, y + (Math.sin(a) * L) / 2 + (Math.cos(a) * bend) / 2],
            [x + Math.cos(a) * L, y + Math.sin(a) * L],
          ] as Pt[];
        }),
        // a few long, faint, loose curves sweeping across the paper
        curves: Array.from({ length: 9 }, () => {
          let x = tr.range(-0.1, 1.1) * W;
          let y = tr.range(0, H);
          let a = tr.range(0, Math.PI * 2);
          const pts: Pt[] = [];
          for (let i = 0; i < 26; i++) {
            pts.push([x, y]);
            a += tr.range(-0.5, 0.5);
            x += Math.cos(a) * 70;
            y += Math.sin(a) * 70;
          }
          return pts;
        }),
        specks: Array.from({ length: 70 }, () => [tr.range(0, W), tr.range(0, H), tr.range(1.5, 3.2)] as [number, number, number]),
      };
    }
    if (!off || off.width !== pw || off.height !== ph) off = makeCanvas(pw, ph);
    const cut = forceCut ?? Math.min(9, Math.floor(frame / STYLE_FRAMES));
    const { bg, style } = WALK_STYLES[cut];
    // background: flat colour + faint pale doodle texture (static paper)
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const pale = mix(bg, "#FFFFFF", 0.2);
    for (const q of tex!.squig) penStroke(ctx, q, { width: 3.4, color: pale });
    const faint = mix(bg, "#000000", 0.07);
    for (const q of tex!.curves) penStroke(ctx, q, { width: 2.6, color: faint });
    ctx.fillStyle = pale;
    for (const [x, y, rad] of tex!.specks) {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // the figure moves on twos; its outline boils with 4 variants x 2 frames
    const t2 = Math.floor(frame / 2) * 2;
    const boil = Math.floor(frame / 2) % 4;
    const pose = rig.pose(t2);
    const r = new Rand("StyleWalk", cut, boil);
    const union = unionPath(pose, new Rand("StyleWalk", "outline", boil), 2.5);
    const bones = [...pose.bones].sort((a, b) => a.depth - b.depth);
    const h = rig.h;

    const pen = (pts: Pt[], w: number) => penStroke(ctx, pts, { width: w, color: INK, smooth: false });

    const outline = (width: number) => {
      const o = off!.getContext("2d")!;
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.clearRect(0, 0, pw, ph);
      o.setTransform(s, 0, 0, s, 0, 0);
      o.strokeStyle = INK;
      o.lineJoin = "round";
      o.lineWidth = width * 2;
      o.stroke(union);
      o.globalCompositeOperation = "destination-out";
      o.fill(union);
      o.globalCompositeOperation = "source-over";
      ctx.drawImage(off!, 0, 0, W, H);
    };

    switch (style) {
      case "scribble":
      case "scribbleDense": {
        const dense = style === "scribbleDense";
        for (const b of bones) {
          pen(coil(b, r, dense ? 1.9 : 1.05, 1.15), dense ? 8 : 10);
          if (dense) pen(coil(b, r, 1.5, 0.85), 7);
        }
        pen(headCoil(pose.head.c, pose.head.r, r, dense ? 6 : 4, 1), dense ? 8 : 10);
        break;
      }
      case "lineLoops": {
        for (const b of bones) {
          const { L, t, n } = boneFrame(b);
          const k = Math.max(2, Math.round(L / (0.16 * h)));
          for (let i = 0; i <= k; i++) {
            const u = clamp01(i / k + r.range(-0.3, 0.3) / k);
            const c: Pt = [b.a[0] + t[0] * L * u, b.a[1] + t[1] * L * u];
            const w = lerp(b.wa, b.wb, u) / 2;
            const ring: Pt[] = [];
            const m = 14;
            const tilt = r.range(0.1, 0.22);
            for (let j = 0; j <= m + 1; j++) {
              const a = (j / m) * Math.PI * 2;
              const rr = (1 + r.range(-0.12, 0.12)) * (0.85 + 0.3 * ((i * 7) % 5) / 4);
              const ax = Math.cos(a) * w * rr;
              const ay = Math.sin(a) * w * tilt * 1.8 * rr;
              ring.push([c[0] + n[0] * ax + t[0] * ay, c[1] + n[1] * ax + t[1] * ay]);
            }
            pen(ring, r.range(4.5, 8));
          }
        }
        pen(headCoil(pose.head.c, pose.head.r, r, 3, 0.95), 6);
        break;
      }
      case "halftone": {
        const g = 30;
        const sz = g * 0.62;
        const [x0, y0, x1, y1] = pose.bbox;
        ctx.fillStyle = INK;
        const ox = ((boil % 2) * g) / 2;
        for (let y = Math.floor(y0 / g) * g; y <= y1; y += g)
          for (let x = Math.floor(x0 / g) * g + ox; x <= x1; x += g) {
            if (!ctx.isPointInPath(union, x * s, y * s)) continue;
            const j = sz * r.range(0.8, 1.15);
            ctx.fillRect(x - j / 2 + r.range(-1.5, 1.5), y - j / 2 + r.range(-1.5, 1.5), j, j);
          }
        break;
      }
      case "solid": {
        // far-side limbs a shade lighter so near/far read in silhouette
        ctx.fillStyle = INK_FAR;
        ctx.fill(unionPath(pose, new Rand("StyleWalk", "outline", boil), 2.5, (dd) => dd < 0));
        ctx.fillStyle = INK;
        ctx.fill(unionPath(pose, new Rand("StyleWalk", "outline", boil), 2.5, (dd) => dd >= 0));
        // thin edge line so the near arm reads over the torso
        ctx.strokeStyle = INK_FAR;
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        for (const part of pose.parts) {
          if (part.name !== "r-arm" && part.name !== "r-hand") continue;
          ctx.beginPath();
          smoothPath(ctx, part.pts, true);
          ctx.stroke();
        }
        break;
      }
      case "spiral": {
        // the body shape dissolving into loose spiral scribble (mid-change)
        for (const b of bones) pen(coil({ ...b, a: [b.a[0] + r.range(-30, 30), b.a[1] + r.range(-30, 30)] }, r, 0.9, 1.75), 6.5);
        pen(headCoil([pose.head.c[0] + r.range(-20, 20), pose.head.c[1]], pose.head.r, r, 3, 1.6), 6.5);
        const [x0, y0, x1, y1] = pose.bbox;
        const cx = (x0 + x1) / 2;
        const sweep: Pt[] = [];
        for (let i = 0; i <= 80; i++) {
          const u = i / 80;
          const a = u * Math.PI * 2 * 5.5;
          const rad = (x1 - x0) * (0.35 + 0.25 * Math.sin(u * 7)) * (1 + r.range(-0.05, 0.05));
          sweep.push([cx + Math.cos(a) * rad, lerp(y0 + 0.1 * (y1 - y0), y1 - 0.05 * (y1 - y0), u) + Math.sin(a) * rad * 0.25]);
        }
        pen(sweep, 5);
        break;
      }
      case "hatch": {
        const rc = rough.canvas(ctx.canvas);
        const [x0, y0, x1, y1] = pose.bbox;
        ctx.save();
        ctx.clip(union);
        const gap = 24;
        const span = (x1 - x0) + (y1 - y0);
        for (let k = -span; k < span; k += gap) {
          // 45 degree hatch lines through the bbox, drawn with Rough.js
          const ax = x0 + k;
          rc.line(ax, y0, ax + (y1 - y0), y1, { seed: 1 + ((k + 4000) % 997) + boil * 1000, roughness: 1.1, bowing: 0.8, stroke: INK, strokeWidth: 3.2 });
        }
        ctx.restore();
        outline(4);
        break;
      }
      case "solidRings": {
        const [x0, y0, x1, y1] = pose.bbox;
        const cx = (x0 + x1) / 2;
        const rings = [
          { y: y0 + 0.28 * (y1 - y0), rx: 1.15 * h, ry: 0.3 * h, tilt: -0.12 },
          { y: y0 + 0.52 * (y1 - y0), rx: 1.3 * h, ry: 0.34 * h, tilt: 0.1 },
          { y: y0 + 0.78 * (y1 - y0), rx: 1.05 * h, ry: 0.26 * h, tilt: -0.06 },
        ];
        const ringHalf = (ring: (typeof rings)[0], front: boolean, idx: number) => {
          const band = 0.12 * h;
          const spin = (t2 / 2) * 0.09 * (idx % 2 ? -1 : 1);
          const n = 46;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + spin;
            const isFront = Math.sin(a) > 0;
            if (isFront !== front) continue;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const rot = (x: number, y: number): Pt => [cx + x * Math.cos(ring.tilt) - y * Math.sin(ring.tilt), ring.y + x * Math.sin(ring.tilt) + y * Math.cos(ring.tilt)];
            const p0 = rot(ca * ring.rx, sa * ring.ry - band / 2);
            const p1 = rot(ca * ring.rx + r.range(-3, 3), sa * ring.ry + band / 2);
            pen([p0, p1], 3.6);
          }
          // the ring's edges
          for (const e of [-1, 1]) {
            const edge: Pt[] = [];
            for (let i = 0; i <= 24; i++) {
              const a = (front ? 0 : Math.PI) + (i / 24) * Math.PI;
              const x = Math.cos(a) * ring.rx;
              const y = Math.sin(a) * ring.ry + (e * 0.12 * h) / 2;
              edge.push([cx + x * Math.cos(ring.tilt) - y * Math.sin(ring.tilt) + r.range(-1, 1), ring.y + x * Math.sin(ring.tilt) + y * Math.cos(ring.tilt)]);
            }
            pen(edge, 3);
          }
        };
        rings.forEach((rg, i) => ringHalf(rg, false, i));
        ctx.fillStyle = INK;
        ctx.fill(union);
        rings.forEach((rg, i) => ringHalf(rg, true, i));
        break;
      }
      case "blobs": {
        ctx.fillStyle = INK;
        for (const b of bones) {
          const { L } = boneFrame(b);
          const ang = Math.atan2(b.b[1] - b.a[1], b.b[0] - b.a[0]);
          const cx = (b.a[0] + b.b[0]) / 2;
          const cy = (b.a[1] + b.b[1]) / 2;
          const rx = L / 2 + (b.wa + b.wb) * 0.08;
          const ry = (b.wa + b.wb) / 4.4;
          const pts: Pt[] = [];
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            const k = 1 + r.range(-0.06, 0.06);
            const x = Math.cos(a) * rx * k;
            const y = Math.sin(a) * ry * k;
            pts.push([cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)]);
          }
          ctx.beginPath();
          smoothPath(ctx, pts, true);
          ctx.fill();
        }
        ctx.beginPath();
        const hc = pose.head.c;
        const hp: Pt[] = [];
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const k = pose.head.r * 1.02 * (1 + r.range(-0.05, 0.05));
          hp.push([hc[0] + Math.cos(a) * k * 0.95, hc[1] + Math.sin(a) * k * 1.08]);
        }
        smoothPath(ctx, hp, true);
        ctx.fill();
        break;
      }
    }
  };
};

// forceCut is a debug prop (walk-cycle review): hold one style for all frames.
export const StyleWalk: React.FC<{ forceCut?: number }> = ({ forceCut }) => {
  const draw = useMemo(() => makeDraw(forceCut), [forceCut]);
  return <CanvasComp draw={draw} />;
};
