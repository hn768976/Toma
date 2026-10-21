import { CanvasSource, Texture } from "pixi.js";
import { PICTO_HEIGHT, drawPictogram } from "../pictogram";

export type IconTextures = { male: Texture; female: Texture; padY: number; scale: number };

// Pre-renders the two pictograms once into textures (supersampled, mipmapped).
// `glow` bakes a tight halo of the same colour around the icon (dark clips).
// Sprites made from these should use anchor (0.5, 1 - padY) and scale `scale` to draw an
// icon of `targetPx` height with its feet at the sprite position.
export const makeIconTextures = (
  targetPx: number,
  color: string,
  opts: { glow?: number; shade?: string } = {},
): IconTextures => {
  const ss = Math.max(4, Math.ceil(96 / targetPx));
  const h = Math.ceil(targetPx * ss);
  const glowPx = (opts.glow ?? 0) * h;
  const pad = Math.ceil(glowPx * 2.2) + 2;
  const w = Math.ceil((h * 0.6) + pad * 2);
  const H = h + pad * 2;
  const make = (female: boolean) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = H;
    const ctx = c.getContext("2d")!;
    if (glowPx > 0) {
      ctx.save();
      ctx.filter = `blur(${glowPx.toFixed(1)}px)`;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      drawPictogram(ctx, w / 2, pad + h, h, female);
      drawPictogram(ctx, w / 2, pad + h, h, female);
      ctx.restore();
    }
    ctx.fillStyle = color;
    drawPictogram(ctx, w / 2, pad + h, h, female);
    if (opts.shade) {
      // A darker right edge reads as the side of the figure (as in the reference).
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      const g = ctx.createLinearGradient(w / 2 - h * 0.27, 0, w / 2 + h * 0.27, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.62, "rgba(0,0,0,0)");
      g.addColorStop(1, opts.shade);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, H);
      ctx.restore();
    }
    const source = new CanvasSource({ resource: c, autoGenerateMipmaps: true, scaleMode: "linear" });
    source.style.mipmapFilter = "linear";
    return new Texture({ source });
  };
  return { male: make(false), female: make(true), padY: pad / H, scale: 1 / ss };
};

export { PICTO_HEIGHT };
