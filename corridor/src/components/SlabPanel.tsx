/**
 * <SlabPanel> — v2's element: a flat rectangular panel lying on its plane.
 *
 * Panels lie parallel to the floor or the ceiling; they never stand upright.
 * Each occupies a lane span and a depth span, so it projects as a trapezoid
 * whose far edge is narrower — that is what sells "lying flat" rather than
 * "a rectangle pasted on the screen".
 *
 * Panels vary widely in size and aspect, carry a brighter edge on only one or
 * two sides as though catching light from one direction, and a minority carry
 * small illegible text fragments or short bar rows. They overlap heavily and
 * additively: a grid of separated panels reads as a layout, and the overlap is
 * what turns them into a mass.
 *
 * All text content is fictional gibberish assembled from seeded tokens.
 */
import React, { useMemo } from "react";
import { mixRgba, rgba } from "../lib/color";
import { TAU, clamp } from "../lib/math";
import { Plane } from "../lib/perspective";
import { randChance, randInt, randPick, randRange } from "../lib/seededRandom";
import {
  CorridorElement,
  ElementRenderer,
  useCorridorGroup,
} from "./PerspectiveCorridor";

type SlabContent = "none" | "text" | "bars";

export interface SlabElement extends CorridorElement {
  /** Half-extent across the corridor, in lane units. */
  laneW: number;
  /** Extent along the corridor, in depth units. */
  depthW: number;
  /** Which of [far, right, near, left] carry the bright edge. */
  edges: boolean[];
  bright: boolean;
  content: SlabContent;
  text: string[];
  barRows: number;
  tone: number;
  alpha: number;
  /** Phase of a slow brightness shimmer. */
  phase: number;
}

const TOKENS = [
  "0x", "SYS", "NODE", "TR", "LNK", "CH", "IDX", "SEQ", "VX", "QR",
  "AB", "F7", "D2", "9C", "4E", "K1", "ZP", "MU", "RX", "TT",
];
const HEX = "0123456789ABCDEF";

/** Entirely fictional strings: seeded tokens, digits and hex-ish groups. */
const makeFragment = (seed: string): string => {
  const shape = randInt(`${seed}-sh`, 0, 2);
  const tok = randPick(`${seed}-tk`, TOKENS);
  let digits = "";
  const n = randInt(`${seed}-dn`, 3, 6);
  for (let i = 0; i < n; i++) {
    digits += HEX[randInt(`${seed}-d${i}`, 0, 15)];
  }
  if (shape === 0) return `${tok}-${digits}`;
  if (shape === 1) return `${tok}${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits}.${tok}`;
};

export const renderSlabPanel: ElementRenderer<SlabElement> = (ctx, el, p, api) => {
  const { geo, palette } = api;
  const k = geo.width / 3840;

  const dNear = Math.min(1.4, p.d + el.depthW * 0.5);
  const dFar = Math.max(0.006, p.d - el.depthW * 0.5);
  const l = el.lane - el.laneW;
  const r = el.lane + el.laneW;

  const fl = api.point(l, dFar, el.plane);
  const fr = api.point(r, dFar, el.plane);
  const nr = api.point(r, dNear, el.plane);
  const nl = api.point(l, dNear, el.plane);

  const minX = Math.min(fl.x, fr.x, nr.x, nl.x);
  const maxX = Math.max(fl.x, fr.x, nr.x, nl.x);
  const minY = Math.min(fl.y, fr.y, nr.y, nl.y);
  const maxY = Math.max(fl.y, fr.y, nr.y, nl.y);
  if (maxX < -geo.width * 0.12 || minX > geo.width * 1.12) return;
  if (maxY < -geo.height * 0.12 || minY > geo.height * 1.12) return;

  const cx = (fl.x + fr.x + nr.x + nl.x) * 0.25;
  const cy = (fl.y + fr.y + nr.y + nl.y) * 0.25;
  // Mask on the point of the panel CLOSEST to the band, not its centre: a big
  // panel centred outside the band would otherwise still reach into it.
  const bandY = Math.min(Math.max(geo.bandCenterY, minY), maxY);
  const shimmer = 0.85 + 0.15 * Math.sin((api.frame / api.loop + el.phase) * TAU * 3);
  const a = p.fade * api.band(bandY) * el.alpha * shimmer;
  if (a < 0.008) return;

  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.lineTo(nl.x, nl.y);
  ctx.closePath();
  ctx.fillStyle = el.bright
    ? mixRgba(palette.slabFill, palette.slabBright, el.tone * 0.5, a * 0.5)
    : mixRgba(palette.slabFill, palette.slabEdge, el.tone * 0.35, a * 0.85);
  ctx.fill();

  // A brighter edge on one or two sides only: light from one direction.
  const corners = [fl, fr, nr, nl];
  const edgeColour = el.bright ? palette.slabBright : palette.slabEdge;
  ctx.lineCap = "butt";
  for (let i = 0; i < 4; i++) {
    if (!el.edges[i]) continue;
    const s = corners[i];
    const e = corners[(i + 1) % 4];
    ctx.lineWidth = Math.max(0.9, 3.4 * k * p.d + 0.7);
    ctx.strokeStyle = rgba(edgeColour, Math.min(1, a * (el.bright ? 1.5 : 1)));
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
  }

  if (el.content === "none") return;

  const panelW = Math.abs(nr.x - nl.x);
  const panelH = Math.abs((nl.y + nr.y) * 0.5 - (fl.y + fr.y) * 0.5);
  if (panelH < 10 * k || panelW < 40 * k) return;

  if (el.content === "bars") {
    const rows = el.barRows;
    const gap = panelH / (rows + 1);
    ctx.fillStyle = rgba(palette.textPale, a * 0.75);
    for (let i = 0; i < rows; i++) {
      const y = cy - panelH * 0.5 + gap * (i + 1);
      const w = panelW * (0.24 + 0.5 * ((i * 7 + 3) % 5) / 5);
      ctx.fillRect(cx - panelW * 0.4, y, w, Math.max(0.8, gap * 0.28));
      if (i === 0) {
        ctx.fillStyle = rgba(palette.textBright, a * 0.85);
        ctx.fillRect(cx - panelW * 0.4, y, w * 0.3, Math.max(0.8, gap * 0.28));
        ctx.fillStyle = rgba(palette.textPale, a * 0.75);
      }
    }
    return;
  }

  // Small and illegible by design: capped hard so a near panel never turns
  // into readable signage.
  const size = clamp(
    Math.min(panelH * 0.26, panelW * 0.085, 46 * k),
    6 * k,
    46 * k,
  );
  ctx.font = `600 ${size.toFixed(1)}px ui-monospace, "DejaVu Sans Mono", monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const lineH = size * 1.45;
  const top = cy - ((el.text.length - 1) * lineH) / 2;
  for (let i = 0; i < el.text.length; i++) {
    ctx.fillStyle = rgba(
      i === 0 ? palette.textBright : palette.textPale,
      a * (i === 0 ? 0.8 : 0.58),
    );
    ctx.fillText(el.text[i], cx - panelW * 0.42, top + i * lineH);
  }
};

export const makeSlabElements = (count: number, seed: string): SlabElement[] => {
  const out: SlabElement[] = [];
  for (let i = 0; i < count; i++) {
    const s = `${seed}-slab-${i}`;
    const plane: Plane = randChance(`${s}-pl`, 0.5) ? "floor" : "ceiling";
    // Aspect is drawn independently across a wide range: some panels come out
    // long and narrow, some nearly square.
    const laneW = randRange(`${s}-lw`, 0.012, 0.32) * randRange(`${s}-lw2`, 0.35, 1.4);
    const depthW = randRange(`${s}-dw`, 0.008, 0.14) * randRange(`${s}-dw2`, 0.35, 1.3);
    const bright = randChance(`${s}-br`, 0.26);
    const contentRoll = randRange(`${s}-cr`, 0, 1);
    const content: SlabContent =
      contentRoll < 0.14 ? "text" : contentRoll < 0.24 ? "bars" : "none";
    const text: string[] = [];
    if (content === "text") {
      const lines = randInt(`${s}-tl`, 1, 3);
      for (let j = 0; j < lines; j++) text.push(makeFragment(`${s}-t${j}`));
    }
    // One or two adjacent sides catch the light, never all four.
    const first = randInt(`${s}-e0`, 0, 3);
    const edges = [false, false, false, false];
    edges[first] = true;
    if (randChance(`${s}-e1`, 0.45)) edges[(first + 1) % 4] = true;

    out.push({
      seed: s,
      lane: randRange(`${s}-ln`, -1, 1),
      plane,
      d0: randRange(`${s}-d0`, 0, 1),
      cycles: randInt(`${s}-cy`, 1, 2),
      laneW,
      depthW,
      edges,
      bright,
      content,
      text,
      barRows: randInt(`${s}-bn`, 2, 5),
      tone: randRange(`${s}-tn`, 0, 1),
      alpha: randRange(`${s}-al`, 0.24, 0.85),
      phase: randRange(`${s}-ph`, 0, 1),
    });
  }
  return out;
};

export interface SlabPanelProps {
  order: number;
  count: number;
  seed: string;
}

export const SlabPanel: React.FC<SlabPanelProps> = ({ order, count, seed }) => {
  const elements = useMemo(() => makeSlabElements(count, seed), [count, seed]);
  useCorridorGroup<SlabElement>({
    id: "slab-panels",
    order,
    elements,
    render: renderSlabPanel,
    blend: "lighter",
    fadeIn: 0.16,
  });
  return null;
};
