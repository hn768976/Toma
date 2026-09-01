// Small canvas helpers shared by the layers. Everything here runs during a
// React render or layout effect, never on a timer.

export const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

export const context2d = (canvas: HTMLCanvasElement | null) =>
  canvas ? canvas.getContext("2d") : null;

export const TAU = Math.PI * 2;
