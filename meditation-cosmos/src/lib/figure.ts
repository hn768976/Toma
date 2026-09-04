/**
 * The supplied silhouette is black artwork on an opaque *white* background, so
 * it has to be keyed to alpha before it can be laid over a nebula.
 *
 * The key runs exactly once per renderer thread: the result is memoised at
 * module level and shared by all four compositions. Re-keying per frame (or per
 * composition) would repeat a full-resolution `getImageData` pass 2520 times for
 * no benefit.
 */
import { continueRender, delayRender, staticFile } from 'remotion';
import { useEffect, useState } from 'react';
import { clamp } from './rng';

export type KeyedFigure = {
  /** Tightly cropped to the silhouette's bounding box, pure black with alpha. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** height / width, for laying the figure out by height alone. */
  aspect: number;
};

/**
 * Luminance below `SOLID` is fully opaque, above `CLEAR` fully transparent, and
 * the range between the two ramps linearly. The ramp is deliberately wide and
 * near-linear: the anti-aliased pixels along the fingers and the topknot are
 * mid-greys, and a hard threshold would chew them off.
 */
const CLEAR = 0.97;
const SOLID = 0.03;

let cache: KeyedFigure | null = null;
let pending: Promise<KeyedFigure> | null = null;

const key = (img: HTMLImageElement): KeyedFigure => {
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0);

  const image = sctx.getImageData(0, 0, w, h);
  const p = image.data;

  // Key to alpha and track the silhouette's bounding box in the same pass.
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = (p[i] * 0.2126 + p[i + 1] * 0.7152 + p[i + 2] * 0.0722) / 255;
      const a = clamp((CLEAR - lum) / (CLEAR - SOLID));
      p[i] = 0;
      p[i + 1] = 0;
      p[i + 2] = 0;
      p[i + 3] = Math.round(a * 255);
      if (a > 0.06) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  sctx.putImageData(image, 0, 0);

  if (maxX < 0) {
    // Nothing keyed — fall back to the whole frame rather than dividing by zero.
    minX = 0;
    minY = 0;
    maxX = w - 1;
    maxY = h - 1;
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);

  return { canvas: out, width: cw, height: ch, aspect: ch / cw };
};

const load = (): Promise<KeyedFigure> => {
  if (pending) return pending;
  pending = new Promise<KeyedFigure>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cache = key(img);
      resolve(cache);
    };
    img.onerror = () => reject(new Error('Could not load the silhouette asset'));
    img.src = staticFile('figure.png');
  });
  return pending;
};

/**
 * Returns the keyed figure, holding back the render until the key has run.
 * Once cached, later frames get it synchronously with no delayRender at all.
 */
export const useFigure = (): KeyedFigure | null => {
  const [figure, setFigure] = useState<KeyedFigure | null>(cache);
  const [handle] = useState<number | null>(() => (cache ? null : delayRender('Keying the silhouette')));

  useEffect(() => {
    if (handle === null) return;
    let live = true;
    load().then((f) => {
      if (live) setFigure(f);
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [handle]);

  return figure;
};

/**
 * Anchor points down the figure's centreline, as fractions of the cropped
 * silhouette's height (0 = crown of the topknot, 1 = underside of the feet).
 * Measured off the artwork; used by the chakra composition.
 */
export const CENTRELINE = {
  crown: 0.014,
  brow: 0.224,
  throat: 0.357,
  heart: 0.503,
  solar: 0.579,
  sacral: 0.656,
  root: 0.738,
} as const;
