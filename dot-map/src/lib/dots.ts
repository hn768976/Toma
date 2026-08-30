import {geoEquirectangular, geoPath} from 'd3-geo';
import type {GeoProjection} from 'd3-geo';
import {random} from 'remotion';
import {merge} from 'topojson-client';
import {context2d, makeCanvas} from './canvas';

/** Grid pitch in px at 4K. */
export const PITCH = 13;
/** Side of a dot in px at 4K — small enough to leave a gap at the pitch. */
export const DOT_SIZE = 7;
/**
 * Cells of grid drawn beyond each frame edge. The whole field drifts, so the
 * baked layer has to be larger than the frame or the drift reveals an edge.
 */
const MARGIN_CELLS = 2;
/** Antarctica's Natural Earth id — omitted; it unbalances the composition. */
const ANTARCTICA_ID = '010';
/**
 * Periods, in frames, for the per-dot ambient sine. Every one divides 600, so
 * every dot returns to its starting brightness on the loop point. They are
 * spread widely on purpose: a narrow set makes a visible wave cross the field.
 */
const AMBIENT_PERIODS = [24, 25, 30, 40, 50, 60, 75, 100, 120, 150, 200, 300];
/** A dot with fewer land neighbours than this is treated as coastal. */
const COASTAL_NEIGHBOURS = 6;

export const COLOR_LAND = 0;
export const COLOR_BRIGHT = 1;
export const COLOR_COASTAL = 2;
export const COLOR_HOT = 3;

export type DotField = {
  /** Number of land dots. */
  n: number;
  /** Frame-space centre of each dot. */
  x: Float32Array;
  y: Float32Array;
  /** Where each dot sits on the globe — the hotspot regions need this. */
  lon: Float32Array;
  lat: Float32Array;
  /** Base brightness, 0..1. */
  bright: Float32Array;
  /** COLOR_LAND | COLOR_BRIGHT | COLOR_COASTAL. */
  colorIndex: Uint8Array;
  /** Ambient sine period in frames, and its phase in turns. */
  period: Float32Array;
  phase: Float32Array;
  /** Geometry of the (over-sized) baked layer these dots live on. */
  layer: {
    originX: number;
    originY: number;
    width: number;
    height: number;
    cols: number;
    rows: number;
  };
  /** Every grid cell, land or not — the faint full-frame background grid. */
  gridX: Float32Array;
  gridY: Float32Array;
  projection: GeoProjection;
};

type TopoJson = {
  objects: {countries: {geometries: {id?: string | number}[]}};
};

/**
 * Land as one MultiPolygon: the country polygons merged so internal borders
 * dissolve, minus Antarctica.
 */
const landGeometry = (topology: TopoJson) => {
  const geometries = topology.objects.countries.geometries.filter(
    (g) => String(g.id) !== ANTARCTICA_ID,
  );
  // topojson-client's types are stricter than the shape we carry around here.
  return merge(topology as never, geometries as never);
};

/**
 * The dot set is generated once and reused for every frame. Re-projecting per
 * frame is both slow and wrong — it makes the map boil.
 */
export const buildDotField = (
  topology: TopoJson,
  width: number,
  height: number,
): DotField => {
  const land = landGeometry(topology);

  const cols = Math.floor(width / PITCH) + 1 + MARGIN_CELLS * 2;
  const rows = Math.floor(height / PITCH) + 1 + MARGIN_CELLS * 2;
  const originX =
    (width - Math.floor(width / PITCH) * PITCH) / 2 - MARGIN_CELLS * PITCH;
  const originY =
    (height - Math.floor(height / PITCH) * PITCH) / 2 - MARGIN_CELLS * PITCH;
  const layerWidth = (cols - 1) * PITCH + DOT_SIZE * 2;
  const layerHeight = (rows - 1) * PITCH + DOT_SIZE * 2;

  // Fit the land edge to edge horizontally, bleeding past the frame by the
  // margin so the drift never exposes a border.
  const bleed = MARGIN_CELLS * PITCH;
  const projection = geoEquirectangular().fitExtent(
    [
      [-bleed, -bleed],
      [width + bleed, height + bleed],
    ],
    land,
  );

  // Rasterising the land once and sampling it is far faster than running a
  // point-in-polygon test per grid position, and d3 handles the antimeridian.
  const mask = makeCanvas(layerWidth, layerHeight);
  const maskCtx = context2d(mask);
  maskCtx.fillStyle = 'rgb(0,0,0)';
  maskCtx.fillRect(0, 0, layerWidth, layerHeight);
  maskCtx.save();
  maskCtx.translate(-originX + DOT_SIZE, -originY + DOT_SIZE);
  maskCtx.beginPath();
  geoPath(projection, maskCtx)(land);
  maskCtx.fillStyle = 'rgb(255,255,255)';
  maskCtx.fill();
  maskCtx.restore();
  const maskData = maskCtx.getImageData(0, 0, layerWidth, layerHeight).data;

  const isLand = new Uint8Array(cols * rows);
  const gridX = new Float32Array(cols * rows);
  const gridY = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      gridX[i] = originX + c * PITCH;
      gridY[i] = originY + r * PITCH;
      const px = c * PITCH + DOT_SIZE;
      const py = r * PITCH + DOT_SIZE;
      isLand[i] = maskData[(py * layerWidth + px) * 4] > 127 ? 1 : 0;
    }
  }

  let count = 0;
  for (let i = 0; i < isLand.length; i++) {
    count += isLand[i];
  }

  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const lon = new Float32Array(count);
  const lat = new Float32Array(count);
  const bright = new Float32Array(count);
  const colorIndex = new Uint8Array(count);
  const period = new Float32Array(count);
  const phase = new Float32Array(count);

  let d = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isLand[r * cols + c]) {
        continue;
      }

      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const nc = c + dx;
          const nr = r + dy;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) {
            continue;
          }
          neighbours += isLand[nr * cols + nc];
        }
      }
      const coastal = neighbours < COASTAL_NEIGHBOURS;

      const px = originX + c * PITCH;
      const py = originY + r * PITCH;
      const inverted = projection.invert?.([px, py]);

      // Seeds are grid coordinates, so the field is identical on every render
      // regardless of the order it happens to be built in.
      const tier = random(`dot-tier-${c}-${r}`);
      let base: number;
      let color: number;
      if (tier < 0.12) {
        base = 0.5;
        color = COLOR_LAND;
      } else if (tier < 0.84) {
        base = 0.8;
        color = COLOR_LAND;
      } else {
        base = 1;
        color = COLOR_BRIGHT;
      }
      if (coastal) {
        // The edge emphasis is what makes the continents legible at a glance.
        base = Math.max(base, 0.94);
        color = COLOR_COASTAL;
      }
      // A little spread within each tier, so no tier reads as a flat plate.
      base *= 0.9 + random(`dot-jitter-${c}-${r}`) * 0.2;

      x[d] = px;
      y[d] = py;
      lon[d] = inverted ? inverted[0] : 0;
      lat[d] = inverted ? inverted[1] : 0;
      bright[d] = Math.min(1, base);
      colorIndex[d] = color;
      period[d] =
        AMBIENT_PERIODS[
          Math.floor(random(`dot-period-${c}-${r}`) * AMBIENT_PERIODS.length)
        ];
      phase[d] = random(`dot-phase-${c}-${r}`);
      d++;
    }
  }

  return {
    n: count,
    x,
    y,
    lon,
    lat,
    bright,
    colorIndex,
    period,
    phase,
    layer: {originX, originY, width: layerWidth, height: layerHeight, cols, rows},
    gridX,
    gridY,
    projection,
  };
};
