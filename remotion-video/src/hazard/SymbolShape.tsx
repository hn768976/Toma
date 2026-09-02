/**
 * The only module in this folder that knows which hazard symbol is being
 * drawn.
 *
 * `getSymbolGeometry` takes a symbol type and returns the shape — as a painter
 * that lays the symbol down on a mask, plus the derived masks every other layer
 * works from. A painter rather than a Path2D because only the trefoil is a
 * single fillable path: the biohazard mark is a union of overlapping annuli
 * with a carved centre, and neither the union (holes must not punch through a
 * neighbour's material) nor the carve can be expressed as one path's winding.
 * Downstream, <EnergyFill>,
 * <OuterRing>, <PerforatedPlate> and <RimGlow> see nothing but anonymous
 * alpha masks and coverage maps, so swapping a trefoil for a biohazard mark
 * changes this file and nothing else.
 *
 * Geometry is built once per symbol type and cached at module scope: the shape
 * never changes over the 600 frames, only where it sits.
 */

import React from "react";
import {
  LAYER_SIZE,
  NOISE_SIZE,
  OUTLINE_WIDTH,
  SYMBOL_RADIUS,
  TAU,
  WISP_REACH,
} from "./constants";
import type { HazardPalette, SymbolType } from "./variants";
import {
  createLayer,
  dilateMask,
  erodeMask,
  hexToRgb,
  maskCoverage,
  resetLayer,
  rgba,
  subtractMask,
} from "../lib/remotion-lib";

export interface SymbolGeometry {
  /** Edge length of the square layer the symbol is composed in. */
  size: number;
  /** Lays the symbol down as solid white, centred in a `size` x `size` box. */
  paint: SymbolPainter;
  /** The result of `paint`: the symbol as a solid alpha mask. */
  mask: HTMLCanvasElement;
  /** `mask` shrunk by the outline width — where the energy fill may go. */
  eroded: HTMLCanvasElement;
  /** The thin band between `mask` and `eroded`: the printed edge. */
  outline: HTMLCanvasElement;
  /** `mask` grown by WISP_REACH, for the rim glow. */
  dilated: HTMLCanvasElement;
  /** Low-resolution coverage of `mask`, 0 outside, 1 inside. */
  coverage: Float32Array;
  /** Low-resolution proximity to the outline, peaking on the edge. */
  edge: Float32Array;
  /** Low-resolution weight for the region just outside the outline. */
  wisp: Float32Array;
  noiseSize: number;
}

/**
 * Draws a symbol as solid white into `ctx`, centred on (cx, cy).
 */
export type SymbolPainter = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
) => void;

/**
 * The standard international trefoil. Its proportions are fixed by the
 * standard, not chosen: a central circle of radius r, and three identical
 * blades each spanning exactly 60 degrees with 60 degree gaps between them,
 * running from 1.5r to 5r. Unlike the rest of this piece the symbol is
 * deliberately regular and symmetric — it is a safety mark, and distorting it
 * would make it wrong rather than interesting.
 */
const trefoilPath = (cx: number, cy: number, radius: number): Path2D => {
  const path = new Path2D();
  const unit = radius / 5;
  const centreRadius = unit;
  const bladeInner = unit * 1.5;
  const bladeOuter = unit * 5;
  const half = TAU / 12; // 30 degrees: half of a 60 degree blade

  path.moveTo(cx + centreRadius, cy);
  path.arc(cx, cy, centreRadius, 0, TAU);

  for (let i = 0; i < 3; i++) {
    // One blade points straight up; the others follow at exactly 120 degrees.
    const centreAngle = -TAU / 4 + (TAU / 3) * i;
    const from = centreAngle - half;
    const to = centreAngle + half;
    path.moveTo(cx + Math.cos(from) * bladeInner, cy + Math.sin(from) * bladeInner);
    path.lineTo(cx + Math.cos(from) * bladeOuter, cy + Math.sin(from) * bladeOuter);
    path.arc(cx, cy, bladeOuter, from, to);
    path.lineTo(cx + Math.cos(to) * bladeInner, cy + Math.sin(to) * bladeInner);
    path.arc(cx, cy, bladeInner, to, from, true);
    path.closePath();
  }
  return path;
};

/**
 * The standard international biohazard mark, in fractions of the symbol's
 * overall radius. Like the trefoil these proportions are standardised rather
 * than chosen, so they are reproduced faithfully instead of stylised.
 *
 * The three rings sit at 120 degrees on a circle of RING_DISTANCE and reach
 * out to exactly 1, so RING_OUTER is what is left. RING_INNER is small enough
 * that each hole stays a clean circle — a neighbour's outer edge stops short
 * of it — while RING_OUTER is large enough that neighbouring rings overlap
 * substantially, which is what makes the mark read as interlocked.
 */
const BIOHAZARD = {
  /** Distance from the common centre to each ring's centre. */
  RING_DISTANCE: 0.485,
  /** Outer radius of each ring; RING_DISTANCE + RING_OUTER == 1. */
  RING_OUTER: 0.515,
  /** Inner radius: the circle removed to make each ring an annulus. */
  RING_INNER: 0.305,
  /** Radius of the central area cleared out of the rings' overlap. */
  CLEAR_RADIUS: 0.175,
  /** The small circle left at the common centre. */
  CORE_RADIUS: 0.075,
  /** Half-width of the arcs bridging the core to each ring's inner edge. */
  BRIDGE_HALF_WIDTH: 0.042,
};

/**
 * The biohazard mark: three thick annuli at 120 degrees, overlapping their
 * neighbours, unioned rather than cut where they cross.
 *
 * The union has to be accumulated one ring at a time. Punching all three holes
 * out of all three outer circles would be wrong: where ring A's hole crosses
 * ring B's material, that material belongs to the shape and must survive.
 *
 * The centre is then cleared and a small circle put back, bridged out toward
 * each ring's inner edge. Those bridges divide the cleared area into the three
 * curved triangular gaps that are the mark's most recognisable feature.
 */
const paintBiohazard: SymbolPainter = (ctx, cx, cy, radius) => {
  const distance = radius * BIOHAZARD.RING_DISTANCE;
  const outer = radius * BIOHAZARD.RING_OUTER;
  const inner = radius * BIOHAZARD.RING_INNER;
  const clear = radius * BIOHAZARD.CLEAR_RADIUS;
  const core = radius * BIOHAZARD.CORE_RADIUS;
  const bridgeWidth = radius * BIOHAZARD.BRIDGE_HALF_WIDTH * 2;

  const ring = createLayer(ctx.canvas.width, ctx.canvas.height);

  for (let i = 0; i < 3; i++) {
    // One ring points straight up, the others follow at 120 degrees.
    const angle = -TAU / 4 + (TAU / 3) * i;
    const rx = cx + Math.cos(angle) * distance;
    const ry = cy + Math.sin(angle) * distance;

    resetLayer(ring.ctx);
    ring.ctx.fillStyle = "#ffffff";
    ring.ctx.beginPath();
    ring.ctx.arc(rx, ry, outer, 0, TAU);
    ring.ctx.fill();
    ring.ctx.globalCompositeOperation = "destination-out";
    ring.ctx.beginPath();
    ring.ctx.arc(rx, ry, inner, 0, TAU);
    ring.ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(ring.canvas, 0, 0);
  }

  // Clear the middle, then put back the core and its bridges.
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, clear, 0, TAU);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, core, 0, TAU);
  ctx.fill();

  ctx.lineWidth = bridgeWidth;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const angle = -TAU / 4 + (TAU / 3) * i;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // Out to where the ring's own inner edge begins, so the bridge lands on
    // material rather than stopping in the cleared area.
    const reach = distance - inner;
    ctx.beginPath();
    ctx.moveTo(cx + dx * core * 0.5, cy + dy * core * 0.5);
    ctx.lineTo(cx + dx * reach, cy + dy * reach);
    ctx.stroke();
  }
};

const paintTrefoil: SymbolPainter = (ctx, cx, cy, radius) => {
  ctx.fillStyle = "#ffffff";
  ctx.fill(trefoilPath(cx, cy, radius));
};

const SYMBOL_PAINTERS: Record<SymbolType, SymbolPainter> = {
  radiation: paintTrefoil,
  biohazard: paintBiohazard,
};

const blurMask = (source: HTMLCanvasElement, radius: number): HTMLCanvasElement => {
  const { canvas, ctx } = createLayer(source.width, source.height);
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(source, 0, 0);
  return canvas;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const buildGeometry = (type: SymbolType): SymbolGeometry => {
  const half = LAYER_SIZE / 2;
  const paint = SYMBOL_PAINTERS[type];

  const { canvas: mask, ctx: maskCtx } = createLayer(LAYER_SIZE, LAYER_SIZE);
  paint(maskCtx, half, half, SYMBOL_RADIUS);

  const eroded = erodeMask(mask, OUTLINE_WIDTH);
  const outline = subtractMask(mask, eroded);
  const dilated = dilateMask(mask, WISP_REACH);

  const coverage = maskCoverage(mask, NOISE_SIZE);
  // A band straddling the outline: 4c(1-c) peaks where a blurred mask sits at
  // half coverage, which is exactly the edge.
  const softCoverage = maskCoverage(blurMask(mask, SYMBOL_RADIUS * 0.075), NOISE_SIZE);
  const wideCoverage = maskCoverage(blurMask(mask, WISP_REACH * 0.42), NOISE_SIZE);

  const edge = new Float32Array(coverage.length);
  const wisp = new Float32Array(coverage.length);
  for (let i = 0; i < coverage.length; i++) {
    const c = softCoverage[i];
    edge[i] = clamp01(4 * c * (1 - c));
    wisp[i] = clamp01(wideCoverage[i] * (1 - coverage[i]));
  }

  return {
    size: LAYER_SIZE,
    paint,
    mask,
    eroded,
    outline,
    dilated,
    coverage,
    edge,
    wisp,
    noiseSize: NOISE_SIZE,
  };
};

const geometryCache = new Map<SymbolType, SymbolGeometry>();

/** Takes a symbol type and returns its path and derived masks. */
export const getSymbolGeometry = (type: SymbolType): SymbolGeometry => {
  const cached = geometryCache.get(type);
  if (cached) return cached;
  const built = buildGeometry(type);
  geometryCache.set(type, built);
  return built;
};

const paintedCache = new Map<string, HTMLCanvasElement>();

/**
 * The symbol as printed: a flat fill in the accent colour with a thin darker
 * outline just inside its edge, so it reads as marked onto the disc rather
 * than floating above it. Static, so it is painted once and blitted.
 */
const getPaintedSymbol = (
  geometry: SymbolGeometry,
  palette: HazardPalette,
): HTMLCanvasElement => {
  const key = `${palette.symbol}-${palette.symbolDark}`;
  const cached = paintedCache.get(key);
  if (cached) return cached;

  const size = geometry.size;

  // The outline band, tinted darker than the shimmer's own troughs so the
  // printed edge stays legible however bright the energy inside runs.
  const [r, g, b] = hexToRgb(palette.symbolDark);
  const edgeColor = rgba(
    [Math.round(r * 0.3), Math.round(g * 0.3), Math.round(b * 0.3)],
    1,
  );
  const band = createLayer(size, size);
  band.ctx.fillStyle = edgeColor;
  band.ctx.fillRect(0, 0, size, size);
  band.ctx.globalCompositeOperation = "destination-in";
  band.ctx.drawImage(geometry.outline, 0, 0);

  const out = createLayer(size, size);
  out.ctx.fillStyle = palette.symbol;
  out.ctx.fillRect(0, 0, size, size);
  out.ctx.globalCompositeOperation = "destination-in";
  out.ctx.drawImage(geometry.mask, 0, 0);
  out.ctx.globalCompositeOperation = "source-over";
  out.ctx.drawImage(band.canvas, 0, 0);

  paintedCache.set(key, out.canvas);
  return out.canvas;
};

export interface SymbolShapeProps {
  ctx: CanvasRenderingContext2D;
  geometry: SymbolGeometry;
  palette: HazardPalette;
  centerX: number;
  centerY: number;
}

/** Paints the flat symbol and its printed edge onto the shared canvas. */
export const SymbolShape: React.FC<SymbolShapeProps> = ({
  ctx,
  geometry,
  palette,
  centerX,
  centerY,
}) => {
  const painted = getPaintedSymbol(geometry, palette);
  const half = geometry.size / 2;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(painted, centerX - half, centerY - half);
  ctx.restore();
  return null;
};
