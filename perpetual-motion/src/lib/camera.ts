export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** Every clip is a 20 s seamless loop. */
export const LOOP = 600;
/** Still exports: 6000 × 3375 is the 3840 × 2160 composition at this scale. */
export const STILL_SCALE = 6000 / 3840;

export interface Camera {
  cx: number;
  cy: number;
  zoom: number;
}

/** A slow push in and out: one whole cosine cycle per loop, at most 4% zoom. */
export function cameraAt(frame: number): Camera {
  const phase = (2 * Math.PI * frame) / LOOP;
  return { cx: WIDTH / 2, cy: HEIGHT / 2, zoom: 1 + 0.02 * (1 - Math.cos(phase)) };
}

export const cameraTransform = (c: Camera) =>
  `translate(${c.cx} ${c.cy}) scale(${c.zoom.toFixed(6)}) translate(${-c.cx} ${-c.cy})`;
