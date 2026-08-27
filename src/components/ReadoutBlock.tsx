import React, {useEffect, useMemo, useRef} from 'react';
import type {Rect} from '../lib/layout';
import {BORDER, DURATION} from '../lib/layout';
import {rgba} from '../lib/color';
import {condFont, monoFont, useFontsReady} from '../lib/fonts';
import {
  HEADER,
  brackets,
  hline,
  offscreen,
  panelShell,
  setLetterSpacing,
  toPal,
  vline,
} from '../lib/chrome';
import type {Pal} from '../lib/chrome';
import {
  clamp01,
  digits,
  hexish,
  pad,
  reveal,
  rnd,
  rndRange,
  rollFlick,
  rollValue,
} from '../lib/rand';
import type {Palette, Readouts, ValueSpec} from '../variants';

/** Every panel in the HUD is one of these. */
export type Block =
  | {kind: 'toprow'; spec: ValueSpec[]}
  | {kind: 'wave'; spec: Readouts['wave']}
  | {kind: 'table'; spec: Readouts['table']}
  | {kind: 'numeric'; spec: ValueSpec}
  | {kind: 'grid'; spec: Readouts['grid']}
  | {kind: 'meters'; spec: Readouts['meters']}
  | {kind: 'radar'; spec: Readouts['radar']}
  | {kind: 'scroll'; spec: Readouts['scroll']}
  | {kind: 'strips'; spec: ValueSpec[]}
  | {kind: 'hist'; spec: Readouts['hist']}
  | {kind: 'numerals'; spec: Readouts['numerals']}
  | {kind: 'status'; spec: Readouts['status']};

type Ctx = CanvasRenderingContext2D;

/* ───────────────────────── static chrome ───────────────────────── */

const chromeToprow = (ctx: Ctx, w: number, h: number, p: Pal, specs: ValueSpec[]) => {
  ctx.fillStyle = rgba(p.fill, 0.8);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(p.line, 0.85);
  ctx.fillRect(0, 0, w, BORDER);
  ctx.fillRect(0, h - BORDER, w, BORDER);
  brackets(ctx, 0, 0, w, h, 30, p.accent, 0.95, BORDER + 1);

  const lead = 150;
  vline(ctx, lead, 10, h - 20, p.line, 0.6);
  // marker box with a cross, like the reference frame's corner boxes
  ctx.strokeStyle = rgba(p.line, 0.9);
  ctx.lineWidth = BORDER;
  ctx.strokeRect(28, h / 2 - 34, 68, 68);
  ctx.beginPath();
  ctx.moveTo(44, h / 2 - 18);
  ctx.lineTo(80, h / 2 + 18);
  ctx.moveTo(80, h / 2 - 18);
  ctx.lineTo(44, h / 2 + 18);
  ctx.strokeStyle = rgba(p.text, 0.75);
  ctx.stroke();

  const cw = (w - lead) / specs.length;
  setLetterSpacing(ctx, '2px');
  ctx.textBaseline = 'alphabetic';
  specs.forEach((s, i) => {
    const x = lead + cw * i;
    if (i > 0) vline(ctx, x, 22, h - 44, p.line, 0.4);
    ctx.font = condFont(23, 600);
    ctx.fillStyle = rgba(p.text, 0.55);
    ctx.fillText(s.label, x + 22, 48);
    if (s.unit) {
      ctx.font = monoFont(19);
      ctx.fillStyle = rgba(p.accent, 0.8);
      ctx.fillText(s.unit, x + 22, h - 26);
    }
  });
  setLetterSpacing(ctx, '0px');
};

const chromeWave = (ctx: Ctx, w: number, h: number, p: Pal, s: Readouts['wave']) => {
  panelShell(ctx, w, h, p, s.label, s.sub);
  const top = HEADER + 12;
  const bh = h - top - 14;
  for (let i = 1; i < 8; i++)
    vline(ctx, 16 + ((w - 32) / 8) * i, top, bh, p.line, 0.14);
  for (let i = 1; i < 4; i++)
    hline(ctx, 16, top + (bh / 4) * i, w - 32, p.line, 0.14);
  hline(ctx, 16, top + bh / 2, w - 32, p.line, 0.32);
};

const chromeTable = (ctx: Ctx, w: number, h: number, p: Pal, s: Readouts['table']) => {
  panelShell(ctx, w, h, p, s.label);
  const top = HEADER + 8;
  const rows = Math.floor((h - top - 10) / 28);
  ctx.font = monoFont(19);
  ctx.textBaseline = 'middle';
  for (let i = 0; i < rows; i++) {
    const y = top + i * 28;
    if (i % 2 === 0) {
      ctx.fillStyle = rgba(p.line, 0.1);
      ctx.fillRect(12, y, w - 24, 27);
    }
    ctx.fillStyle = rgba(p.text, 0.66);
    ctx.fillText(s.tags[i % s.tags.length], 20, y + 14);
  }
  vline(ctx, 96, top, rows * 28, p.line, 0.28);
  vline(ctx, w - 208, top, rows * 28, p.line, 0.28);
};

const chromeNumeric = (ctx: Ctx, w: number, h: number, p: Pal, s: ValueSpec) => {
  ctx.fillStyle = rgba(p.fill, 0.86);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(p.line, 0.9);
  ctx.fillRect(0, 0, w, BORDER);
  ctx.fillRect(0, h - BORDER, w, BORDER);
  ctx.fillRect(0, 0, BORDER, h);
  ctx.fillRect(w - BORDER, 0, BORDER, h);
  brackets(ctx, 0, 0, w, h, 24, p.accent, 0.9, BORDER + 1);
  ctx.fillStyle = rgba(p.accent, 0.95);
  ctx.fillRect(14, 16, 6, h - 32);
  setLetterSpacing(ctx, '2.5px');
  ctx.font = condFont(25, 600);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgba(p.text, 0.7);
  ctx.fillText(s.label, 32, 42);
  setLetterSpacing(ctx, '0px');
};

const chromeGrid = (ctx: Ctx, w: number, h: number, p: Pal, s: Readouts['grid']) => {
  panelShell(ctx, w, h, p, s.label);
  const top = HEADER + 10;
  const cols = 2;
  const rows = Math.floor((h - top - 12) / 62);
  const cw = (w - 24) / cols;
  ctx.font = condFont(22, 400);
  ctx.textBaseline = 'middle';
  setLetterSpacing(ctx, '1.5px');
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 12 + c * cw;
      const y = top + r * 62;
      ctx.fillStyle = rgba(p.text, 0.6);
      ctx.fillText(s.tags[(r * cols + c) % s.tags.length], x + 62, y + 22);
      hline(ctx, x + 6, y + 54, cw - 24, p.line, 0.18);
    }
  }
  setLetterSpacing(ctx, '0px');
};

const chromeMeters = (ctx: Ctx, w: number, h: number, p: Pal, s: Readouts['meters']) => {
  panelShell(ctx, w, h, p, s.label);
  const top = HEADER + 16;
  const bh = h - top - 54;
  const n = s.tags.length;
  const cw = (w - 28) / n;
  ctx.font = monoFont(16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const x = 14 + cw * i;
    ctx.fillStyle = rgba(p.line, 0.16);
    ctx.fillRect(x + 3, top, cw - 6, bh);
    ctx.fillStyle = rgba(p.text, 0.55);
    ctx.fillText(s.tags[i], x + cw / 2, h - 26);
  }
  for (let i = 1; i < 5; i++) hline(ctx, 14, top + (bh / 5) * i, w - 28, p.line, 0.14);
  ctx.textAlign = 'left';
};

const chromeRadar = (ctx: Ctx, w: number, h: number, p: Pal, s: Readouts['radar']) => {
  panelShell(ctx, w, h, p, s[0].label, s[1].sub);
  const top = HEADER + 8;
  const ch = h - top - 12;
  const cw = w / 2;
  const r = Math.min(cw, ch) / 2 - 18;
  for (let i = 0; i < 2; i++) {
    const cx = cw * i + cw / 2;
    const cy = top + ch / 2;
    ctx.strokeStyle = rgba(p.line, 0.55);
    ctx.lineWidth = BORDER;
    for (const k of [1, 0.68, 0.36]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(p.line, 0.35);
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
    ctx.strokeStyle = rgba(p.accent, 0.7);
    for (let a = 0; a < 36; a++) {
      const th = (a / 36) * Math.PI * 2;
      const l = a % 3 === 0 ? 12 : 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r);
      ctx.lineTo(cx + Math.cos(th) * (r + l), cy + Math.sin(th) * (r + l));
      ctx.stroke();
    }
    ctx.font = monoFont(17);
    ctx.fillStyle = rgba(p.text, 0.5);
    ctx.textAlign = 'center';
    ctx.fillText(s[i].sub, cx, top + ch - 2);
    ctx.textAlign = 'left';
  }
};

const chromeScroll = (ctx: Ctx, w: number, h: number, p: Pal, s: Readouts['scroll']) => {
  panelShell(ctx, w, h, p, s.label);
  vline(ctx, 104, HEADER + 8, h - HEADER - 20, p.line, 0.24);
};

const chromeStrips = (ctx: Ctx, w: number, h: number, p: Pal, specs: ValueSpec[]) => {
  ctx.fillStyle = rgba(p.fill, 0.86);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(p.line, 0.9);
  ctx.fillRect(0, 0, w, BORDER);
  ctx.fillRect(0, h - BORDER, w, BORDER);
  ctx.fillRect(0, 0, BORDER, h);
  ctx.fillRect(w - BORDER, 0, BORDER, h);
  brackets(ctx, 0, 0, w, h, 26, p.accent, 0.9, BORDER + 1);
  const sh = h / specs.length;
  ctx.textBaseline = 'middle';
  specs.forEach((s, i) => {
    const y = sh * i;
    if (i > 0) hline(ctx, 12, y, w - 24, p.line, 0.3);
    setLetterSpacing(ctx, '2px');
    ctx.font = condFont(52, 600);
    ctx.fillStyle = rgba(p.text, 0.9);
    ctx.fillText(s.label, 24, y + sh / 2);
    setLetterSpacing(ctx, '0px');
  });
};

const chromeHist = (ctx: Ctx, w: number, h: number, p: Pal, s: Readouts['hist']) => {
  panelShell(ctx, w, h, p, s.label);
  const top = HEADER + 10;
  const bh = h - top - 16;
  hline(ctx, 14, top + bh, w - 28, p.line, 0.5);
  for (let i = 1; i < 4; i++) hline(ctx, 14, top + (bh / 4) * i, w - 28, p.line, 0.12);
};

const chromeNumerals = (
  ctx: Ctx,
  w: number,
  h: number,
  p: Pal,
  s: Readouts['numerals'],
) => {
  panelShell(ctx, w, h, p, s.label);
};

const chromeStatus = (ctx: Ctx, w: number, h: number, p: Pal, s: Readouts['status']) => {
  panelShell(ctx, w, h, p, s.label);
  const top = HEADER + 12;
  ctx.fillStyle = rgba(p.accent, 0.22);
  ctx.fillRect(12, top, w - 24, 62);
  ctx.fillStyle = rgba(p.accent, 0.9);
  ctx.fillRect(12, top, 8, 62);
};

/* ───────────────────────── per-frame content ───────────────────────── */

type DrawArgs = {
  ctx: Ctx;
  w: number;
  h: number;
  p: Pal;
  f: number;
  seed: string;
  flash: number;
  reroll: number;
  activity: number;
};

const val = (a: DrawArgs, s: ValueSpec, k: string, perSec = 4) =>
  rollValue(`${a.seed}${k}${a.reroll}`, a.f, perSec, s.lo, s.hi);

const drawToprow = (a: DrawArgs, specs: ValueSpec[]) => {
  const {ctx, w, h, p, f} = a;
  const lead = 150;
  const cw = (w - lead) / specs.length;
  ctx.textBaseline = 'alphabetic';
  specs.forEach((s, i) => {
    const x = lead + cw * i;
    const v = val(a, s, `t${i}`, 3 + (i % 3));
    const fk = rollFlick(f, 3 + (i % 3), `${a.seed}t${i}`);
    ctx.font = monoFont(48, 500);
    ctx.fillStyle = rgba(p.particle, 0.72 + 0.28 * fk + a.flash * 0.3);
    ctx.fillText(pad(v, s.dp ? 5 : 2, s.dp), x + 22, h - 24);
    // three-segment activity pip
    for (let k = 0; k < 3; k++) {
      const on = rnd(`${a.seed}p${i}${k}:${Math.floor(f / 8)}`) > 0.45;
      ctx.fillStyle = rgba(on ? p.particle : p.line, on ? 0.8 : 0.5);
      ctx.fillRect(x + cw - 60 + k * 16, h - 52, 10, 26);
    }
  });
};

const waveAt = (x: number, f: number, seed: string, act: number) => {
  let y = 0;
  for (let k = 0; k < 4; k++) {
    const n = 1 + k * 2;
    const m = 2 + k * 3;
    const ph = rnd(`${seed}w${k}`) * Math.PI * 2;
    const amp = (0.5 / (k + 1)) * (0.55 + 0.45 * act);
    y += amp * Math.sin(Math.PI * 2 * ((n * f) / DURATION + m * x) + ph);
  }
  return y;
};

const drawWave = (a: DrawArgs, s: Readouts['wave']) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 12;
  const bh = h - top - 14;
  const mid = top + bh / 2;
  const x0 = 16;
  const ww = w - 32;
  const N = 240;
  const act = s.energy * (0.5 + 0.5 * a.activity) + a.activity * 0.8;

  for (const [seedK, alpha, sc] of [
    ['b', 0.3, 0.55],
    ['a', 1, 1],
  ] as [string, number, number][]) {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y =
        mid -
        waveAt(t, f, `${a.seed}${seedK}`, act) * bh * 0.42 * sc -
        (rnd(`${a.seed}${seedK}n${i}:${Math.floor(f / 5)}`) - 0.5) * bh * 0.05 * act;
      if (i === 0) ctx.moveTo(x0 + t * ww, y);
      else ctx.lineTo(x0 + t * ww, y);
    }
    ctx.strokeStyle = rgba(p.particle, (0.55 + a.flash * 0.4) * alpha);
    ctx.lineWidth = 3 * sc;
    ctx.stroke();
  }

  // running cursor
  const cx = x0 + ((f % 150) / 150) * ww;
  ctx.fillStyle = rgba(p.sweep, 0.7);
  ctx.fillRect(cx, top, 2, bh);
  ctx.fillStyle = rgba(p.sweep, 0.9);
  ctx.fillRect(cx - 5, mid - waveAt((cx - x0) / ww, f, `${a.seed}a`, act) * bh * 0.42 - 5, 10, 10);
};

const drawTable = (a: DrawArgs, s: Readouts['table']) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 8;
  const rows = Math.floor((h - top - 10) / 28);
  ctx.font = monoFont(19);
  ctx.textBaseline = 'middle';
  const hot = Math.floor((f / 6) % rows);
  for (let i = 0; i < rows; i++) {
    const y = top + i * 28 + 14;
    const isHot = i === hot;
    if (isHot) {
      ctx.fillStyle = rgba(p.accent, 0.28);
      ctx.fillRect(12, y - 13, w - 24, 26);
    }
    const v = rollValue(`${a.seed}r${i}${a.reroll}`, f, 3 + (i % 3), 0, 1);
    ctx.fillStyle = rgba(isHot ? p.hot : p.particle, 0.55 + 0.35 * v + a.flash * 0.3);
    ctx.fillText(digits(`${a.seed}d${i}:${Math.floor(f / 10) + i}`, 6), 108, y);
    ctx.fillStyle = rgba(p.line, 0.45);
    ctx.fillRect(w - 198, y - 7, 118, 14);
    ctx.fillStyle = rgba(p.particle, 0.5 + 0.4 * v);
    ctx.fillRect(w - 198, y - 7, 118 * v, 14);
    ctx.fillStyle = rgba(p.text, 0.55);
    ctx.fillText(pad(Math.round(v * 99), 2), w - 62, y);
  }
};

const drawNumeric = (a: DrawArgs, s: ValueSpec) => {
  const {ctx, w, h, p, f} = a;
  const v = val(a, s, 'n', 3);
  const fk = rollFlick(f, 3, `${a.seed}n`);
  ctx.font = monoFont(76, 500);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgba(p.particle, 0.85 + 0.15 * fk + a.flash * 0.2);
  ctx.fillText(pad(v, 3, s.dp), w - 26, h - 34);
  ctx.textAlign = 'left';
  ctx.fillStyle = rgba(p.line, 0.5);
  ctx.fillRect(32, h - 22, w - 60, 8);
  ctx.fillStyle = rgba(p.particle, 0.8);
  ctx.fillRect(32, h - 22, (w - 60) * ((v - s.lo) / (s.hi - s.lo)), 8);
};

const drawGrid = (a: DrawArgs, s: Readouts['grid']) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 10;
  const cols = 2;
  const rows = Math.floor((h - top - 12) / 62);
  const cw = (w - 24) / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = 12 + c * cw;
      const y = top + r * 62;
      const v = rollValue(`${a.seed}g${i}${a.reroll}`, f, 3 + (i % 3), 0.08, 1);
      // arc gauge
      ctx.beginPath();
      ctx.arc(x + 30, y + 22, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
      ctx.lineTo(x + 30, y + 22);
      ctx.fillStyle = rgba(p.particle, 0.65 + 0.3 * a.flash);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 30, y + 22, 19, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(p.line, 0.8);
      ctx.lineWidth = BORDER;
      ctx.stroke();
      // tiny bar under the label
      ctx.fillStyle = rgba(p.particle, 0.5 + 0.4 * v);
      ctx.fillRect(x + 62, y + 40, (cw - 96) * v, 7);
    }
  }
};

const drawMeters = (a: DrawArgs, s: Readouts['meters']) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 16;
  const bh = h - top - 54;
  const n = s.tags.length;
  const cw = (w - 28) / n;
  for (let i = 0; i < n; i++) {
    const x = 14 + cw * i;
    const v = rollValue(`${a.seed}m${i}${a.reroll}`, f, 3 + (i % 3), 0.1, 1);
    const seg = 22;
    const lit = Math.round(v * seg);
    for (let k = 0; k < seg; k++) {
      const yy = top + bh - (k + 1) * (bh / seg) + 2;
      const on = k < lit;
      ctx.fillStyle = rgba(
        on ? (k > seg * 0.8 ? p.hot : p.particle) : p.line,
        on ? 0.85 + a.flash * 0.15 : 0.22,
      );
      ctx.fillRect(x + 5, yy, cw - 10, bh / seg - 4);
    }
    ctx.fillStyle = rgba(p.sweep, 0.9);
    ctx.fillRect(x + 3, top + bh - v * bh - 3, cw - 6, 3);
  }
};

const drawRadar = (a: DrawArgs, s: Readouts['radar']) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 8;
  const ch = h - top - 12;
  const cw = w / 2;
  const r = Math.min(cw, ch) / 2 - 18;
  for (let i = 0; i < 2; i++) {
    const cx = cw * i + cw / 2;
    const cy = top + ch / 2;
    const ang = (Math.PI * 2 * s[i].turns * f) / DURATION - Math.PI / 2;

    // sweep wedge
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, ang - 1.1, ang);
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, rgba(p.particle, 0.05));
    grad.addColorStop(1, rgba(p.particle, 0.3));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = rgba(p.sweep, 0.95);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.stroke();

    for (let b = 0; b < 5; b++) {
      const ba = rnd(`${a.seed}ba${i}${b}`) * Math.PI * 2;
      const br = (0.28 + rnd(`${a.seed}br${i}${b}`) * 0.66) * r;
      const da = (((ang - ba) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const fade = Math.max(0, 1 - da / 2.4);
      ctx.fillStyle = rgba(p.hot, 0.15 + 0.85 * fade);
      const sz = 8 + fade * 6;
      ctx.fillRect(cx + Math.cos(ba) * br - sz / 2, cy + Math.sin(ba) * br - sz / 2, sz, sz);
    }
  }
};

const drawScroll = (a: DrawArgs, s: Readouts['scroll']) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 6;
  const bh = h - top - 10;
  const lineH = 27;
  const K = 60; // whole lines scrolled per loop, so the block closes on 600
  const off = (f / DURATION) * K * lineH;
  const first = Math.floor(off / lineH);
  const n = Math.ceil(bh / lineH) + 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(8, top, w - 16, bh);
  ctx.clip();
  ctx.font = monoFont(19);
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const idx = first + i;
    const y = top + i * lineH - (off % lineH) + lineH / 2;
    const k = ((idx % K) + K) % K;
    const em = rnd(`${a.seed}e${k}`) > 0.82;
    ctx.fillStyle = rgba(em ? p.hot : p.text, em ? 0.95 : 0.5);
    ctx.fillText(
      `${s.tokens[k % s.tokens.length]}${pad(k, 3)}`,
      18,
      y,
    );
    ctx.fillStyle = rgba(em ? p.particle : p.text, em ? 0.9 : 0.38);
    ctx.fillText(
      `${hexish(`${a.seed}h${k}`, 8)}  ${digits(`${a.seed}q${k}:${Math.floor(f / 12)}`, 10)}`,
      118,
      y,
    );
  }
  ctx.restore();
};

const drawStrips = (a: DrawArgs, specs: ValueSpec[]) => {
  const {ctx, w, h, p, f} = a;
  const sh = h / specs.length;
  ctx.textBaseline = 'middle';
  specs.forEach((s, i) => {
    const y = sh * i;
    const v = val(a, s, `s${i}`, 3);
    const t = (v - s.lo) / (s.hi - s.lo);
    const bx = 120;
    const bw = w - bx - 150;
    ctx.fillStyle = rgba(p.line, 0.4);
    ctx.fillRect(bx, y + sh / 2 - 16, bw, 32);
    ctx.fillStyle = rgba(p.particle, 0.8 + a.flash * 0.2);
    ctx.fillRect(bx, y + sh / 2 - 16, bw * t, 32);
    for (let k = 1; k < 10; k++) {
      ctx.fillStyle = rgba(p.fill, 0.9);
      ctx.fillRect(bx + (bw / 10) * k, y + sh / 2 - 16, 3, 32);
    }
    ctx.font = monoFont(34, 500);
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(p.text, 0.85);
    ctx.fillText(pad(v, 3, s.dp), w - 24, y + sh / 2);
    ctx.textAlign = 'left';
  });
};

const drawHist = (a: DrawArgs) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 10;
  const bh = h - top - 16;
  const n = 76;
  const cw = (w - 28) / n;
  for (let i = 0; i < n; i++) {
    const x = 14 + cw * i;
    const base = 0.25 + 0.6 * Math.abs(Math.sin((i / n) * Math.PI * 2.5 + (f / DURATION) * Math.PI * 4));
    const v = clamp01(base * rollValue(`${a.seed}b${i}${a.reroll}`, f, 4 + (i % 2), 0.35, 1.25));
    ctx.fillStyle = rgba(v > 0.75 ? p.hot : p.particle, 0.55 + 0.4 * v + a.flash * 0.2);
    ctx.fillRect(x + 2, top + bh - v * bh, cw - 5, v * bh);
  }
};

const drawNumerals = (a: DrawArgs) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 12;
  const lineH = 24;
  const rows = Math.floor((h - top - 8) / lineH);
  ctx.font = monoFont(18);
  ctx.textBaseline = 'middle';
  const cols = Math.floor((w - 28) / 122);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const em = rnd(`${a.seed}z${i}:${Math.floor(f / 15)}`) > 0.86;
      ctx.fillStyle = rgba(em ? p.hot : p.text, em ? 0.95 : 0.42);
      ctx.fillText(
        digits(`${a.seed}n${i}:${Math.floor(f / 9) + i}`, 6),
        16 + c * 122,
        top + r * lineH + lineH / 2,
      );
    }
  }
};

const drawStatus = (a: DrawArgs, s: Readouts['status']) => {
  const {ctx, w, h, p, f} = a;
  const top = HEADER + 12;
  const idx = Math.floor((f / 90) % s.states.length);
  setLetterSpacing(ctx, '3px');
  ctx.font = condFont(42, 600);
  ctx.textBaseline = 'middle';
  const blink = 0.65 + 0.35 * Math.sin((f / 20) * Math.PI * 2);
  ctx.fillStyle = rgba(p.hot, blink);
  ctx.fillText(s.states[idx], 36, top + 31);
  setLetterSpacing(ctx, '0px');

  ctx.fillStyle = rgba(p.sweep, blink);
  ctx.beginPath();
  ctx.arc(w - 44, top + 31, 14, 0, Math.PI * 2);
  ctx.fill();

  // progress + segment strip
  const py = top + 82;
  const prog = (f % 300) / 300;
  ctx.fillStyle = rgba(p.line, 0.5);
  ctx.fillRect(12, py, w - 24, 20);
  ctx.fillStyle = rgba(p.particle, 0.85);
  ctx.fillRect(12, py, (w - 24) * prog, 20);
  const seg = 46;
  for (let i = 0; i < seg; i++) {
    const on = rnd(`${a.seed}s${i}:${Math.floor(f / 7)}`) > 0.5;
    ctx.fillStyle = rgba(on ? p.particle : p.line, on ? 0.85 : 0.3);
    ctx.fillRect(12 + i * ((w - 24) / seg), py + 34, (w - 24) / seg - 5, 22);
  }
};

/* ───────────────────────── component ───────────────────────── */

export const ReadoutBlock: React.FC<{
  block: Block;
  rect: Rect;
  palette: Palette;
  frame: number;
  seed: string;
  delay: number;
  flash: number;
  reroll: number;
  activity: number;
}> = ({block, rect, palette, frame, seed, delay, flash, reroll, activity}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const ready = useFontsReady();
  const p = useMemo(() => toPal(palette), [palette]);

  const chrome = useMemo(() => {
    const w = Math.round(rect.w);
    const h = Math.round(rect.h);
    const c = offscreen(w, h);
    const ctx = c.getContext('2d')!;
    switch (block.kind) {
      case 'toprow': chromeToprow(ctx, w, h, p, block.spec); break;
      case 'wave': chromeWave(ctx, w, h, p, block.spec); break;
      case 'table': chromeTable(ctx, w, h, p, block.spec); break;
      case 'numeric': chromeNumeric(ctx, w, h, p, block.spec); break;
      case 'grid': chromeGrid(ctx, w, h, p, block.spec); break;
      case 'meters': chromeMeters(ctx, w, h, p, block.spec); break;
      case 'radar': chromeRadar(ctx, w, h, p, block.spec); break;
      case 'scroll': chromeScroll(ctx, w, h, p, block.spec); break;
      case 'strips': chromeStrips(ctx, w, h, p, block.spec); break;
      case 'hist': chromeHist(ctx, w, h, p, block.spec); break;
      case 'numerals': chromeNumerals(ctx, w, h, p, block.spec); break;
      case 'status': chromeStatus(ctx, w, h, p, block.spec); break;
    }
    return c;
  }, [block, rect.w, rect.h, p, ready]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const w = cv.width;
    const h = cv.height;
    ctx.clearRect(0, 0, w, h);
    const app = reveal(frame, delay, 14);
    if (app <= 0) return;

    ctx.save();
    ctx.globalAlpha = app;
    ctx.beginPath();
    ctx.rect(0, 0, w * (0.2 + 0.8 * app), h);
    ctx.clip();
    ctx.drawImage(chrome, 0, 0);

    const a: DrawArgs = {ctx, w, h, p, f: frame, seed, flash, reroll, activity};
    switch (block.kind) {
      case 'toprow': drawToprow(a, block.spec); break;
      case 'wave': drawWave(a, block.spec); break;
      case 'table': drawTable(a, block.spec); break;
      case 'numeric': drawNumeric(a, block.spec); break;
      case 'grid': drawGrid(a, block.spec); break;
      case 'meters': drawMeters(a, block.spec); break;
      case 'radar': drawRadar(a, block.spec); break;
      case 'scroll': drawScroll(a, block.spec); break;
      case 'strips': drawStrips(a, block.spec); break;
      case 'hist': drawHist(a); break;
      case 'numerals': drawNumerals(a); break;
      case 'status': drawStatus(a, block.spec); break;
    }
    ctx.restore();

    // bloom on the brightest panel elements
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 * app;
    ctx.filter = 'blur(7px)';
    ctx.drawImage(cv, 0, 0);
    ctx.restore();
    ctx.filter = 'none';
  }, [block, chrome, frame, p, seed, delay, flash, reroll, activity]);

  return (
    <canvas
      ref={ref}
      width={Math.round(rect.w)}
      height={Math.round(rect.h)}
      style={{
        position: 'absolute',
        left: Math.round(rect.x),
        top: Math.round(rect.y),
        width: Math.round(rect.w),
        height: Math.round(rect.h),
      }}
    />
  );
};
