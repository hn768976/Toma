import React, { useLayoutEffect, useMemo, useRef } from "react";
import { random } from "remotion";
import { createOffscreen } from "../geo";
import { HEIGHT, WIDTH } from "../layout";

const TILE = 128;
const TILE_COUNT = 3;

/**
 * A handful of seeded noise tiles built once. Generating 8 megapixels of
 * grain per frame is not affordable at 4K; three tiles cycled and offset are
 * indistinguishable at 3% alpha.
 */
const buildGrainTiles = (): HTMLCanvasElement[] =>
  Array.from({ length: TILE_COUNT }, (_, t) => {
    const canvas = createOffscreen(TILE, TILE);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const image = ctx.createImageData(TILE, TILE);
    for (let p = 0; p < TILE * TILE; p++) {
      const value = 96 + random(`grain-${t}-${p}`) * 64;
      image.data[p * 4] = value;
      image.data[p * 4 + 1] = value;
      image.data[p * 4 + 2] = value;
      image.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  });

/** Vignette and fine grain over the finished composition. */
export const FilmFinish: React.FC<{ frame: number }> = ({ frame }) => {
  const tiles = useMemo(buildGrainTiles, []);
  const grainRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = grainRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const pattern = ctx.createPattern(tiles[frame % TILE_COUNT], "repeat");
    if (!pattern) return;
    ctx.save();
    ctx.translate(-(frame * 37) % TILE, -(frame * 53) % TILE);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, WIDTH + TILE, HEIGHT + TILE);
    ctx.restore();
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.2) 100%)",
        }}
      />
      <canvas
        ref={grainRef}
        width={WIDTH}
        height={HEIGHT}
        style={{
          position: "absolute",
          inset: 0,
          width: WIDTH,
          height: HEIGHT,
          mixBlendMode: "overlay",
          opacity: 0.03,
        }}
      />
    </>
  );
};
