import React from "react";
import { useCurrentFrame } from "remotion";
import { LAYOUT } from "../layout";
import { spin, steppedSpring } from "../lib/anim";
import {
  arc,
  line,
  plate,
  polygonPath,
  ring,
  text,
  type Ctx,
} from "../lib/draw";
import { alpha } from "../lib/color";
import type { CentreForm, Palette, Variant } from "../variants";
import { Layer } from "./Layer";

/* The broken arc ring is shared by BOTH centre forms, so the
   counter-rotation mechanic carries over from v1 to v2 unchanged. */

/** 5 arc segments with deliberately unequal spans and gaps. */
const ARC_SEGMENTS: { at: number; span: number }[] = [
  { at: 0.0, span: 0.15 },
  { at: 0.19, span: 0.09 },
  { at: 0.33, span: 0.2 },
  { at: 0.58, span: 0.11 },
  { at: 0.73, span: 0.17 },
];

const TAU = Math.PI * 2;

export const drawBrokenArcRing = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  thickness: number,
  p: Palette,
): void => {
  ARC_SEGMENTS.forEach((s, i) => {
    const from = rotation + s.at * TAU;
    const to = from + s.span * TAU;
    arc(ctx, cx, cy, r, from, to, i % 2 === 0 ? p.accent : p.element, thickness, 0.92);
    // a hairline lead-out on each segment's tail
    arc(
      ctx,
      cx,
      cy,
      r + thickness * 0.85,
      to - 0.03,
      to + 0.05,
      p.pale,
      3,
      0.8,
    );
  });
};

/** Evenly spaced dashes forming a complete circle. */
const drawDashedRing = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  count: number,
  p: Palette,
): void => {
  const gap = TAU / count;
  const span = gap * 0.52;
  for (let i = 0; i < count; i++) {
    const from = rotation + i * gap;
    arc(ctx, cx, cy, r, from, from + span, p.pale, 8, i % 6 === 0 ? 0.95 : 0.55);
  }
};

/* ------------------------------------------------- v1: "concentricDial" */

const drawConcentricDial = (
  ctx: Ctx,
  cx: number,
  cy: number,
  R: number,
  frame: number,
  v: Variant,
): void => {
  const p = v.palette;

  // outer dashed ring — slow counter-rotation
  drawDashedRing(ctx, cx, cy, R, -spin(frame, 1 / 3), 72, p);

  // two thin solid rings, close together
  ring(ctx, cx, cy, R * 0.885, alpha(p.element, 0.85), 3);
  ring(ctx, cx, cy, R * 0.855, alpha(p.element, 0.5), 2);

  // faint reference ring the arcs ride on
  ring(ctx, cx, cy, R * 0.7, alpha(p.panelBorder, 0.55), 2);

  // broken arc ring — the fast, opposite rotation
  drawBrokenArcRing(ctx, cx, cy, R * 0.7, spin(frame, 2), R * 0.035, p);

  // inner tick collar
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const rr = R * 0.6;
    const len = i % 5 === 0 ? 22 : 11;
    line(
      ctx,
      cx + Math.cos(a) * rr,
      cy + Math.sin(a) * rr,
      cx + Math.cos(a) * (rr - len),
      cy + Math.sin(a) * (rr - len),
      p.textPale,
      i % 5 === 0 ? 3 : 2,
      i % 5 === 0 ? 0.8 : 0.4,
    );
  }

  // The centre stays EMPTY on purpose — a filled centre would read as a
  // gauge rather than as a frame.

  // top / bottom readouts: connector line out of the ring to a filled plate
  const topVal = steppedSpring(frame, "centre-top", 78, 10, 99).toFixed(1);
  const botVal = steppedSpring(frame, "centre-bot", 130, 100, 999, 31).toFixed(0);
  const connTop = 78;
  const connBottom = 46;

  line(ctx, cx, cy - R, cx, cy - R - connTop, p.pale, 3, 0.9);
  plate(ctx, cx, cy - R - connTop - 30, `${v.centreLabels.top}  ${topVal}`, 34, p);

  line(ctx, cx, cy + R, cx, cy + R + connBottom, p.pale, 3, 0.9);
  plate(ctx, cx, cy + R + connBottom + 28, `${v.centreLabels.bottom}  ${botVal}`, 34, p);
};

/* --------------------------------------------------------- v2: "hexCore" */

const HEX_PLATES = ["AX", "BR", "CT", "DL", "EM", "FQ"];

const drawHexCore = (
  ctx: Ctx,
  cx: number,
  cy: number,
  outerR: number,
  frame: number,
  v: Variant,
): void => {
  const p = v.palette;
  // vertex-to-vertex height stays ~46% of the frame; the flats sit inside it
  const R = outerR * 0.98;

  // Three rotation rates: outer hex, inner hex (opposite), arc ring (against
  // both). Each completes a whole number of its own symmetry periods.
  // vertex-up, so the hexagon is tall rather than wide and clears the gauges
  const base = -Math.PI / 2;
  const outerRot = base + spin(frame, 1 / 6); // 60deg = one hexagonal period
  const innerRot = base - spin(frame, 1 / 6) + Math.PI / 6; // opposite, 30deg offset

  // outer hexagon
  ctx.save();
  ctx.strokeStyle = alpha(p.pale, 0.9);
  ctx.lineWidth = 4;
  polygonPath(ctx, cx, cy, R, 6, outerRot);
  ctx.stroke();
  ctx.restore();

  // second, smaller hexagon rotated 30deg -> twelve-pointed star outline
  ctx.save();
  ctx.strokeStyle = alpha(p.accent, 0.85);
  ctx.lineWidth = 4;
  polygonPath(ctx, cx, cy, R * 0.94, 6, innerRot);
  ctx.stroke();
  ctx.restore();

  // thin inner hex pair for depth
  ctx.save();
  ctx.strokeStyle = alpha(p.element, 0.55);
  ctx.lineWidth = 2;
  polygonPath(ctx, cx, cy, R * 0.8, 6, outerRot);
  ctx.stroke();
  ctx.restore();

  ring(ctx, cx, cy, R * 0.78, alpha(p.panelBorder, 0.5), 2);

  // the same broken arc ring as v1
  drawBrokenArcRing(ctx, cx, cy, R * 0.7, spin(frame, 2), R * 0.035, p);

  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    const rr = R * 0.58;
    const len = i % 4 === 0 ? 20 : 10;
    line(
      ctx,
      cx + Math.cos(a) * rr,
      cy + Math.sin(a) * rr,
      cx + Math.cos(a) * (rr - len),
      cy + Math.sin(a) * (rr - len),
      p.textPale,
      i % 4 === 0 ? 3 : 2,
      i % 4 === 0 ? 0.8 : 0.4,
    );
  }

  // OCCUPIED centre: a small filled hexagon carrying a live value
  const coreR = R * 0.2;
  ctx.save();
  ctx.fillStyle = alpha(p.element, 0.28);
  polygonPath(ctx, cx, cy, coreR, 6, -outerRot);
  ctx.fill();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  const core = steppedSpring(frame, "hex-core", 65, 60, 99).toFixed(1);
  text(ctx, core, cx, cy, {
    size: 62,
    color: p.textBright,
    weight: 700,
    align: "center",
    tabular: true,
  });
  text(ctx, v.centreLabels.core, cx, cy + 52, {
    size: 24,
    color: alpha(p.textPale, 0.9),
    weight: 500,
    align: "center",
    tabular: true,
    tracking: 3,
  });

  // six connectors from the outer hexagon's vertices to small label plates
  for (let i = 0; i < 6; i++) {
    const a = outerRot + (i / 6) * TAU;
    const vx = cx + Math.cos(a) * R;
    const vy = cy + Math.sin(a) * R;
    const ex = cx + Math.cos(a) * (R + 34);
    const ey = cy + Math.sin(a) * (R + 34);
    line(ctx, vx, vy, ex, ey, p.pale, 3, 0.85);
    const val = steppedSpring(frame, `hex-plate-${i}`, 78, 0, 99, i * 13).toFixed(0);
    plate(
      ctx,
      cx + Math.cos(a) * (R + 58),
      cy + Math.sin(a) * (R + 58),
      `${HEX_PLATES[i]} ${val.padStart(2, "0")}`,
      26,
      p,
    );
  }
};

const FORMS: Record<
  CentreForm,
  (ctx: Ctx, cx: number, cy: number, R: number, frame: number, v: Variant) => void
> = {
  concentricDial: drawConcentricDial,
  hexCore: drawHexCore,
};

/**
 * The hero form. WHICH form gets drawn comes from `variant.centreForm` —
 * nothing about the dial is hardcoded here.
 */
export const CentreDial: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { cx, cy, r } = LAYOUT.centre;
  const pad = 200;
  const box = (r + pad) * 2;
  const draw = FORMS[variant.centreForm];

  return (
    <Layer
      x={cx - box / 2}
      y={cy - box / 2}
      w={box}
      h={box}
      bloom={{ radius: 26, alpha: 0.55 }}
      draw={(ctx) => {
        draw(ctx, box / 2, box / 2, r, frame, variant);
      }}
    />
  );
};
