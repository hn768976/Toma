import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { mulberry32 } from "./random";

const TILE = 256;

let cachedTile: string | null = null;

/**
 * A seeded greyscale noise tile, built once per worker and cached. Generating
 * it in the browser rather than shipping a base64 blob keeps the source small;
 * the PRNG is seeded, so every worker produces the identical tile.
 */
const grainTile = () => {
  if (cachedTile) {
    return cachedTile;
  }
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }
  const image = context.createImageData(TILE, TILE);
  const rand = mulberry32(0x6_7a_11);
  for (let i = 0; i < TILE * TILE; i++) {
    // Four uniforms summed is close enough to gaussian. The tile sits just
    // *below* white and is composited with `multiply`, because an `overlay`
    // or `screen` blend has nothing to work with on a pure white field —
    // grain on white can only ever darken.
    const g = (rand() + rand() + rand() + rand() - 2) * 0.5;
    const value = Math.max(0, Math.min(255, Math.round(252 + g * 9)));
    image.data[i * 4] = value;
    image.data[i * 4 + 1] = value;
    image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  cachedTile = canvas.toDataURL("image/png");
  return cachedTile;
};

/**
 * Fine grain at about 1%. A flat white field does not band, but an absolutely
 * clean one looks digitally sterile, and a trace of grain also gives the
 * encoder something to hold on to in the empty top half of the frame.
 *
 * `opacity` scales the whole effect: at 1 the white sits around 252/255.
 *
 * The tile is offset by a seeded amount per frame so the grain moves; the
 * offset is a pure function of the frame index, never an accumulator.
 */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();
  const tile = useMemo(() => grainTile(), []);

  const rand = mulberry32(frame * 2654435761);
  const offsetX = Math.floor(rand() * TILE);
  const offsetY = Math.floor(rand() * TILE);

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${tile})`,
        backgroundRepeat: "repeat",
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        mixBlendMode: "multiply",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
