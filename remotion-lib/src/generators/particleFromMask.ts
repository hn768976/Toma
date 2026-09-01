/**
 * particleFromMask — rejection-sample particle positions inside a silhouette.
 *
 * WHAT: Rasterises a filled path into an offscreen mask, builds a distance
 * field from it, then draws N points that land inside the shape — optionally
 * weighted so more of them cluster near the edge.
 *
 * WHY REJECTION SAMPLING: there is no closed form for "a uniform point inside
 * an arbitrary path". Rasterise once and test candidates against the raster and
 * you get uniform coverage of any shape, including concave ones and shapes with
 * holes, for a few lines of code. This drives every particle figure, head,
 * cloud and logo across the source projects.
 *
 * WHY THE EDGE WEIGHTING: a uniform fill reads as a filled blob — the outline,
 * which is the only thing that makes the silhouette recognisable, is no denser
 * than the middle. Weighting density toward the edge keeps the form readable
 * while the interior stays airy. `edgeBias` 0 gives a uniform fill; 1 puts
 * almost everything on the rim.
 *
 * PARAMETERS
 *   path        SVG path data, or a Path2D. The filled region is the target.
 *   count       How many particles to return.
 *   rng         Seeded generator. Required.
 *   width, height  Size of the coordinate space the path is authored in, and
 *               of the returned positions.
 *   resolution  Mask raster size on the long edge. Default 512. Higher
 *               resolves finer detail at the cost of a bigger rasterise.
 *   edgeBias    0..1, how strongly to favour the rim. Default 0.35.
 *   edgeFalloff Distance in mask px over which the edge weighting decays.
 *               Default 12.
 *   maxAttempts Safety cap on candidate draws. Default count * 200.
 *
 * RETURNS particles with `x`, `y` in path coordinates plus `edgeDistance`
 * (in mask px) so callers can size or brighten by proximity to the rim.
 *
 * GOTCHA: requires a DOM canvas — it rasterises. In Remotion this is fine
 * inside a component, but call it in a `useMemo` keyed on the inputs, never per
 * frame: the rasterise and distance transform are the expensive part and the
 * result does not change between frames.
 *
 * GOTCHA: if the path fills nothing (bad path data, or entirely outside the
 * box) this throws rather than looping forever.
 *
 * EXAMPLE
 *   const pts = useMemo(() => particleFromMask({
 *     path: LOGO_PATH, count: 4000, rng, width: 1920, height: 1080,
 *   }), []);
 */
import type { Rng } from '../types';

export type MaskParticle = {
  x: number;
  y: number;
  /** Distance from the silhouette edge, in mask pixels. 0 is on the rim. */
  edgeDistance: number;
};

export type ParticleFromMaskOptions = {
  path: string | Path2D;
  count: number;
  rng: Rng;
  width: number;
  height: number;
  resolution?: number;
  edgeBias?: number;
  edgeFalloff?: number;
  maxAttempts?: number;
  /** Fill rule for the rasterise. Default 'nonzero'. */
  fillRule?: CanvasFillRule;
};

/**
 * Two-pass 3-4 chamfer distance transform.
 *
 * Approximates Euclidean distance closely enough for density weighting at a
 * fraction of the cost of an exact transform. Returns distance in mask pixels
 * from each inside pixel to the nearest outside pixel.
 */
const distanceTransform = (
  inside: Uint8Array,
  w: number,
  h: number,
): Float32Array => {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = inside[i] ? INF : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (y > 0) {
        if (d[i - w] + 3 < m) m = d[i - w] + 3;
        if (x > 0 && d[i - w - 1] + 4 < m) m = d[i - w - 1] + 4;
        if (x < w - 1 && d[i - w + 1] + 4 < m) m = d[i - w + 1] + 4;
      }
      if (x > 0 && d[i - 1] + 3 < m) m = d[i - 1] + 3;
      d[i] = m;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (y < h - 1) {
        if (d[i + w] + 3 < m) m = d[i + w] + 3;
        if (x < w - 1 && d[i + w + 1] + 4 < m) m = d[i + w + 1] + 4;
        if (x > 0 && d[i + w - 1] + 4 < m) m = d[i + w - 1] + 4;
      }
      if (x < w - 1 && d[i + 1] + 3 < m) m = d[i + 1] + 3;
      d[i] = m;
    }
  }
  // The 3-4 chamfer counts an orthogonal step as 3, so divide back to pixels.
  for (let i = 0; i < d.length; i++) d[i] = Math.min(d[i], INF) / 3;
  return d;
};

export const particleFromMask = ({
  path,
  count,
  rng,
  width,
  height,
  resolution = 512,
  edgeBias = 0.35,
  edgeFalloff = 12,
  maxAttempts,
  fillRule = 'nonzero',
}: ParticleFromMaskOptions): MaskParticle[] => {
  // Mask resolution: `resolution` on the long edge, aspect preserved.
  const scale = resolution / Math.max(width, height);
  const mw = Math.max(1, Math.round(width * scale));
  const mh = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = mw;
  canvas.height = mh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable while rasterising a mask');

  ctx.scale(mw / width, mh / height);
  ctx.fillStyle = '#fff';
  ctx.fill(typeof path === 'string' ? new Path2D(path) : path, fillRule);

  const pixels = ctx.getImageData(0, 0, mw, mh).data;
  const inside = new Uint8Array(mw * mh);
  let area = 0;
  for (let i = 0; i < inside.length; i++) {
    // Alpha over half counts as inside; antialiased rim pixels below that are
    // excluded, which keeps the silhouette edge crisp.
    inside[i] = pixels[i * 4 + 3] > 127 ? 1 : 0;
    area += inside[i];
  }

  if (area === 0) {
    throw new Error(
      'particleFromMask: the path filled no pixels — check the path data and that it lies within width/height',
    );
  }

  const edge = distanceTransform(inside, mw, mh);

  // Peak weight, used to normalise the acceptance test so the loop is not
  // rejecting almost everything when edgeBias is high.
  let maxWeight = 0;
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    const w = 1 - edgeBias + edgeBias * Math.exp(-edge[i] / Math.max(1e-6, edgeFalloff));
    if (w > maxWeight) maxWeight = w;
  }

  const out: MaskParticle[] = [];
  const cap = maxAttempts ?? count * 200;
  let attempts = 0;

  while (out.length < count && attempts < cap) {
    attempts++;
    const px = rng() * mw;
    const py = rng() * mh;
    const ix = Math.min(mw - 1, Math.floor(px));
    const iy = Math.min(mh - 1, Math.floor(py));
    const idx = iy * mw + ix;

    if (!inside[idx]) continue;

    if (edgeBias > 0) {
      const weight =
        1 - edgeBias + edgeBias * Math.exp(-edge[idx] / Math.max(1e-6, edgeFalloff));
      if (rng() > weight / maxWeight) continue;
    }

    out.push({
      x: (px / mw) * width,
      y: (py / mh) * height,
      edgeDistance: edge[idx],
    });
  }

  return out;
};
