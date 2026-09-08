import { PERSPECTIVE, PLANE_HEIGHT, ROTATE_X, WIDTH } from "../constants";

/**
 * Depth-of-field slices.
 *
 * `top`/`height` are in board-plane pixels. `blurFrac` is the wanted on-screen
 * radius as a fraction of the frame width, so the softness holds at whatever
 * resolution the composition is rendered at - 1080p preview or full 4K.
 *
 * Slicing in plane space rather than screen space is deliberate: rotateZ tilts
 * the rows on screen but does not change their depth, so a constant-depth slice
 * is a tilted stripe. Cutting horizontal screen bands instead would put the
 * focus edge across the rows at the wrong angle.
 */
export type Band = { top: number; height: number; blurFrac: number };

/** Radii written as pixels at the design width, then divided into a fraction. */
const px = (v: number) => v / WIDTH;

export const BANDS: readonly Band[] = [
  { top: 0, height: 780, blurFrac: px(24) }, // far - top of frame
  { top: 780, height: 400, blurFrac: px(9) },
  { top: 1180, height: 340, blurFrac: px(2) },
  { top: 1520, height: 360, blurFrac: 0 }, // the sharp band
  { top: 1880, height: 440, blurFrac: px(6) },
  { top: 2320, height: PLANE_HEIGHT - 2320, blurFrac: px(26) }, // near - unreadable
];

/** How much the perspective transform scales a given plane row on screen. */
export const scaleAtPlaneY = (planeY: number): number => {
  const fromCentre = planeY - PLANE_HEIGHT / 2;
  const z = fromCentre * Math.sin((ROTATE_X * Math.PI) / 180);
  return PERSPECTIVE / (PERSPECTIVE - z);
};

/**
 * The blur filter runs in the plane's own coordinate space, before the
 * perspective transform scales it, so dividing by the local scale is what makes
 * the *rendered* radius match `blurFrac` at every depth.
 */
export const localBlurFor = (band: Band, frameWidth: number): number => {
  if (band.blurFrac === 0) return 0;
  const wanted = band.blurFrac * frameWidth;
  return wanted / scaleAtPlaneY(band.top + band.height / 2);
};

/** Crossfade depth between neighbouring slices, in plane pixels. */
export const BAND_OVERLAP = 190;
