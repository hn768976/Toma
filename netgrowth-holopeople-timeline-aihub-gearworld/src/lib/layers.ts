// Offscreen canvases reused between frames. They are fully cleared and
// redrawn every frame, so no visual state is carried over.
const pool = new Map<string, HTMLCanvasElement>();

export const getLayer = (name: string, w: number, h: number, clear = true): CanvasRenderingContext2D => {
  const key = `${name}:${w}x${h}`;
  let c = pool.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    pool.set(key, c);
  }
  const ctx = c.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  if (clear) ctx.clearRect(0, 0, w, h);
  return ctx;
};

// Additive soft glow of `src` (device-pixel canvas) onto `dst`.
// blur is in device pixels of the full-size buffer.
export const addGlow = (
  dst: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  blur: number,
  strength: number,
  tag = "glow",
) => {
  const down = 4;
  const sw = Math.max(1, Math.round(src.width / down));
  const sh = Math.max(1, Math.round(src.height / down));
  const g = getLayer(tag, sw, sh);
  g.filter = `blur(${Math.max(0.5, blur / down)}px)`;
  g.drawImage(src, 0, 0, sw, sh);
  g.filter = "none";
  dst.save();
  dst.setTransform(1, 0, 0, 1, 0, 0);
  dst.globalCompositeOperation = "lighter";
  dst.imageSmoothingEnabled = true;
  dst.imageSmoothingQuality = "high";
  let s = strength;
  while (s > 0) {
    dst.globalAlpha = Math.min(1, s);
    dst.drawImage(g.canvas, 0, 0, src.width, src.height);
    s -= 1;
  }
  dst.restore();
};
