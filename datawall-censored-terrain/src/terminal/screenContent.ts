import { MONO_FAMILY, STAMP_FAMILY } from "../lib/fonts";
import { hashU, mulberry32 } from "../lib/random";
import type { TerminalVersion } from "../versions";
import { T, clamp01, easeOutBack } from "./timeline";

// Both screen canvases are redrawn from scratch every frame from the frame number alone.

export const TEXT_CANVAS = { w: 4096, h: 2304 };
export const LABEL_CANVAS = { w: 4096, h: 2304 };

// ------------------------------------------------------------------ text screen layout
export const TEXT_LAYOUT = {
  fontPx: 120,
  left: 260,
  firstBaseline: 1000,
  lineGap: 215,
};

const font = (px: number) => `500 ${px}px ${MONO_FAMILY}`;

// Redaction bar segments per line: word groups split at a few seeded spaces.
export const redactionSegments = (line: string, lineIndex: number) => {
  const rng = mulberry32(4500 + lineIndex * 31);
  const segs: [number, number][] = [];
  let start = 0;
  for (let i = 0; i <= line.length; i++) {
    const atEnd = i === line.length;
    if (atEnd || (line[i] === " " && i - start > 6 && rng() < 0.45)) {
      segs.push([start, atEnd ? i : i]);
      start = i + 1;
    }
  }
  return segs.filter(([a, b]) => b > a);
};

// Some letters arrive a few frames late, leaving brief gaps that fill in (glitchy typing).
export const charAppear = (li: number, ci: number) => {
  const base = T.lineStart[li] + ci * T.framesPerChar;
  const hsh = hashU(li * 7907 + ci * 131 + 17);
  return hsh < 0.3 ? base + 3 + Math.floor(hashU(li * 31 + ci * 977 + 3) * 12) : base;
};

const typedCount = (frame: number, li: number, len: number) =>
  Math.max(0, Math.min(len, Math.floor((frame - T.lineStart[li]) / T.framesPerChar) + 1));

export const drawTextScreen = (ctx: CanvasRenderingContext2D, frame: number, v: TerminalVersion) => {
  const { w, h } = TEXT_CANVAS;
  const L = TEXT_LAYOUT;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = v.background;
  ctx.fillRect(0, 0, w, h);
  ctx.font = font(L.fontPx);
  ctx.textBaseline = "alphabetic";
  const adv = ctx.measureText("M").width;
  const capTop = L.fontPx * 0.78;
  const cellH = L.fontPx * 0.95;

  const drawChars = (s: string, x: number, y: number, color: string, glow: number) => {
    ctx.fillStyle = color;
    ctx.shadowColor = v.textGlow;
    ctx.shadowBlur = glow;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 0;
  };

  // Boot glitch: scattered letters flash in for a frame or two.
  if (frame < T.bootEnd + 6) {
    const n = frame < T.bootEnd ? 2 + Math.floor(hashU(frame * 977 + 13) * 6) : 1;
    for (let k = 0; k < n; k++) {
      const hsh = hashU(frame * 7919 + k * 104729 + 1);
      const li = Math.floor(hsh * 3);
      const line = v.lines[li];
      const ci = Math.floor(hashU(frame * 31 + k * 977 + 5) * line.length);
      const ch = line[ci] === " " ? "#" : line[ci];
      drawChars(ch, L.left + ci * adv, L.firstBaseline + li * L.lineGap, v.text, 40);
    }
  }

  // Typed text, cursors, highlight/redaction bars.
  for (let li = 0; li < 3; li++) {
    const line = v.lines[li];
    const y = L.firstBaseline + li * L.lineGap;
    const n = typedCount(frame, li, line.length);
    const segs = redactionSegments(line, li);
    const hlP = clamp01((frame - T.hlStart[li]) / T.hlDur);
    const edgeX = L.left - 40 + hlP * (line.length * adv + 80);
    const covered = (ci: number) => hlP > 0 && L.left + (ci + 0.5) * adv < edgeX && segs.some(([a, b]) => ci >= a && ci < b);

    // Text, skipping characters under a bar. Newly typed characters flash brighter.
    let run = "";
    let runStart = 0;
    const flush = (end: number) => {
      if (run.trim().length) drawChars(run, L.left + runStart * adv, y, v.text, 46);
      run = "";
      runStart = end;
    };
    // Faint LED cell behind every typed character position.
    if (n > 0) {
      ctx.fillStyle = v.text;
      ctx.globalAlpha = 0.045;
      for (let ci = 0; ci < n; ci++) {
        if (line[ci] !== " " && !covered(ci)) ctx.fillRect(L.left + ci * adv + adv * 0.05, y - capTop - L.fontPx * 0.06, adv * 0.9, cellH);
      }
      ctx.globalAlpha = 1;
    }
    for (let ci = 0; ci < n; ci++) {
      const age = frame - charAppear(li, ci);
      if (age < 0) {
        flush(ci + 1);
        continue;
      }
      if (covered(ci) || age < 2) {
        flush(ci + 1);
        if (!covered(ci) && line[ci] !== " ") drawChars(line[ci], L.left + ci * adv, y, "#FFFFFF", 60);
        continue;
      }
      run += line[ci];
    }
    flush(n);

    // Block cursor at the end of a line while it types; the last line's cursor keeps
    // blinking until the highlight starts. Before typing, line 1 has a blinking cursor.
    const typing = frame >= T.lineStart[li] && n < line.length;
    const idleBlink = Math.floor(frame / 8) % 2 === 0;
    const showCursor =
      typing ||
      (li === 0 && frame < T.lineStart[0] && idleBlink) ||
      (li === 2 && n === line.length && frame < T.hlStart[0] && idleBlink);
    if (showCursor) {
      ctx.fillStyle = v.text;
      ctx.shadowColor = v.textGlow;
      ctx.shadowBlur = 40;
      ctx.fillRect(L.left + n * adv + adv * 0.08, y - capTop, adv * 0.84, cellH);
      ctx.shadowBlur = 0;
    }

    // Highlight / redaction bars.
    if (hlP > 0) {
      for (const [a, b] of segs) {
        const x0 = L.left + a * adv - adv * 0.25;
        const x1 = Math.min(L.left + b * adv + adv * 0.1, edgeX);
        if (x1 <= x0) continue;
        ctx.fillStyle = v.strip;
        ctx.shadowColor = v.textGlow;
        ctx.shadowBlur = hlP < 1 ? 70 : 45;
        ctx.fillRect(x0, y - capTop - L.fontPx * 0.12, x1 - x0, cellH + L.fontPx * 0.18);
      }
      ctx.shadowBlur = 0;
      // Bright leading edge while sweeping.
      if (hlP < 1) {
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = v.textGlow;
        ctx.shadowBlur = 80;
        ctx.fillRect(edgeX - 18, y - capTop - L.fontPx * 0.12, 18, cellH + L.fontPx * 0.18);
        ctx.shadowBlur = 0;
      }
    }
  }
  ctx.restore();
};

// ------------------------------------------------------------------ label screen
// Static blurred background shape, rendered once (deterministic): a large round "globe"
// outline with vertical scan-lines and a two-colour fringe at its edge.
export const makeGlobe = (v: TerminalVersion) => {
  const { w, h } = LABEL_CANVAS;
  const sharp = document.createElement("canvas");
  sharp.width = w;
  sharp.height = h;
  const g = sharp.getContext("2d")!;
  g.fillStyle = v.background;
  g.fillRect(0, 0, w, h);
  const cx = w * 0.6;
  const cy = h * 0.5;
  const r = h * 0.62;
  // body
  const grad = g.createRadialGradient(cx - r * 0.25, cy - r * 0.2, r * 0.1, cx, cy, r);
  grad.addColorStop(0, v.shapeTint);
  grad.addColorStop(0.75, v.shapeTint);
  grad.addColorStop(1, v.background);
  g.globalAlpha = 0.95;
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  // meridian / parallel hints (very soft after blur)
  g.globalAlpha = 0.35;
  g.strokeStyle = v.background;
  g.lineWidth = 26;
  for (let k = -2; k <= 2; k++) {
    g.beginPath();
    g.ellipse(cx, cy, Math.abs(k) * r * 0.3 + 30, r, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // fringe
  g.globalAlpha = 0.9;
  g.lineWidth = 90;
  g.strokeStyle = v.fringeA;
  g.beginPath();
  g.arc(cx - 50, cy, r, Math.PI * 0.5, Math.PI * 1.5);
  g.stroke();
  g.strokeStyle = v.fringeB;
  g.beginPath();
  g.arc(cx + 50, cy, r, -Math.PI * 0.5, Math.PI * 0.5);
  g.stroke();
  // thin mixed band between them where the two fringes overlap
  g.globalAlpha = 0.5;
  g.lineWidth = 40;
  g.strokeStyle = v.shapeTint;
  g.beginPath();
  g.arc(cx, cy, r + 40, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const o = out.getContext("2d")!;
  o.fillStyle = v.background;
  o.fillRect(0, 0, w, h);
  o.filter = "blur(60px)";
  o.drawImage(sharp, 0, 0);
  o.filter = "none";
  // vertical scan-lines over the shape
  o.globalCompositeOperation = "multiply";
  o.fillStyle = "rgba(0,0,0,0.3)";
  for (let x = 0; x < w; x += 28) o.fillRect(x, 0, 12, h);
  o.globalCompositeOperation = "source-over";
  return out;
};

export const LABEL_LAYOUT = {
  stripX: 520,
  stripY: 860,
  stripW: 3000,
  stripH: 560,
};

export const drawLabelScreen = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  v: TerminalVersion,
  globe: HTMLCanvasElement,
) => {
  const { w, h } = LABEL_CANVAS;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = v.background;
  ctx.fillRect(0, 0, w, h);

  // Background shape, with horizontal slice offsets during glitch events.
  let glitchIdx = -1;
  for (let i = 0; i < T.bgGlitches.length; i++) {
    const [s, d] = T.bgGlitches[i];
    if (frame >= s && frame < s + d) glitchIdx = i;
  }
  if (glitchIdx < 0) {
    ctx.drawImage(globe, 0, 0);
  } else {
    const slices = 9;
    let y = 0;
    for (let k = 0; k < slices && y < h; k++) {
      const sh = Math.round((h / slices) * (0.5 + hashU(glitchIdx * 101 + k * 7 + frame * 3) * 1.0));
      const off = (hashU(glitchIdx * 211 + k * 13 + frame * 17) - 0.5) * 260;
      ctx.drawImage(globe, 0, y, w, sh, off, y, w, sh);
      y += sh;
    }
  }

  // Label strip slides in from the right with an overshoot, then holds.
  const p = (frame - T.labelIn[0]) / (T.labelIn[1] - T.labelIn[0]);
  if (p > 0) {
    const L = LABEL_LAYOUT;
    const x = L.stripX + (1 - easeOutBack(p, 1.15)) * (w - L.stripX + 200);
    ctx.fillStyle = v.strip;
    ctx.shadowColor = v.strip;
    ctx.shadowBlur = 60;
    ctx.fillRect(x, L.stripY, L.stripW, L.stripH);
    ctx.shadowBlur = 0;
    // Stamp word, fitted to the strip.
    let px = L.stripH * 0.95;
    ctx.font = `700 ${px}px ${STAMP_FAMILY}`;
    const maxW = L.stripW * 0.84;
    const mw = ctx.measureText(v.stamp).width;
    if (mw > maxW) {
      px *= maxW / mw;
      ctx.font = `700 ${px}px ${STAMP_FAMILY}`;
    }
    ctx.fillStyle = v.stampInk;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(v.stamp, x + L.stripW * 0.52, L.stripY + L.stripH * 0.53);
  }
  ctx.restore();
};
