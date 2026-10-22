import type { IconName, OutputKind } from "../layout";
import type { Palette } from "../theme";
import { clamp01, hash2, rgba } from "../util";
import { drawIcon } from "./icons";

// Glass panels, floor labels and counters. Every function draws in canvas
// pixels; callers pass `ppu` (pixels per floor unit) to size strokes.

type Ctx = CanvasRenderingContext2D;

export const FONT_LABEL = "AgentLabel";
export const FONT_MONO = "AgentMono";

export type GlassOpts = {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  ppu: number;
  fill?: number; // fill strength multiplier
  border?: number; // border strength multiplier
  gradientBorder?: boolean; // primary → secondary towards bottom-right
};

export const drawGlass = (ctx: Ctx, pal: Palette, o: GlassOpts) => {
  const { x, y, w, h, r, ppu } = o;
  const fillK = o.fill ?? 1;
  const borderK = o.border ?? 1;
  ctx.save();

  // Body: faint primary tint, slightly stronger along the bottom-right.
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, rgba(pal.primary, 0.1 * fillK));
  g.addColorStop(0.55, rgba(pal.primary, 0.05 * fillK));
  g.addColorStop(1, rgba(o.gradientBorder ? pal.secondary : pal.primary, 0.2 * fillK));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  // Soft sheen on the top-left.
  const sheen = ctx.createRadialGradient(x + w * 0.2, y + h * 0.15, 0, x + w * 0.2, y + h * 0.15, Math.max(w, h) * 0.7);
  sheen.addColorStop(0, rgba("#ffffff", 0.05 * fillK));
  sheen.addColorStop(1, rgba("#ffffff", 0));
  ctx.fillStyle = sheen;
  ctx.fill();

  // Border.
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, rgba(pal.primary, 0.85 * borderK));
  bg.addColorStop(0.62, rgba(pal.primary, 0.4 * borderK));
  bg.addColorStop(1, rgba(o.gradientBorder ? pal.secondary : pal.primary, 0.95 * borderK));
  ctx.strokeStyle = bg;
  ctx.lineWidth = ppu * 0.045;
  ctx.shadowColor = o.gradientBorder ? pal.secondary : pal.primary;
  ctx.shadowBlur = ppu * 0.25;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();

  // Inner hairline.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(pal.primary, 0.18 * borderK);
  ctx.lineWidth = ppu * 0.018;
  const ins = ppu * 0.14;
  ctx.beginPath();
  ctx.roundRect(x + ins, y + ins, w - ins * 2, h - ins * 2, Math.max(0, r - ins));
  ctx.stroke();
  ctx.restore();
};

/** Small square tile with a glowing icon (input / workflow nodes). */
export const drawIconTile = (
  ctx: Ctx,
  pal: Palette,
  W: number,
  H: number,
  pad: number,
  ppu: number,
  icon: IconName,
  accent: string,
  extra?: { lines: boolean; t: number },
) => {
  const w = W - pad * 2;
  const h = H - pad * 2;
  drawGlass(ctx, pal, { x: pad, y: pad, w, h, r: ppu * 0.32, ppu, fill: 1.3 });
  const iconBox = Math.min(h, extra?.lines ? h : w);
  const cx = extra?.lines ? pad + iconBox * 0.5 : pad + w / 2;
  drawIcon(ctx, icon, cx, pad + h / 2, iconBox * 0.62, accent, ppu * 0.25);
  if (extra?.lines) {
    // Tiny "log" text lines to the right of the icon.
    ctx.save();
    ctx.fillStyle = rgba(pal.primary, 0.55);
    ctx.font = `${Math.round(ppu * 0.17)}px ${FONT_MONO}`;
    const x0 = pad + iconBox * 1.0;
    for (let i = 0; i < 5; i++) {
      const y = pad + h * 0.24 + i * ppu * 0.27;
      const n = Math.floor(hash2(i, Math.floor(extra.t / 6)) * 1e8);
      const lw = (0.5 + 0.5 * hash2(i, 7)) * (w - iconBox * 1.15);
      ctx.globalAlpha = i === 0 ? 0.9 : 0.55;
      ctx.fillText(i === 0 ? "SECURITY CHECK" : `0x${n.toString(16).padStart(7, "0")}`, x0, y + ppu * 0.08, lw);
    }
    ctx.restore();
  }
};

/** Wide output card: icon well on the left, a little data widget on the right. */
export const drawOutputCard = (
  ctx: Ctx,
  pal: Palette,
  W: number,
  H: number,
  pad: number,
  ppu: number,
  icon: IconName,
  kind: OutputKind,
  t: number,
  reveal: number,
) => {
  const w = W - pad * 2;
  const h = H - pad * 2;
  drawGlass(ctx, pal, { x: pad, y: pad, w, h, r: ppu * 0.3, ppu, fill: 0.7, border: 0.6 });
  const well = h * 0.66;
  const wx = pad + h * 0.17;
  const wy = pad + (h - well) / 2;
  drawGlass(ctx, pal, { x: wx, y: wy, w: well, h: well, r: ppu * 0.18, ppu, fill: 1.4, border: 0.8 });
  drawIcon(ctx, icon, wx + well / 2, wy + well / 2, well * 0.68, pal.primary, ppu * 0.2);

  const x0 = wx + well + h * 0.35;
  const x1 = pad + w - h * 0.25;
  const cy = pad + h / 2;
  const span = x1 - x0;
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowBlur = ppu * 0.15;
  const k = clamp01(reveal);
  switch (kind) {
    case "bars": {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + t * 0.06 + hash2(i, 3)));
        const bh = h * 0.5 * v * k;
        const bw = (span / n) * 0.5;
        const bx = x1 - span * 0.55 + (i * span * 0.55) / n;
        ctx.fillStyle = rgba(pal.secondary, 0.85);
        ctx.shadowColor = pal.secondary;
        ctx.fillRect(bx, cy + h * 0.25 - bh, bw, bh);
      }
      ctx.fillStyle = rgba(pal.primary, 0.35);
      ctx.fillRect(x0, cy - h * 0.12, span * 0.3, ppu * 0.05);
      ctx.fillRect(x0, cy + h * 0.06, span * 0.2, ppu * 0.05);
      break;
    }
    case "gauge": {
      const r = h * 0.28;
      const gx = x0 + span * 0.45;
      ctx.strokeStyle = rgba(pal.primary, 0.25);
      ctx.lineWidth = ppu * 0.07;
      ctx.beginPath();
      ctx.arc(gx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = pal.primary;
      ctx.shadowColor = pal.primary;
      ctx.beginPath();
      ctx.arc(gx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (0.55 + 0.2 * Math.sin(t * 0.05)) * k);
      ctx.stroke();
      break;
    }
    case "dots": {
      for (let i = 0; i < 3; i++) {
        const dx = x0 + span * (0.25 + i * 0.25);
        ctx.strokeStyle = rgba(i === 1 ? pal.secondary : pal.primary, 0.85);
        ctx.shadowColor = i === 1 ? pal.secondary : pal.primary;
        ctx.lineWidth = ppu * 0.05;
        ctx.beginPath();
        ctx.arc(dx, cy, h * 0.17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k * (0.5 + 0.17 * (i + 1)));
        ctx.stroke();
      }
      break;
    }
    case "lines":
    case "list": {
      const rows = kind === "lines" ? 4 : 3;
      for (let i = 0; i < rows; i++) {
        const y = cy - h * 0.24 + (i * h * 0.48) / (rows - 1);
        const len = span * (0.45 + 0.5 * hash2(i, kind === "lines" ? 5 : 9)) * k;
        ctx.fillStyle = rgba(i === 0 ? pal.secondary : pal.primary, i === 0 ? 0.85 : 0.45);
        ctx.shadowColor = i === 0 ? pal.secondary : pal.primary;
        ctx.beginPath();
        ctx.roundRect(x0, y - ppu * 0.035, len, ppu * 0.07, ppu * 0.035);
        ctx.fill();
        if (kind === "list") {
          ctx.beginPath();
          ctx.arc(x1 - h * 0.08, y, ppu * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }
  ctx.restore();
};

/** Section label (e.g. "AI AGENT") with a faint caption, typed on. */
export const drawLabel = (
  ctx: Ctx,
  pal: Palette,
  ppu: number,
  text: string,
  caption: string,
  chars: number,
  captionAlpha: number,
) => {
  ctx.save();
  const size = ppu * 0.62;
  ctx.font = `700 ${Math.round(size)}px ${FONT_LABEL}`;
  ctx.letterSpacing = `${Math.round(size * 0.22)}px`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = pal.text;
  ctx.shadowColor = pal.text;
  ctx.shadowBlur = ppu * 0.2;
  ctx.fillText(text.slice(0, chars), ppu * 0.2, size * 1.1);
  if (captionAlpha > 0) {
    ctx.globalAlpha = captionAlpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = pal.textDim;
    const cs = ppu * 0.26;
    ctx.font = `600 ${Math.round(cs)}px ${FONT_LABEL}`;
    ctx.letterSpacing = `${Math.round(cs * 0.12)}px`;
    ctx.fillText(caption, ppu * 0.2, size * 1.1 + cs * 1.8);
  }
  ctx.restore();
};

/** A ticking 4-digit counter with a row of tiny digits beneath. */
export const drawCounter = (ctx: Ctx, pal: Palette, ppu: number, seed: number, frame: number, alpha: number) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  const step = Math.floor(frame / 4);
  const big = Math.floor(hash2(seed, step) * 10000)
    .toString()
    .padStart(4, "0");
  ctx.fillStyle = rgba(pal.text, 0.9);
  ctx.shadowColor = pal.text;
  ctx.shadowBlur = ppu * 0.1;
  ctx.font = `${Math.round(ppu * 0.42)}px ${FONT_MONO}`;
  ctx.letterSpacing = `${Math.round(ppu * 0.04)}px`;
  ctx.fillText(big, ppu * 0.1, ppu * 0.5);
  ctx.shadowBlur = 0;
  ctx.fillStyle = rgba(pal.text, 0.45);
  ctx.font = `${Math.round(ppu * 0.2)}px ${FONT_MONO}`;
  let row = "";
  for (let i = 0; i < 16; i++) row += Math.floor(hash2(seed * 31 + i, Math.floor(frame / 3)) * 10);
  ctx.fillText(row, ppu * 0.1, ppu * 0.85);
  ctx.fillText(row.split("").reverse().join("").slice(0, 10), ppu * 0.1, ppu * 1.12);
  ctx.restore();
};
