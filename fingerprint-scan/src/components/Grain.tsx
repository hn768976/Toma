/**
 * Fine grain at ~4% alpha. Noise tiles are generated once; each frame picks a
 * seeded tile and offset per cell, so the grain moves without any pixel being
 * regenerated.
 */
import React, { useEffect, useRef } from "react";
import { random } from "remotion";
import { H, W } from "../layout";
import { useGrainTiles } from "../lib/post";

const TILE = 512;
const ALPHA = 0.04;

export const Grain: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const tiles = useGrainTiles(TILE, 6);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = ALPHA;
    const cols = Math.ceil(W / TILE);
    const rows = Math.ceil(H / TILE);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = `${frame}-${r}-${c}`;
        const tile = tiles[Math.floor(random(`gt-${k}`) * tiles.length) % tiles.length];
        const ox = Math.floor(random(`gx-${k}`) * TILE);
        const oy = Math.floor(random(`gy-${k}`) * TILE);
        ctx.save();
        ctx.beginPath();
        ctx.rect(c * TILE, r * TILE, TILE, TILE);
        ctx.clip();
        ctx.drawImage(tile, c * TILE - ox, r * TILE - oy);
        ctx.drawImage(tile, c * TILE - ox + TILE, r * TILE - oy);
        ctx.drawImage(tile, c * TILE - ox, r * TILE - oy + TILE);
        ctx.drawImage(tile, c * TILE - ox + TILE, r * TILE - oy + TILE);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  });

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: W,
        height: H,
        mixBlendMode: "overlay",
      }}
    />
  );
};
