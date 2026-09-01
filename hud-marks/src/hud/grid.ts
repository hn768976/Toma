export const FRAME_W = 3840;
export const FRAME_H = 2160;

/**
 * A coarse grid centred in the frame. Marks are placed by integer cell, which
 * is what makes the field read as an interface rather than as scattered debris.
 */
export const gridCols = (pitch: number) => Math.floor(FRAME_W / pitch);
export const gridRows = (pitch: number) => Math.floor(FRAME_H / pitch);

export const gridOriginX = (pitch: number) =>
  (FRAME_W - (gridCols(pitch) - 1) * pitch) / 2;
export const gridOriginY = (pitch: number) =>
  (FRAME_H - (gridRows(pitch) - 1) * pitch) / 2;

export const cellX = (pitch: number, gx: number) => gridOriginX(pitch) + gx * pitch;
export const cellY = (pitch: number, gy: number) => gridOriginY(pitch) + gy * pitch;
