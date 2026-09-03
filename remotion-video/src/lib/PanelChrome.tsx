import { useMemo } from "react";
import { withAlpha } from "./color";
import { rndBool, rndRange } from "./seeded";

/**
 * The shared HUD panel treatment: fill, border, header bar, corner brackets,
 * an edge tick rule and a run of irregular dashes.
 *
 * A panel's chrome is static for its lifetime, so it is rasterised ONCE to
 * its own offscreen canvas and blitted thereafter. On a dense interface there
 * may be forty panels on screen; re-stroking their chrome every frame is the
 * most expensive thing such a composition can do, and the least necessary.
 *
 * Colours are parameters. `seed` drives the irregular dash run, so two
 * panels of the same size still differ.
 *
 * Usage:
 *   const chrome = usePanelChrome({ w, h, fill, fillAlpha, border, seed });
 *   blitChrome(ctx, chrome, x, y);
 *
 * `chrome.pad` is how far the chrome bleeds outside the panel's own w/h —
 * grow any clip or bounding box by it.
 *
 * @module PanelChrome
 */

export type PanelChromeSpec = {
  w: number;
  h: number;
  fill: string;
  fillAlpha: number;
  border: string;
  /** Seed for the irregular dash run, so it differs panel to panel. */
  seed: string;
  header?: boolean;
  /** Tick rule along the bottom edge. */
  ticks?: number;
  /** Corner bracket arm length; 0 disables them. */
  bracket?: number;
};

export type PanelChrome = {
  canvas: HTMLCanvasElement;
  /** How far the chrome bleeds outside the panel's own w/h. */
  pad: number;
  w: number;
  h: number;
};

const PAD = 26;

export const renderPanelChrome = (spec: PanelChromeSpec): PanelChrome => {
  const { w, h, fill, fillAlpha, border, seed } = spec;
  const header = spec.header ?? true;
  const ticks = spec.ticks ?? 0;
  const bracket = spec.bracket ?? 22;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w + PAD * 2);
  canvas.height = Math.ceil(h + PAD * 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, pad: PAD, w, h };
  ctx.translate(PAD, PAD);

  ctx.fillStyle = withAlpha(fill, fillAlpha);
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = withAlpha(border, 0.85);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  if (header) {
    const hh = Math.min(38, h * 0.22);
    ctx.fillStyle = withAlpha(border, 0.16);
    ctx.fillRect(1, 1, w - 2, hh);
    ctx.strokeStyle = withAlpha(border, 0.7);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(1, hh);
    ctx.lineTo(w - 1, hh);
    ctx.stroke();
  }

  if (bracket > 0) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 3.4;
    const arm = bracket;
    const corners: [number, number, number, number][] = [
      [0, 0, 1, 1],
      [w, 0, -1, 1],
      [0, h, 1, -1],
      [w, h, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * arm);
      ctx.stroke();
    }
  }

  if (ticks > 0) {
    ctx.strokeStyle = withAlpha(border, 0.6);
    ctx.lineWidth = 1.8;
    for (let i = 0; i <= ticks; i++) {
      const x = 6 + ((w - 12) * i) / ticks;
      const len = i % 5 === 0 ? 13 : 7;
      ctx.beginPath();
      ctx.moveTo(x, h - 1);
      ctx.lineTo(x, h - 1 - len);
      ctx.stroke();
    }
  }

  // An irregular dash run down the right edge — irregular because a regular
  // one reads as a border, not as an instrument.
  ctx.strokeStyle = withAlpha(border, 0.55);
  ctx.lineWidth = 2.4;
  let y = 12;
  let i = 0;
  while (y < h - 12) {
    const seg = rndRange(`${seed}:dash:${i}`, 8, 30);
    if (rndBool(`${seed}:gap:${i}`, 0.62)) {
      ctx.beginPath();
      ctx.moveTo(w + 8, y);
      ctx.lineTo(w + 8, Math.min(h - 12, y + seg));
      ctx.stroke();
    }
    y += seg + rndRange(`${seed}:sp:${i}`, 5, 18);
    i++;
  }

  return { canvas, pad: PAD, w, h };
};

export const usePanelChrome = (spec: PanelChromeSpec): PanelChrome =>
  useMemo(
    () => renderPanelChrome(spec),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      spec.w,
      spec.h,
      spec.fill,
      spec.fillAlpha,
      spec.border,
      spec.seed,
      spec.header,
      spec.ticks,
      spec.bracket,
    ],
  );

/** Blits chrome so that its panel-local origin lands on (x, y). */
export const blitChrome = (
  ctx: CanvasRenderingContext2D,
  chrome: PanelChrome,
  x: number,
  y: number,
) => {
  ctx.drawImage(chrome.canvas, x - chrome.pad, y - chrome.pad);
};
