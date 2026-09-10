import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { buildGrainTiles } from "./cosmos";

/**
 * Film grain, mostly there to dither the nebula's dark gradients so H.264
 * does not band them. Six pre-rolled tiles cycle over the 900-frame loop
 * (900 / 6 is whole), so the grain closes the loop with everything else.
 */
const TILES = 6;
const TILE_SIZE = 512;

export const Grain: React.FC<{ amount?: number; seed?: number }> = ({
  amount = 0.5,
  seed = 4242,
}) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  // Grain is drawn at 1080p and stretched to fill: it is high-frequency noise,
  // so a 4K buffer buys nothing and costs real compositing time every frame.
  const width = Math.min(config.width, 1920);
  const height = Math.round((width / config.width) * config.height);
  const ref = React.useRef<HTMLCanvasElement>(null);

  const tiles = React.useMemo(
    () => buildGrainTiles(`grain-${seed}`, seed, TILE_SIZE, TILES, 18),
    [seed],
  );

  React.useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tile = tiles[frame % TILES];
    const pattern = ctx.createPattern(tile, "repeat");
    if (!pattern) return;
    ctx.clearRect(0, 0, width, height);
    // Shift by a whole number of tiles' worth of jitter each frame.
    const ox = ((frame * 137) % TILE_SIZE) - TILE_SIZE;
    const oy = ((frame * 89) % TILE_SIZE) - TILE_SIZE;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width + TILE_SIZE * 2, height + TILE_SIZE * 2);
    ctx.restore();
  }, [frame, width, height, tiles]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: "overlay",
        opacity: amount,
        pointerEvents: "none",
      }}
    />
  );
};
