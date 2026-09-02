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
 * overall radius.
 *
 * These proportions are not invented: they were measured off the mark itself
 * by fitting circles to its outline, and reproduce it to an intersection-over-
 * union of 0.975 (the remainder is antialiasing on the reference at its own
 * resolution). Like the trefoil, the mark is standardised, so it is
 * reproduced faithfully rather than stylised.
 *
 * The mark is built from three families of circles, all on the same three
 * axes 120 degrees apart:
 *
 *   - Three RING discs, whose union is the mark's outer silhouette. Each sits
 *     RING_DISTANCE from the centre and reaches exactly to the symbol radius.
 *   - Three CUT discs, one inside each ring disc but pushed further out, which
 *     hollow each ring into a thick crescent — thin where it meets the
 *     silhouette, broad where it sweeps past the centre.
 *   - A central VOID with three lobes on the same axes, which opens the middle
 *     and severs the three crescents from one another.
 *
 * Three round-capped ARCS, concentric with the centre, complete the mark.
 *
 * The three crescents and the three arcs are six separate pieces: the mark is
 * not one connected shape, and the negative spaces between the crescents are
 * its most recognisable feature.
 */
const BIOHAZARD = {
  /** Distance from the common centre to each ring disc's centre. */
  RING_DISTANCE: 0.4255,
  /** Radius of each ring disc. RING_DISTANCE + RING_RADIUS is the extent. */
  RING_RADIUS: 0.577,
  /** Distance to each cut disc's centre, further out than the ring's. */
  CUT_DISTANCE: 0.5787,
  /** Radius of each cut disc; smaller than the ring's, so it hollows it. */
  CUT_RADIUS: 0.4062,
  /** The circular part of the central void. */
  VOID_RADIUS: 0.1175,
  /** Distance to each of the void's three lobes. */
  VOID_LOBE_DISTANCE: 0.14,
  /** Radius of each lobe; these are what part the three crescents. */
  VOID_LOBE_RADIUS: 0.0256,
  /** Inner and outer radius of the three arcs around the centre. */
  ARC_INNER: 0.386,
  ARC_OUTER: 0.52,
  /** Half the angle each arc subtends, in degrees. */
  ARC_HALF_ANGLE: 32.25,
};

const paintBiohazard: SymbolPainter = (ctx, cx, cy, radius) => {
  const B = BIOHAZARD;
  // Normalise so the mark's extent is exactly the requested radius, whatever
  // the fitted constants sum to.
  const unit = radius / (B.RING_DISTANCE + B.RING_RADIUS);
  // One axis points straight up, the others follow at 120 degrees.
  const axis = (i: number) => -TAU / 4 + (TAU / 3) * i;
  const along = (angle: number, distance: number) =>
    [cx + Math.cos(angle) * distance * unit, cy + Math.sin(angle) * distance * unit] as const;

  const scratch = createLayer(ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#ffffff";

  for (let i = 0; i < 3; i++) {
    const angle = axis(i);
    const [rx, ry] = along(angle, B.RING_DISTANCE);
    const [kx, ky] = along(angle, B.CUT_DISTANCE);

    // Each crescent is hollowed on its own layer before joining the union.
    // Cutting after the union would let one crescent's cut eat into its
    // neighbour's material, which the mark does not do.
    resetLayer(scratch.ctx);
    scratch.ctx.fillStyle = "#ffffff";
    scratch.ctx.beginPath();
    scratch.ctx.arc(rx, ry, B.RING_RADIUS * unit, 0, TAU);
    scratch.ctx.fill();
    scratch.ctx.globalCompositeOperation = "destination-out";
    scratch.ctx.beginPath();
    scratch.ctx.arc(kx, ky, B.CUT_RADIUS * unit, 0, TAU);
    scratch.ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(scratch.canvas, 0, 0);
  }

  // Open the centre and part the three crescents.
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, B.VOID_RADIUS * unit, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const [lx, ly] = along(axis(i), B.VOID_LOBE_DISTANCE);
    ctx.beginPath();
    ctx.arc(lx, ly, B.VOID_LOBE_RADIUS * unit, 0, TAU);
    ctx.fill();
  }

  // The three arcs, concentric with the centre and round-capped.
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = (B.ARC_OUTER - B.ARC_INNER) * unit;
  ctx.lineCap = "round";
  const arcRadius = ((B.ARC_INNER + B.ARC_OUTER) / 2) * unit;
  const half = (B.ARC_HALF_ANGLE * Math.PI) / 180;
  for (let i = 0; i < 3; i++) {
    const angle = axis(i);
    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, angle - half, angle + half);
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
