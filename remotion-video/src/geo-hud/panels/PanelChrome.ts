import type { PanelSpec, Rect } from "../layout";
import {
  alpha,
  both,
  clippedRectPath,
  cornerTick,
  sans,
  tracked,
  type Ctx2D,
  type DrawArgs,
} from "../paint";
import { cycle, rInt, rPick } from "../rand";

/**
 * The chrome every panel shares: a thin border with clipped corners, a small
 * label strip along the top edge, and tiny corner ticks.
 *
 * The chrome is static, so it is drawn once into an offscreen layer and
 * blitted. Only `drawPanelFlash` runs per frame.
 */

export const CUT = 16;
const STRIP_H = 30;
const PAD_X = 18;

/** The area inside the chrome that panel content may use. */
export const panelBody = (spec: Rect): Rect => ({
  x: spec.x + PAD_X,
  y: spec.y + STRIP_H + 12,
  w: spec.w - PAD_X * 2,
  h: spec.h - STRIP_H - 12 - 16,
});

export const panelPath = (c: Ctx2D, spec: Rect) =>
  clippedRectPath(c, spec.x + 1, spec.y + 1, spec.w - 2, spec.h - 2, CUT);

export const drawPanelChrome = (a: DrawArgs, spec: PanelSpec) => {
  const { p, v, fonts } = a;
  const c = p.ctx;
  const pal = v.palette;

  panelPath(c, spec);
  c.fillStyle = pal.panelFill;
  c.fill();
  c.strokeStyle = alpha(pal.panelBorder, 0.85);
  c.lineWidth = 2;
  c.stroke();

  // Label strip along the top edge.
  const size = 20;
  c.font = sans(fonts, size, 600);
  const labelW = Math.min(
    spec.w - CUT - 8,
    c.measureText(spec.label).width + 2 * spec.label.length * 0.9 + 46,
  );
  c.fillStyle = alpha(pal.panelBorder, 0.16);
  c.beginPath();
  c.moveTo(spec.x + CUT + 1, spec.y + 1);
  c.lineTo(spec.x + labelW, spec.y + 1);
  c.lineTo(spec.x + labelW - 10, spec.y + STRIP_H);
  c.lineTo(spec.x + CUT - 9, spec.y + STRIP_H);
  c.closePath();
  c.fill();

  c.fillStyle = alpha(pal.accent, 0.9);
  c.fillRect(spec.x + CUT + 4, spec.y + 7, 5, STRIP_H - 14);

  c.fillStyle = alpha(pal.textPale, 0.72);
  c.textAlign = "left";
  c.textBaseline = "middle";
  tracked(c, spec.label, spec.x + CUT + 18, spec.y + STRIP_H / 2 + 1, 2);

  // Underline separating the strip from the body.
  c.strokeStyle = alpha(pal.panelBorder, 0.4);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(spec.x + 1, spec.y + STRIP_H + 1);
  c.lineTo(spec.x + spec.w - 1, spec.y + STRIP_H + 1);
  c.stroke();

  // Tiny corner ticks.
  const inset = 9;
  const len = 20;
  c.strokeStyle = alpha(pal.panelBorder, 1);
  c.lineWidth = 3;
  cornerTick(c, spec.x + inset + CUT * 0.5, spec.y + inset, len, 1, 1);
  cornerTick(c, spec.x + spec.w - inset, spec.y + inset, len, -1, 1);
  cornerTick(c, spec.x + inset, spec.y + spec.h - inset, len, 1, -1);
  cornerTick(c, spec.x + spec.w - inset - CUT * 0.5, spec.y + spec.h - inset, len, -1, -1);

  // A short index code in the top-right of the strip.
  const code = `${rPick(`${spec.id}/pfx`, ["A", "B", "C", "D", "E", "F"])}${rInt(
    `${spec.id}/num`,
    10,
    100,
  )}`;
  c.fillStyle = alpha(pal.textDim, 0.9);
  c.textAlign = "right";
  c.font = sans(fonts, 18, 500);
  c.fillText(code, spec.x + spec.w - 14, spec.y + STRIP_H / 2 + 1);
  c.textAlign = "left";
};

/**
 * Panel borders occasionally flash brighter for 3-4 frames. Each panel gets its
 * own period (a divisor of 900) and phase, so flashes never line up.
 */
export const drawPanelFlash = (a: DrawArgs, spec: PanelSpec) => {
  const { p, v, frame } = a;
  const period = rPick(`${spec.id}/flashp`, [150, 180, 225, 300, 450]);
  const phase = rInt(`${spec.id}/flashph`, 0, period);
  const cy = cycle(frame, period, phase);
  const dur = 3 + rInt(`${spec.id}/flashd:${cy.epoch}`, 0, 2);
  if (cy.local >= dur) return;

  const strength = 1 - cy.local / dur;
  both(p, (c) => {
    panelPath(c, spec);
    c.strokeStyle = alpha(v.palette.accent, 0.9 * strength);
    c.lineWidth = 3;
    c.stroke();
  }, 0.6);
};
