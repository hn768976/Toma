// Look-dev harness: renders any look's draw function at any frame outside
// Remotion (same code path as the compositions). Used by tools/snap.mjs.
import { LOOKS } from "../src/looks/registry";

const W = 3840;
const H = 2160;

(window as any).renderFrame = (id: string, frame: number, dpr: number) => {
  const look = LOOKS[id];
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = look.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const t0 = performance.now();
  look.draw(ctx, frame, { W, H, dpr });
  const ms = performance.now() - t0;
  return { url: canvas.toDataURL("image/png"), ms };
};
