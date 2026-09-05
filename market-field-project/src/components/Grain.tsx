import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { GRAIN, SEED } from "../config";
import { mod, mulberry32 } from "../random";

/**
 * Fine additive dither at roughly 2%.
 *
 * The dark field and the soft gradient fills band badly in H.264 without it.
 * A handful of pre-baked noise tiles are cycled and offset per frame — cheap
 * enough to stay out of the way of a 4K render, and GRAIN.variants divides
 * the composition length so the grain cycle loops with everything else.
 */

const tileCache = new Map<number, HTMLCanvasElement>();

const noiseTile = (variant: number): HTMLCanvasElement => {
  const cached = tileCache.get(variant);
  if (cached) return cached;

  const size = GRAIN.tileSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  const rand = mulberry32(SEED ^ (variant * 0x9e3779b1));

  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 255;
    image.data[i + 1] = 255;
    image.data[i + 2] = 255;
    image.data[i + 3] = rand() * GRAIN.maxAlpha * 255;
  }

  ctx.putImageData(image, 0, 0);
  tileCache.set(variant, canvas);
  return canvas;
};

export const Grain: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const variant = mod(frame, GRAIN.variants);
    const tile = noiseTile(variant);
    const size = GRAIN.tileSize;

    // Offsetting the tiling as well as swapping the tile keeps the repeat
    // from ever settling into a visible grid.
    const rand = mulberry32(SEED ^ (mod(frame, durationInFrames) + 1));
    const offsetX = Math.floor(rand() * size);
    const offsetY = Math.floor(rand() * size);

    ctx.clearRect(0, 0, width, height);
    for (let x = -offsetX; x < width; x += size) {
      for (let y = -offsetY; y < height; y += size) {
        ctx.drawImage(tile, x, y);
      }
    }
  }, [frame, width, height, durationInFrames]);

  return (
    <AbsoluteFill style={{ mixBlendMode: "plus-lighter", opacity: 0.55 }}>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
