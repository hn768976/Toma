// Vendored from remotion-lib (see its CATALOG.md). Keep in sync with
// the library copy; this project ships standalone, so the file lives here.
/** Offscreen canvas helpers. */
export type Ctx = CanvasRenderingContext2D;

/** Allocate an offscreen canvas with a given backing-store size. */
export const makeBuffer = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
