/**
 * A separable, full-resolution Gaussian blur over an interleaved RGB float
 * buffer.
 *
 * Chrome's own `ctx.filter = 'blur(...)'` cannot be used for this. Past a
 * fairly small radius Skia decimates the bitmap, blurs the small copy and
 * bilinearly upscales the result, which at a 150px radius leaves visible
 * facets and boxy plateaus in what should be a perfectly smooth field. That is
 * the "reduced resolution and upscaled" failure, and once the quantisation is
 * in the field there is no recovering from it.
 *
 * Three box blurs approximate a Gaussian closely enough that no eye will find
 * the difference, and a moving sum makes each pass O(1) per pixel regardless
 * of radius. Working in float also means the 8-bit readback of the blob layer
 * is averaged over thousands of samples, so the field that comes out is
 * smoother than the one that went in.
 */

/** Box widths whose successive application best matches a Gaussian sigma. */
export const boxSizesForGaussian = (sigma: number, passes: number): number[] => {
  const ideal = Math.sqrt((12 * sigma * sigma) / passes + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower--;
  if (lower < 1) lower = 1;
  const upper = lower + 2;
  const crossover = Math.round(
    (12 * sigma * sigma - passes * lower * lower - 4 * passes * lower - 3 * passes) /
      (-4 * lower - 4),
  );
  const sizes: number[] = [];
  for (let i = 0; i < passes; i++) sizes.push(i < crossover ? lower : upper);
  return sizes;
};

const boxHorizontal = (
  buf: Float32Array,
  width: number,
  height: number,
  radius: number,
  row: Float32Array,
): void => {
  const norm = 1 / (2 * radius + 1);
  const last = width - 1;
  for (let y = 0; y < height; y++) {
    const base = y * width * 3;
    row.set(buf.subarray(base, base + width * 3));
    for (let c = 0; c < 3; c++) {
      // Clamp-to-edge: the window starts with the first sample repeated.
      let sum = row[c] * (radius + 1);
      for (let i = 1; i <= radius; i++) sum += row[(i < last ? i : last) * 3 + c];
      for (let x = 0; x < width; x++) {
        buf[base + x * 3 + c] = sum * norm;
        const ahead = x + radius + 1;
        const behind = x - radius;
        sum +=
          row[(ahead < last ? ahead : last) * 3 + c] - row[(behind > 0 ? behind : 0) * 3 + c];
      }
    }
  }
};

const boxVertical = (
  buf: Float32Array,
  width: number,
  height: number,
  radius: number,
  column: Float32Array,
): void => {
  const norm = 1 / (2 * radius + 1);
  const last = height - 1;
  const stride = width * 3;
  for (let x = 0; x < width; x++) {
    const base = x * 3;
    for (let y = 0; y < height; y++) {
      const src = base + y * stride;
      const dst = y * 3;
      column[dst] = buf[src];
      column[dst + 1] = buf[src + 1];
      column[dst + 2] = buf[src + 2];
    }
    for (let c = 0; c < 3; c++) {
      let sum = column[c] * (radius + 1);
      for (let i = 1; i <= radius; i++) sum += column[(i < last ? i : last) * 3 + c];
      for (let y = 0; y < height; y++) {
        buf[base + y * stride + c] = sum * norm;
        const ahead = y + radius + 1;
        const behind = y - radius;
        sum +=
          column[(ahead < last ? ahead : last) * 3 + c] -
          column[(behind > 0 ? behind : 0) * 3 + c];
      }
    }
  }
};

export const blurRgbInPlace = (
  buf: Float32Array,
  width: number,
  height: number,
  sigma: number,
): void => {
  if (sigma <= 0) return;
  const row = new Float32Array(width * 3);
  const column = new Float32Array(height * 3);
  for (const size of boxSizesForGaussian(sigma, 3)) {
    const radius = (size - 1) / 2;
    if (radius < 1) continue;
    boxHorizontal(buf, width, height, radius, row);
    boxVertical(buf, width, height, radius, column);
  }
};

/** Padding needed around the frame so the blur does not pull in empty space. */
export const blurPadding = (sigma: number): number => Math.ceil(sigma * 2);
