// Scratch canvases reused between frames as plain buffers. Every user clears
// or fully overwrites them before reading, so no visual state carries over.
const pool = new Map<string, HTMLCanvasElement>();

export const scratch = (key: string, w: number, h: number) => {
  let c = pool.get(key);
  if (!c) {
    c = document.createElement("canvas");
    pool.set(key, c);
  }
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const ctx = c.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.clearRect(0, 0, w, h);
  return { canvas: c, ctx };
};
