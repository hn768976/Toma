import React, {useMemo} from "react";
import {random} from "remotion";
import {makeCanvas} from "./use-canvas";

/**
 * Fine monochrome grain over the whole frame.
 *
 * A small pool of noise tiles is generated once and cycled by frame index, then
 * repeated as a CSS background. Regenerating 4K of noise every frame would cost
 * more than the rest of the piece put together, and a repeated tile is
 * indistinguishable from full-frame noise at these alphas. Deterministic:
 * the tile shown at frame `f` depends only on `f`.
 */
export const FilmGrain: React.FC<{
  frame: number;
  /** Peak alpha of a grain pixel. */
  alpha?: number;
  tileSize?: number;
  variants?: number;
  seed?: string;
  /** CSS scale of one tile. >1 makes coarser grain. */
  scale?: number;
}> = ({frame, alpha = 0.04, tileSize = 128, variants = 8, seed = "grain", scale = 1}) => {
  const tiles = useMemo(() => {
    const out: string[] = [];
    for (let v = 0; v < variants; v++) {
      const {canvas, ctx} = makeCanvas(tileSize, tileSize);
      const img = ctx.createImageData(tileSize, tileSize);
      for (let i = 0; i < tileSize * tileSize; i++) {
        const n = random(`${seed}-${v}-${i}`);
        const level = n > 0.5 ? 255 : 0;
        img.data[i * 4] = level;
        img.data[i * 4 + 1] = level;
        img.data[i * 4 + 2] = level;
        img.data[i * 4 + 3] = Math.round(Math.abs(n - 0.5) * 2 * 255);
      }
      ctx.putImageData(img, 0, 0);
      out.push(canvas.toDataURL());
    }
    return out;
  }, [tileSize, variants, seed]);

  const tile = tiles[((frame % variants) + variants) % variants];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${tile})`,
        backgroundRepeat: "repeat",
        backgroundSize: `${tileSize * scale}px ${tileSize * scale}px`,
        opacity: alpha,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
