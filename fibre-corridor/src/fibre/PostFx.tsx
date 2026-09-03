import React, { useLayoutEffect, useMemo } from "react";
import { random } from "remotion";
import { HEIGHT, LOOP, WIDTH } from "./constants";
import { parseHex, rgba } from "./color";
import { makeBuffer } from "./draw";
import type { Scene } from "./scene";

const BLOOM_DOWN = 4;
const BW = WIDTH / BLOOM_DOWN;
const BH = HEIGHT / BLOOM_DOWN;
const WIDE_DOWN = 16;
const WW = WIDTH / WIDE_DOWN;
const WH = HEIGHT / WIDE_DOWN;

const GRAIN_TILE = 512;
/** LOOP is divisible by this, so the grain sequence closes with the loop. */
const GRAIN_TILES = 15;
const GRAIN_ALPHA = 0.04;
const VIGNETTE = 0.22;

const makeGrainTiles = (name: string) => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const c = makeBuffer(GRAIN_TILE, GRAIN_TILE);
    const ctx = c.getContext("2d");
    if (!ctx) continue;
    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const data = img.data;
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      const v = 128 + (random(`${name}-grain-${t}-${i}`) - 0.5) * 235;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

/**
 * The finish: generous bloom on the cores, packets and horizon glow, a 22%
 * vignette and fine grain seeded on frame % 375 so it closes with the loop.
 */
export const PostFx: React.FC<{ scene: Scene }> = ({ scene }) => {
  const bloomA = useMemo(() => makeBuffer(BW, BH), []);
  const bloomB = useMemo(() => makeBuffer(BW, BH), []);
  const wide = useMemo(() => makeBuffer(WW, WH), []);
  const grain = useMemo(
    () => makeGrainTiles(scene.variant.name),
    [scene.variant.name],
  );

  useLayoutEffect(() => {
    const { main: ctx, variant, frame } = scene;
    const canvas = ctx.canvas;
    const a = bloomA.getContext("2d");
    const b = bloomB.getContext("2d");
    const w = wide.getContext("2d");
    if (!a || !b || !w) return;

    // --- bloom: bright-pass by squaring, then two blur levels added back ---
    for (const c of [a, b, w]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      c.filter = "none";
    }
    a.clearRect(0, 0, BW, BH);
    a.imageSmoothingQuality = "high";
    a.drawImage(canvas, 0, 0, BW, BH);

    b.clearRect(0, 0, BW, BH);
    b.drawImage(bloomA, 0, 0);
    b.globalCompositeOperation = "multiply";
    b.drawImage(bloomA, 0, 0);
    b.globalCompositeOperation = "source-over";

    w.clearRect(0, 0, WW, WH);
    w.imageSmoothingQuality = "high";
    w.drawImage(bloomB, 0, 0, WW, WH);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.globalAlpha = 0.42;
    ctx.filter = "blur(5px)";
    ctx.drawImage(bloomB, 0, 0, WIDTH, HEIGHT);

    ctx.globalAlpha = 0.34;
    ctx.filter = "blur(4px)";
    ctx.drawImage(wide, 0, 0, WIDTH, HEIGHT);

    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // --- vignette ---
    const deep = parseHex(variant.palette.bgDeep);
    const g = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.3,
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH * 0.72,
    );
    g.addColorStop(0, rgba(deep, 0));
    g.addColorStop(0.6, rgba(deep, VIGNETTE * 0.4));
    g.addColorStop(1, rgba(deep, VIGNETTE));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // --- grain, seeded on the loop-local frame ---
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const tile = grain[f % grain.length];
    if (tile) {
      const ox = Math.floor(random(`${variant.name}-gx-${f}`) * GRAIN_TILE);
      const oy = Math.floor(random(`${variant.name}-gy-${f}`) * GRAIN_TILE);
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = GRAIN_ALPHA;
      ctx.imageSmoothingEnabled = false;
      for (let x = -ox; x < WIDTH; x += GRAIN_TILE) {
        for (let y = -oy; y < HEIGHT; y += GRAIN_TILE) {
          ctx.drawImage(tile, x, y);
        }
      }
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  });

  return null;
};
