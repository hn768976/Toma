/**
 * <BinaryColumn> — v3's distinct element: vertical columns of 1s and 0s
 * standing between the block clusters, on the same perspective.
 *
 * Digits are stacked upward from the floor plane, the column's leading digits
 * are brightest and fade toward the top, and the stack scrolls and rerolls as
 * it goes. Column spacing is irregular; even spacing reads as a printed grid.
 *
 * The digit values come from a sequence indexed modulo (cycles * digits), and
 * the scroll advances by exactly that many cells per loop, so the whole column
 * — position and content — lands back where it started on frame 375.
 */
import React, { useMemo } from "react";
import { rgba } from "../lib/color";
import { randInt, randRange, rand } from "../lib/seededRandom";
import {
  CorridorElement,
  ElementRenderer,
  useCorridorGroup,
} from "./PerspectiveCorridor";

export interface ColumnElement extends CorridorElement {
  /** Digits in the stack. */
  digits: number;
  /** Cell height as a fraction of frame height at d = 1. */
  cellUnit: number;
  /** Whole cell-stacks scrolled per loop. */
  scrollCycles: number;
  alpha: number;
}

export const renderBinaryColumn: ElementRenderer<ColumnElement> = (
  ctx,
  el,
  p,
  api,
) => {
  const { geo, palette } = api;
  const cell = el.cellUnit * geo.height * p.d;
  if (cell < 2.2) return;
  if (p.x < -geo.width * 0.08 || p.x > geo.width * 1.08) return;

  const period = el.scrollCycles * el.digits;
  const offset = el.scrollCycles * el.digits * (api.frame / api.loop);
  const base = Math.floor(offset);
  const shift = offset - base;

  ctx.font = `700 ${(cell * 0.86).toFixed(1)}px ui-monospace, "DejaVu Sans Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < el.digits; i++) {
    const y = p.y - (i + shift) * cell;
    if (y < -cell || y > geo.height + cell) continue;
    const lead = 1 - i / el.digits;
    const a = p.fade * api.band(y) * el.alpha * (0.16 + 0.84 * lead * lead);
    if (a < 0.012) continue;
    const idx = (((base + i) % period) + period) % period;
    const bit = rand(`${el.seed}-bit-${idx}`) < 0.5 ? "0" : "1";
    ctx.fillStyle = rgba(i < 2 ? palette.digitBright : palette.digitPale, a);
    ctx.fillText(bit, p.x, y);
  }
};

export const makeBinaryColumns = (
  count: number,
  seed: string,
): ColumnElement[] => {
  const out: ColumnElement[] = [];
  for (let i = 0; i < count; i++) {
    const s = `${seed}-col-${i}`;
    // Irregular lateral placement, biased away from dead centre.
    const mag = Math.pow(randRange(`${s}-lm`, 0.02, 1), 0.85);
    out.push({
      seed: s,
      lane: mag * (rand(`${s}-sd`) < 0.5 ? -1 : 1),
      plane: "floor",
      d0: randRange(`${s}-d0`, 0, 1),
      cycles: randInt(`${s}-cy`, 1, 2),
      digits: randInt(`${s}-dg`, 8, 20),
      cellUnit: randRange(`${s}-cu`, 0.02, 0.045),
      scrollCycles: randInt(`${s}-sc`, 1, 3),
      alpha: randRange(`${s}-a`, 0.4, 1),
    });
  }
  return out;
};

export interface BinaryColumnProps {
  order: number;
  count: number;
  seed: string;
}

export const BinaryColumn: React.FC<BinaryColumnProps> = ({ order, count, seed }) => {
  const elements = useMemo(() => makeBinaryColumns(count, seed), [count, seed]);
  useCorridorGroup<ColumnElement>({
    id: "binary-columns",
    order,
    elements,
    render: renderBinaryColumn,
    blend: "lighter",
    fadeIn: 0.16,
  });
  return null;
};
