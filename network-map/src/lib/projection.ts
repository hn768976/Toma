import type {MapFit, Viewport} from '../config';

/**
 * Plain equirectangular projection fitted to a frame. The only inputs are the
 * viewport box and the frame size - there is no world-sized constant anywhere,
 * so a tighter box simply produces a larger scale factor.
 */
export type Projection = {
  /** Frame pixels per degree, identical on both axes. */
  scale: number;
  /** Top-left corner of the projected box, in frame pixels. */
  originX: number;
  originY: number;
  /** Size of the projected box, in frame pixels. */
  mapWidth: number;
  mapHeight: number;
  viewport: Viewport;
  projectX: (lon: number) => number;
  projectY: (lat: number) => number;
};

export const createProjection = (
  viewport: Viewport,
  frameWidth: number,
  frameHeight: number,
  fit: MapFit,
): Projection => {
  const lonSpan = viewport.lonMax - viewport.lonMin;
  const latSpan = viewport.latMax - viewport.latMin;

  const scale = Math.min(
    (frameWidth * fit.maxWidth) / lonSpan,
    (frameHeight * fit.maxHeight) / latSpan,
  );

  const mapWidth = lonSpan * scale;
  const mapHeight = latSpan * scale;
  const originX = (frameWidth - mapWidth) / 2;
  const originY = (frameHeight - mapHeight) / 2 + fit.offsetY;

  return {
    scale,
    originX,
    originY,
    mapWidth,
    mapHeight,
    viewport,
    projectX: (lon) => originX + (lon - viewport.lonMin) * scale,
    projectY: (lat) => originY + (viewport.latMax - lat) * scale,
  };
};
