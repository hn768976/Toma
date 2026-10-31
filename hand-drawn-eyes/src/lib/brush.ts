// p5.brush (standalone build) paints the crayon textures. It needs a WebGL2
// context internally, so it is used ONLY here, once per texture variant, on
// one hidden canvas; each result is copied into a plain 2D canvas and every
// frame of the animation is composited with Canvas 2D.
import * as brush from "p5.brush/standalone";
import { makeCanvas } from "./CanvasHost";

let glCanvas: HTMLCanvasElement | null = null;

export type BrushApi = typeof brush;

// Paints with p5.brush in black on white "paper", then turns the result
// into an alpha mask (white where nothing was painted -> transparent).
// p5.brush mixes pigments subtractively, so light crayon cannot be laid
// directly on a black ground; instead the grain is captured as a mask and
// coloured in Canvas 2D.
export const paintMask = (
  w: number,
  h: number,
  seed: number,
  paint: (b: BrushApi) => void,
): HTMLCanvasElement => {
  if (!glCanvas) glCanvas = document.createElement("canvas");
  glCanvas.width = Math.ceil(w);
  glCanvas.height = Math.ceil(h);
  brush.load(glCanvas);
  brush.angleMode(brush.DEGREES);
  brush.seed(seed);
  brush.noiseSeed(seed);
  brush.clear("#ffffff");
  // Standalone p5.brush puts the origin at the centre; use top-left.
  brush.push();
  brush.translate(-w / 2, -h / 2);
  paint(brush);
  brush.pop();
  brush.render();
  const { c, ctx } = makeCanvas(w, h);
  ctx.drawImage(glCanvas, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    d[i + 3] = 255 - lum;
    d[i] = d[i + 1] = d[i + 2] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};
