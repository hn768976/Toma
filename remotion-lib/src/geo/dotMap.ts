/**
 * dotMapFromLand — samples a grid against projected land and returns dots.
 *
 * WHAT: Rasterises the projected land polygons into a mask, walks a regular
 * grid over the frame, and returns one dot per grid cell whose centre falls on
 * land. Each dot carries a coastal flag.
 *
 * WHY A RASTER AND NOT A POINT-IN-POLYGON TEST: testing tens of thousands of
 * grid points against thousands of polygon rings is slow enough to be felt even
 * once. Filling the land into a canvas once and reading pixels is effectively
 * free by comparison, and the answer is identical at dot resolution.
 *
 * THE COASTAL FLAG: a dot is coastal when fewer than `coastalThreshold` of its
 * eight neighbours are also land. Brightening those dots is what makes a dot
 * map read as a map — without it the continents are undifferentiated fields of
 * identical dots and the coastline, which is the only recognisable feature,
 * disappears. Only one of the six source projects implemented this; it is on by
 * default here because it is the version that reads best, and `coastal: false`
 * gives you the plain version back.
 *
 * PARAMETERS
 *   fitted             From `fitProjection`.
 *   land               The GeoJSON to fill. Usually the same you fitted to.
 *   pitch              Grid spacing in px. Default 13.
 *   coastal            Compute the coastal flag. Default true.
 *   coastalThreshold   Land neighbours below which a dot counts as coastal,
 *                      out of 8. Default 8 — i.e. any dot with a non-land
 *                      neighbour is coastal, which gives a one-dot rim.
 *                      Lower values give a thinner, more selective rim.
 *   jitter             Random offset per dot as a fraction of pitch, 0..1.
 *                      Default 0. A perfect grid is usually what you want for
 *                      a dot map, but a little jitter helps if the grid is
 *                      moire-ing against the projection.
 *   rng                Required only when `jitter` > 0.
 *
 * RETURNS dots in frame coordinates with `col`, `row`, and `isCoastal`.
 *
 * GOTCHA: needs a DOM canvas. Call inside useMemo, not per frame — the
 * rasterise is the expensive part and the result is frame-independent.
 *
 * GOTCHA: at small `pitch` on a 4K frame this returns a lot of dots (pitch 6 on
 * 3840x2160 is ~230k cells). Draw them with a single path, not one path per
 * dot.
 *
 * EXAMPLE
 *   const dots = useMemo(() => dotMapFromLand({ fitted, land }), [fitted, land]);
 *   for (const d of dots) {
 *     ctx.fillStyle = d.isCoastal ? coastColor : landColor;
 *     ctx.fillRect(d.x, d.y, 3, 3);
 *   }
 */
import type { Rng } from '../types';
import type { FittedProjection, LandInput } from './projection';

export type MapDot = {
  x: number;
  y: number;
  col: number;
  row: number;
  /** True when this dot sits on the coastline. */
  isCoastal: boolean;
};

export type DotMapOptions = {
  fitted: FittedProjection;
  land: LandInput;
  pitch?: number;
  coastal?: boolean;
  coastalThreshold?: number;
  jitter?: number;
  rng?: Rng;
};

export const dotMapFromLand = ({
  fitted,
  land,
  pitch = 13,
  coastal = true,
  coastalThreshold = 8,
  jitter = 0,
  rng,
}: DotMapOptions): MapDot[] => {
  if (jitter > 0 && !rng) {
    throw new Error('dotMapFromLand: rng is required when jitter > 0');
  }

  const { width, height, path } = fitted;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable while rasterising land');

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  // d3's path generator writes into the context directly when given one.
  const render = path.context(ctx);
  render(land as never);
  ctx.fill();
  // Release the context binding so the generator can be reused for strings.
  path.context(null);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const cols = Math.floor(width / pitch);
  const rows = Math.floor(height / pitch);

  const isLand = (px: number, py: number): boolean => {
    if (px < 0 || py < 0 || px >= width || py >= height) return false;
    return pixels[(Math.floor(py) * width + Math.floor(px)) * 4 + 3] > 127;
  };

  // First pass: which cells are land. Kept as a flat array so the neighbour
  // test below is an index lookup rather than another pixel read.
  const onLand = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * pitch + pitch / 2;
      const cy = row * pitch + pitch / 2;
      onLand[row * cols + col] = isLand(cx, cy) ? 1 : 0;
    }
  }

  const dots: MapDot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!onLand[row * cols + col]) continue;

      let isCoastal = false;
      if (coastal) {
        let neighbours = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nc = col + dx;
            const nr = row + dy;
            // Off-grid neighbours count as sea, so the map edge reads as coast.
            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
            neighbours += onLand[nr * cols + nc];
          }
        }
        isCoastal = neighbours < coastalThreshold;
      }

      let x = col * pitch + pitch / 2;
      let y = row * pitch + pitch / 2;
      if (jitter > 0 && rng) {
        x += (rng() * 2 - 1) * jitter * pitch * 0.5;
        y += (rng() * 2 - 1) * jitter * pitch * 0.5;
      }

      dots.push({ x, y, col, row, isCoastal });
    }
  }

  return dots;
};
