/** Equirectangular mapping between geographic coordinates and flat pixels. */
import {
  MAP_HEIGHT,
  MAP_LAT_BOTTOM,
  MAP_LAT_TOP,
  MAP_WIDTH,
  MAP_X,
  MAP_Y,
} from "./constants";

export const lonToX = (lon: number): number =>
  MAP_X + ((lon + 180) / 360) * MAP_WIDTH;

export const latToY = (lat: number): number =>
  MAP_Y + ((MAP_LAT_TOP - lat) / (MAP_LAT_TOP - MAP_LAT_BOTTOM)) * MAP_HEIGHT;

export const xToLon = (x: number): number =>
  ((x - MAP_X) / MAP_WIDTH) * 360 - 180;

export const yToLat = (y: number): number =>
  MAP_LAT_TOP - ((y - MAP_Y) / MAP_HEIGHT) * (MAP_LAT_TOP - MAP_LAT_BOTTOM);

/** Degrees of longitude / latitude spanned by one flat pixel. */
export const LON_PER_PX = 360 / MAP_WIDTH;
export const LAT_PER_PX = (MAP_LAT_TOP - MAP_LAT_BOTTOM) / MAP_HEIGHT;
