import {random} from 'remotion';
import type {VariantConfig} from '../config';
import type {LandMask} from './land-mask';
import type {Projection} from './projection';

export type Dot = {
  x: number;
  y: number;
  /** 0 = dot dim, 1 = dot pale. Combines seeded texture and edge falloff. */
  tone: number;
};

export type DotMapData = {
  dots: Dot[];
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
};

/** Width of the edge falloff band, as a fraction of the shorter frame side. */
const EDGE_BAND = 0.16;

/**
 * Samples the land mask over the variant's viewport at the configured pitch and
 * returns one dot per land cell, already projected into frame pixels.
 *
 * The viewport and pitch are the only geographic inputs: pointing this at a
 * tighter box with a smaller pitch is all a regional variant needs.
 */
export const generateDotMap = (
  config: VariantConfig,
  projection: Projection,
  mask: LandMask,
  frameWidth: number,
  frameHeight: number,
): DotMapData => {
  const cols = Math.max(1, Math.round(projection.mapWidth / config.dotPitch));
  const rows = Math.max(1, Math.round(projection.mapHeight / config.dotPitch));
  const cellWidth = projection.mapWidth / cols;
  const cellHeight = projection.mapHeight / rows;

  const grid = mask.sample(projection.viewport, cols, rows);
  const band = Math.min(frameWidth, frameHeight) * EDGE_BAND;

  const dots: Dot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c] === 0) continue;

      const x = projection.originX + (c + 0.5) * cellWidth;
      const y = projection.originY + (r + 0.5) * cellHeight;

      // Seeded per-dot texture, so the stipple is not uniform.
      const texture = 0.62 + random(`${config.seed}-dot-${c}-${r}`) * 0.38;

      // Dots near the frame edges fall away toward the dim tone.
      const edge = Math.min(x, y, frameWidth - x, frameHeight - y);
      const edgeFade = Math.max(0, Math.min(1, edge / band));

      dots.push({x, y, tone: texture * (0.28 + 0.72 * edgeFade)});
    }
  }

  return {dots, cols, rows, cellWidth, cellHeight};
};
