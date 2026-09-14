// Panel rasterisation.
//
// Each panel is drawn ONCE into its own offscreen canvas at roughly the
// size it occupies on screen, and from then on every frame just blits that
// bitmap with a scale, an alpha and a depth-of-field blur. That is what
// keeps the render fast (no text layout per frame) and, more importantly,
// temporally stable: re-laying out 12px text at sub-pixel offsets every
// frame makes the whole wall shimmer.

import type { Panel } from "./field";
import { mulberry32 } from "./random";
import type { Theme } from "./themes";

export const FONT_STACK = '"Share Tech Mono", "Courier New", monospace';

const hexToRgb = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
};

/** Linear blend between two #rrggbb colours, returned as an rgba() string. */
export const mixColor = (a: string, b: string, t: number, alpha = 1) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
};

/** Rounded rectangle path with the top-left corner chamfered, HUD style. */
const hudPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  chamfer: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + chamfer, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + chamfer);
  ctx.closePath();
};

const createCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
};

export type PanelBitmap = {
  canvas: HTMLCanvasElement;
  /** Pixels per world unit this bitmap was rasterised at. */
  ppu: number;
  /** Bleed, in world units, added around the panel for glow spill. */
  bleed: number;
};

/**
 * Rasterise one panel. `ppu` is chosen by the caller so the bitmap lands at
 * about its on-screen size; a small bleed margin stops glow from being
 * clipped at the panel edge.
 */
export const renderPanelBitmap = (
  panel: Panel,
  theme: Theme,
  ppu: number,
): PanelBitmap => {
  const bleed = panel.fontSize * 1.5;
  const canvas = createCanvas(
    (panel.width + bleed * 2) * ppu,
    (panel.height + bleed * 2) * ppu,
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, ppu, bleed };

  ctx.scale(ppu, ppu);
  ctx.translate(bleed, bleed);
  ctx.textBaseline = "alphabetic";

  const rng = mulberry32(panel.id * 2654435761 + 13);
  const { width: w, height: h, fontSize, lineHeight, padding } = panel;
  const b = panel.brightness;

  // --- Slab -------------------------------------------------------------
  // A faint translucent pane so overlapping panels read as stacked glass.
  const radius = Math.min(fontSize * 2.4, w * 0.12, h * 0.12);
  const chamfer = radius * 1.6;
  hudPath(ctx, 0, 0, w, h, radius, panel.framed ? chamfer : radius);
  ctx.fillStyle = theme.panelFill;
  ctx.globalAlpha = panel.framed ? 0.8 : 0.38;
  ctx.fill();
  ctx.globalAlpha = 1;

  // --- Frame ------------------------------------------------------------
  if (panel.framed) {
    ctx.lineWidth = Math.max(0.6, fontSize * 0.09);
    ctx.strokeStyle = theme.frameStroke;
    ctx.globalAlpha = 0.5 + b * 0.5;
    ctx.stroke();

    // Inner rule under the header, and a short tick on the left edge.
    ctx.beginPath();
    const headerY = padding + lineHeight * 1.55;
    ctx.moveTo(padding * 0.6, headerY);
    ctx.lineTo(w - padding * 0.6, headerY);
    ctx.strokeStyle = theme.frameStrokeSoft;
    ctx.lineWidth = Math.max(0.5, fontSize * 0.06);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, h * 0.42);
    ctx.lineTo(0, h * 0.66);
    ctx.strokeStyle = theme.frameStroke;
    ctx.lineWidth = Math.max(0.8, fontSize * 0.18);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- Header -----------------------------------------------------------
  let cursorY = padding + fontSize;
  if (panel.label) {
    ctx.font = `${(fontSize * 1.35).toFixed(2)}px ${FONT_STACK}`;
    ctx.fillStyle = theme.label;
    ctx.globalAlpha = 0.65 + b * 0.35;
    ctx.shadowColor = theme.label;
    ctx.shadowBlur = fontSize * 0.9;
    ctx.fillText(panel.label, padding, cursorY + fontSize * 0.25);
    ctx.shadowBlur = 0;
    cursorY += lineHeight * 1.6;
  }
  if (panel.meta) {
    ctx.font = `${fontSize.toFixed(2)}px ${FONT_STACK}`;
    ctx.fillStyle = theme.labelAlt;
    ctx.globalAlpha = 0.5 + b * 0.35;
    ctx.fillText(panel.meta, padding, cursorY);
    cursorY += lineHeight * 1.3;
  }
  ctx.globalAlpha = 1;

  // --- Body -------------------------------------------------------------
  const decoByLine = new Map(panel.decos.map((d) => [d.line, d]));
  const textWidth = w - padding * 2;
  ctx.font = `${fontSize.toFixed(2)}px ${FONT_STACK}`;

  panel.lines.forEach((line, i) => {
    const y = cursorY + i * lineHeight;
    if (y > h - padding * 0.4) return;

    const deco = decoByLine.get(i);
    if (deco) {
      const barW = textWidth * deco.widthFrac;
      const barY = y - fontSize * 0.86;
      const barH = lineHeight * 0.96;
      if (deco.kind === "hot") {
        ctx.fillStyle = theme.accentSoft;
        ctx.globalAlpha = 0.55 + b * 0.45;
        ctx.shadowColor = theme.accent;
        ctx.shadowBlur = fontSize * 1.6;
        ctx.fillRect(padding, barY, barW, barH);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = theme.barCool;
        ctx.globalAlpha = 0.5 + b * 0.4;
        ctx.shadowColor = theme.barCoolGlow;
        ctx.shadowBlur = fontSize * 1.8;
        ctx.fillRect(padding, barY, barW, barH);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }

    // Dim / mid / bright mix, biased by the panel's depth brightness so the
    // far wall stays hazy and the focus plane carries the contrast.
    const roll = rng();
    const tone = roll < 0.55 ? 0 : roll < 0.88 ? 0.5 : 1;
    const color =
      tone === 0
        ? theme.codeDim
        : tone === 0.5
          ? theme.codeMid
          : theme.codeBright;

    if (deco?.kind === "hot") {
      ctx.fillStyle = theme.accentText;
      ctx.globalAlpha = 0.85 + b * 0.15;
    } else if (deco?.kind === "cool") {
      // Text is swallowed by the solid highlight bar.
      ctx.globalAlpha = 0;
    } else {
      ctx.fillStyle = mixColor(theme.codeDim, color, 1, 1);
      ctx.globalAlpha = (0.55 + b * 0.45) * (tone === 1 ? 1 : 0.85);
    }

    if (tone === 1 && !deco) {
      ctx.shadowColor = theme.codeBright;
      ctx.shadowBlur = fontSize * 0.7;
    }
    ctx.fillText(line, padding, y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });

  // --- Indicator bars ---------------------------------------------------
  panel.bars.forEach((bar) => {
    const color =
      bar.kind === "hot"
        ? theme.accent
        : bar.kind === "cool"
          ? theme.barCool
          : theme.frameStrokeSoft;
    ctx.fillStyle = color;
    ctx.globalAlpha = (bar.kind === "faint" ? 0.35 : 0.7) * (0.5 + b * 0.5);
    if (bar.kind !== "faint") {
      ctx.shadowColor = color;
      ctx.shadowBlur = bar.h * 2.2;
    }
    ctx.fillRect(bar.x, bar.y, Math.min(bar.w, w - bar.x - padding * 0.4), bar.h);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });

  return { canvas, ppu, bleed };
};
