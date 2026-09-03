/** Creates a detached backing canvas; returns null during SSR. */
export const createBuffer = (
  width: number,
  height: number,
): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export const clear = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
};
