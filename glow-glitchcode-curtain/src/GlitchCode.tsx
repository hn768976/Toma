import React, { useCallback, useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { Canvas2D, DrawFn } from "./Canvas2D";
import { CodeVersion } from "./colourways";
import { HEIGHT, LOOP } from "./constants";
import { makePage } from "./codegen";
import { CODE_FONT, loadCodeFont } from "./fonts";
import { finishPass } from "./finish";
import { GLITCH_EVENTS, GlitchEvent, Kind, intensityAt, isActive } from "./glitchSchedule";
import { clamp, hash2 } from "./rng";

/**
 * Look 2: Glitch Code. A page of invented code on black, run through a
 * failing-screen pipeline: sideways band jumps, horizontal smears and blurs,
 * R/G/B channel split, flashing blocks, scanlines and static. Every choice is
 * a function of (frame % 600) and the seeded schedule in glitchSchedule.ts.
 */

type Column = {
  x: number; // left edge, fraction of width
  size: number; // font size, fraction of frame height
  seed: number;
  extra: number; // lines beyond one screen: sets the scroll speed
  alpha: number;
  weight: 400 | 700;
  maxChars: number; // longest line drawn
};

// 3 loosely overlapping columns at different sizes. The hero column is large
// and sparse (short lines, so each line stays readable); the others are smaller.
const COLUMNS: Column[] = [
  { x: 0.012, size: 0.024, seed: 101, extra: 6, alpha: 0.9, weight: 400, maxChars: 30 },
  { x: 0.215, size: 0.034, seed: 303, extra: 4, alpha: 1, weight: 400, maxChars: 30 },
  { x: 0.62, size: 0.024, seed: 404, extra: 14, alpha: 0.95, weight: 400, maxChars: 36 },
];
const LINE_SPACING = 1.3;

const pages = COLUMNS.map((c) => {
  const lh = c.size * HEIGHT * LINE_SPACING;
  const rows = Math.ceil(HEIGHT / lh) + 1;
  const count = rows + c.extra;
  return { lines: makePage(c.seed, count).map((l) => l.slice(0, c.maxChars)), count, lh };
});

// ---- offscreen canvases -------------------------------------------------------
const mk = () => document.createElement("canvas");
const srcCanvas = mk();
const tint = [mk(), mk(), mk()];
const snap = mk();
const bloom = mk();
const bloom2 = mk();
let scanPattern: { key: string; pat: CanvasPattern } | null = null;

const sizeTo = (c: HTMLCanvasElement, w: number, h: number) => {
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
};

const drawText = (ctx: CanvasRenderingContext2D, v: CodeVersion, f: number, w: number, h: number, k: number) => {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "top";
  ctx.textRendering = "optimizeSpeed"; // plain glyphs, no ligatures
  ctx.fillStyle = v.text;
  COLUMNS.forEach((c, i) => {
    const { lines, count, lh } = pages[i];
    const off = (count * f) / LOOP; // whole page per loop: seamless
    const whole = Math.floor(off);
    const frac = off - whole;
    const rows = Math.ceil(HEIGHT / lh) + 1;
    ctx.font = `${c.weight} ${c.size * HEIGHT * k}px "${CODE_FONT}"`;
    ctx.globalAlpha = c.alpha;
    const x = c.x * w;
    for (let r = 0; r < rows; r++) {
      const line = lines[(r + whole) % count];
      if (!line) continue;
      ctx.fillText(line, x, (r - frac) * lh * k);
    }
  });
  ctx.globalAlpha = 1;
};

type Seg = { y0: number; y1: number; ev: GlitchEvent | null };

const wrapDraw = (
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
  w: number,
) => {
  for (let m = -1; m <= 1; m++) {
    const x = dx + m * w;
    if (x >= w || x + dw <= 0) continue;
    ctx.drawImage(img, sx, sy, sw, sh, x, dy, dw, dh);
  }
};

export const makeGlitchDraw =
  (v: CodeVersion): DrawFn =>
  (ctx, frame, w, h, k) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const I = intensityAt(f);
    const active = GLITCH_EVENTS.filter((e) => isActive(e, f, I));

    // 1. code layer, and its three channel-tinted copies
    sizeTo(srcCanvas, w, h);
    const sctx = srcCanvas.getContext("2d")!;
    drawText(sctx, v, f, w, h, k);
    tint.forEach((t, i) => {
      sizeTo(t, w, h);
      const tctx = t.getContext("2d")!;
      tctx.globalCompositeOperation = "copy";
      tctx.drawImage(srcCanvas, 0, 0);
      tctx.globalCompositeOperation = "multiply";
      tctx.fillStyle = v.channels[i];
      tctx.fillRect(0, 0, w, h);
      tctx.globalCompositeOperation = "source-over";
    });

    // 2. which event owns each row (later events override earlier ones)
    const bands = active.filter((e) => e.kind <= Kind.Blur);
    const rowEv = new Int32Array(h).fill(-1);
    bands.forEach((e, idx) => {
      const y0 = clamp(Math.round(e.y * k), 0, h);
      const y1 = clamp(Math.max(Math.round((e.y + e.h) * k), y0 + 1), 0, h);
      rowEv.fill(idx, y0, y1);
    });
    const segs: Seg[] = [];
    for (let y = 0; y < h; ) {
      const id = rowEv[y];
      let y1 = y + 1;
      while (y1 < h && rowEv[y1] === id) y1++;
      segs.push({ y0: y, y1, ev: id < 0 ? null : bands[id] });
      y = y1;
    }

    // 3. composite: red, green and blue layers, light-blended
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = true;
    // Outside glitch moments the split is only 1-2 px.
    const baseSplit = (1.5 + 3.5 * I) * k;
    for (let c = 0; c < 3; c++) {
      const img = tint[c];
      const baseOff = (c === 0 ? -1 : c === 1 ? 0.6 : 0.7) * baseSplit; // red / cyan fringe
      for (const s of segs) {
        const hh = s.y1 - s.y0;
        const e = s.ev;
        if (!e) {
          wrapDraw(ctx, img, 0, s.y0, w, hh, baseOff, s.y0, w, hh, w);
          continue;
        }
        const chOff = e.ch[c] * k + baseOff;
        const dx = Math.round(e.dx * w);
        const jitter = (hash2(e.id, f) % 1000) / 1000 - 0.5; // per-frame wobble
        if (e.kind === Kind.Shift) {
          const sy = clamp(s.y0 + Math.round(e.dy * k), 0, h - hh);
          wrapDraw(ctx, img, 0, sy, w, hh, dx + chOff, s.y0, w, hh, w);
        } else if (e.kind === Kind.Smear) {
          const sw = Math.max(2, Math.round(w / e.stretch));
          const sx = Math.round(e.sx * (w - sw));
          wrapDraw(ctx, img, sx, s.y0, sw, hh, dx + chOff, s.y0, w, hh, w);
        } else {
          const n = e.copies;
          ctx.globalAlpha = Math.min(1, 1.45 / n);
          for (let j = 0; j < n; j++) {
            const off = (j / (n - 1) - 0.5) * 2 * e.spread * k * (1 + 0.15 * jitter);
            wrapDraw(ctx, img, 0, s.y0, w, hh, dx + chOff + off, s.y0, w, hh, w);
          }
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.globalAlpha = 1;

    // 4. blocks
    ctx.globalCompositeOperation = "source-over";
    const disp = active.filter((e) => e.kind === Kind.Disp);
    if (disp.length) {
      sizeTo(snap, w, h);
      const snx = snap.getContext("2d")!;
      snx.globalCompositeOperation = "copy";
      snx.drawImage(ctx.canvas, 0, 0);
      for (const e of disp) {
        const x = Math.round(e.rx * w), y = Math.round(e.ry * h);
        const rw = Math.round(e.rw * w), rh = Math.round(e.rh * h);
        const sx = clamp(x + Math.round(e.rdx * w), 0, w - rw);
        const sy = clamp(y + Math.round(e.rdy * h), 0, h - rh);
        ctx.globalAlpha = e.alpha;
        ctx.drawImage(snap, sx, sy, rw, rh, x, y, rw, rh);
      }
      ctx.globalAlpha = 1;
    }
    const regions = active.filter((e) => e.kind === Kind.Region);
    if (regions.length) {
      sizeTo(snap, w, h);
      const snx = snap.getContext("2d")!;
      snx.globalCompositeOperation = "copy";
      snx.drawImage(ctx.canvas, 0, 0);
      for (const e of regions) {
        const x = Math.round(e.rx * w), y = Math.round(e.ry * h);
        const rw = Math.round(e.rw * w), rh = Math.max(1, Math.round(e.rh * h));
        const sw = Math.max(2, Math.round(rw / e.stretch));
        const sx = clamp(x + Math.round(e.rdx * w) + Math.round((rw - sw) / 2), 0, w - sw);
        ctx.globalAlpha = e.alpha;
        ctx.drawImage(snap, sx, y, sw, rh, x, y, rw, rh);
      }
      ctx.globalAlpha = 1;
    }
    for (const e of active) {
      if (e.kind !== Kind.Black && e.kind !== Kind.Bright) continue;
      const x = Math.round(e.rx * w), y = Math.round(e.ry * h);
      const rw = Math.round(e.rw * w), rh = Math.round(e.rh * h);
      ctx.fillStyle =
        e.kind === Kind.Black ? `rgba(0,0,0,${e.alpha})` : `rgba(214,214,218,${e.alpha})`;
      ctx.fillRect(x, y, rw, rh);
    }

    // bloom + lifted blacks, like a tired CRT: a blurred copy added back
    sizeTo(bloom, Math.max(2, Math.round(w / 8)), Math.max(2, Math.round(h / 8)));
    const bx = bloom.getContext("2d")!;
    bx.globalCompositeOperation = "copy";
    bx.drawImage(ctx.canvas, 0, 0, bloom.width, bloom.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(bloom, 0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgb(6,8,12)";
    ctx.fillRect(0, 0, w, h);
    // mottled compression-block texture in the darks: a fixed grid whose cells
    // re-roll every 3 frames (hash of cell and frame, no state)
    const cell = Math.max(4, Math.round(96 * k));
    const slot = Math.floor(f / 3);
    for (let by = 0, cy = 0; by < h; by += cell, cy++) {
      for (let bx = 0, cx = 0; bx < w; bx += cell, cx++) {
        const hv = hash2(cx * 7919 + cy * 104729, slot + 13);
        const u = (hv & 1023) / 1023;
        if (u > 0.2) continue;
        ctx.fillStyle = `rgba(52,66,82,${(0.02 + 0.09 * ((hv >>> 10) & 255) / 255 * (0.4 + 0.6 * I)).toFixed(3)})`;
        ctx.fillRect(bx, by, cell, cell);
      }
    }
    // second, wider bloom for the filmed-off-a-screen softness
    sizeTo(bloom2, Math.max(2, Math.round(w / 3)), Math.max(2, Math.round(h / 3)));
    const b2 = bloom2.getContext("2d")!;
    b2.globalCompositeOperation = "copy";
    b2.drawImage(ctx.canvas, 0, 0, bloom2.width, bloom2.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.28;
    ctx.drawImage(bloom2, 0, 0, w, h);
    ctx.globalAlpha = 1;
    // slight horizontal softening (analogue softness)
    sizeTo(snap, w, h);
    const sx2 = snap.getContext("2d")!;
    sx2.globalCompositeOperation = "copy";
    sx2.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.3;
    ctx.drawImage(snap, -1.1 * k * 1.5, 0);
    ctx.globalAlpha = 0.2;
    ctx.drawImage(snap, 1.1 * k * 1.5, 0);
    ctx.globalAlpha = 1;

    // 5. scanlines: every 3rd row at 8% dark (rows counted at 720p, scaled up)
    const period = Math.max(3, Math.round(9 * k));
    const key = `${period}`;
    if (!scanPattern || scanPattern.key !== key) {
      const pc = mk();
      pc.width = 1;
      pc.height = period;
      const pctx = pc.getContext("2d")!;
      pctx.fillStyle = "rgba(0,0,0,0.08)";
      pctx.fillRect(0, 0, 1, Math.max(1, Math.round(period / 3)));
      scanPattern = { key, pat: ctx.createPattern(pc, "repeat")! };
    }
    ctx.fillStyle = scanPattern.pat;
    ctx.fillRect(0, 0, w, h);

    // 6. static + dither
    finishPass(ctx, w, h, f, { grain: 0.03, coarse: 3 });
  };

export const GlitchCode: React.FC<{ version: CodeVersion }> = ({ version }) => {
  const [handle] = useState(() => delayRender("Loading JetBrains Mono"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadCodeFont().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  const draw = useCallback(
    (...args: Parameters<DrawFn>) => {
      if (ready) makeGlitchDraw(version)(...args);
    },
    [version, ready],
  );
  return <Canvas2D draw={draw} />;
};

