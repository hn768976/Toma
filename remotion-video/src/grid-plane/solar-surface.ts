// Monocrystalline solar cell surface, shared by both grid-plane videos.
//
// The reference photograph shows the giveaway of a monocrystalline module:
// pseudo-square cells whose corners are cut off, so the pale backsheet shows
// through as a straight gap between neighbouring cells and as a small diamond
// wherever four cells meet. Thin silver busbars run across each cell row.
//
// Rather than draw each cell as its own polygon, the surface is drawn as light
// detail over a dark panel face: gaps, corner diamonds and busbars. That is the
// same picture with far less geometry, and it lets each kind of detail fade out
// at its own distance instead of the whole panel switching level of detail at
// one depth and popping.
//
// Every helper returns SVG path data holding many subpaths, so one panel's
// hundreds of cell details cost a single DOM node.

import { Camera, projectPolygonPath, projectSegment } from "./camera";

/** A panel's footprint on the ground plane. */
export type PanelRect = {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
};

export type CellSpec = {
  /** Cells across the panel's x extent. */
  cellsX: number;
  /** Cells across the panel's z extent. */
  cellsZ: number;
  /** Busbars crossing each cell row. */
  busbars: number;
  /**
   * Half-diagonal of the corner diamond, as a fraction of the shorter cell
   * side. This is the chamfer cut off each cell corner.
   */
  diamond: number;
};

/**
 * Straight gaps between neighbouring cells, as one multi-subpath string.
 * `wy` is the elevation of the cell face — the top of a raised module, not the
 * mounting plane.
 */
export const gapLinePath = (
  r: PanelRect,
  spec: CellSpec,
  cam: Camera,
  wy: number = cam.height,
): string => {
  let d = "";
  const add = (ax: number, az: number, bx: number, bz: number) => {
    const seg = projectSegment(ax, az, bx, bz, cam, wy);
    if (!seg) return;
    d += `M${seg[0].x.toFixed(1)} ${seg[0].y.toFixed(1)}L${seg[1].x.toFixed(1)} ${seg[1].y.toFixed(1)}`;
  };

  for (let i = 1; i < spec.cellsX; i++) {
    const x = r.x0 + ((r.x1 - r.x0) * i) / spec.cellsX;
    add(x, r.z0, x, r.z1);
  }
  for (let j = 1; j < spec.cellsZ; j++) {
    const z = r.z0 + ((r.z1 - r.z0) * j) / spec.cellsZ;
    add(r.x0, z, r.x1, z);
  }
  return d;
};

/** The pale diamonds where four chamfered cell corners meet. */
export const cornerDiamondPath = (
  r: PanelRect,
  spec: CellSpec,
  cam: Camera,
  wy: number = cam.height,
): string => {
  const cw = (r.x1 - r.x0) / spec.cellsX;
  const cd = (r.z1 - r.z0) / spec.cellsZ;
  const s = Math.min(cw, cd) * spec.diamond;

  let d = "";
  for (let i = 1; i < spec.cellsX; i++) {
    const gx = r.x0 + cw * i;
    for (let j = 1; j < spec.cellsZ; j++) {
      const gz = r.z0 + cd * j;
      const sub = projectPolygonPath(
        [
          [gx - s, gz],
          [gx, gz - s],
          [gx + s, gz],
          [gx, gz + s],
        ],
        cam,
        wy,
      );
      if (sub) d += sub;
    }
  }
  return d;
};

/**
 * Busbars run the length of the panel, a fixed number per cell row — the same
 * arrangement as the reference, where each cell is crossed by two thin silver
 * lines that carry on into the cell beyond.
 */
export const busbarPath = (
  r: PanelRect,
  spec: CellSpec,
  cam: Camera,
  wy: number = cam.height,
): string => {
  const cd = (r.z1 - r.z0) / spec.cellsZ;
  let d = "";
  for (let j = 0; j < spec.cellsZ; j++) {
    for (let b = 1; b <= spec.busbars; b++) {
      const z = r.z0 + cd * (j + b / (spec.busbars + 1));
      const seg = projectSegment(r.x0, z, r.x1, z, cam, wy);
      if (!seg) continue;
      d += `M${seg[0].x.toFixed(1)} ${seg[0].y.toFixed(1)}L${seg[1].x.toFixed(1)} ${seg[1].y.toFixed(1)}`;
    }
  }
  return d;
};

/**
 * Smooth 1 -> 0 ramp over [full, gone]. Each kind of cell detail gets its own
 * ramp so it dissolves at the distance where it stops being resolvable,
 * instead of the panel snapping between levels of detail.
 */
export const detailFade = (depth: number, full: number, gone: number): number => {
  if (depth <= full) return 1;
  if (depth >= gone) return 0;
  const t = (depth - full) / (gone - full);
  return 1 - t * t * (3 - 2 * t);
};

export type Stroke = {
  /** Stroke width in design-space units. */
  width: number;
  /** Opacity multiplier that compensates for holding the width at a pixel. */
  alpha: number;
};

/**
 * Stroke width for a line at a given depth, plus an opacity scale.
 *
 * Below about a pixel, a stroke's antialiased coverage depends on exactly where
 * it falls between pixel centres, so a whole field of hairlines crawls and
 * flickers as the camera moves — the cell mesh covers most of the frame, which
 * makes that read as the entire surface shimmering. Holding the width at one
 * pixel and taking the lost weight out of the opacity instead keeps the
 * apparent density identical with none of the aliasing.
 */
export const strokeFor = (
  depth: number,
  base: number,
  maxScale = 2.4,
): Stroke => {
  const ideal = Math.min(base * maxScale, (base * 11) / depth);
  if (ideal >= 1) return { width: ideal, alpha: 1 };
  return { width: 1, alpha: Math.max(0.05, ideal) };
};
