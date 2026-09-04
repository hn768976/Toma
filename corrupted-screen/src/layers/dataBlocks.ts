import { chance, hash, rand, randInt, randPow, seedOf, signed } from "../lib/rand";
import { Theme, toneColor, withAlpha } from "../lib/theme";

/**
 * Layer 2: the corrupted data blocks. Horizontal bars of solid colour at
 * varying widths and heights, some solid, some dithered, clustered into bands.
 * These are the loudest element in the frame.
 */

const CLUSTER = seedOf("block/cluster");
const BLOCK = seedOf("block/def");
const CHURN = seedOf("block/churn");
const SWEEP = seedOf("block/sweep");
const SLAB = seedOf("block/slab");

const CLUSTER_COUNT = 13;
const BLOCK_COUNT = 560;
const SLAB_COUNT = 16;

export type Block = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0 solid, 1 dithered, 2 hollow outline. */
  kind: 0 | 1 | 2;
  tone: number;
  accent: number;
  alpha: number;
  /** How many frames one on/off state holds. Always divides 600. */
  hold: number;
  density: number;
  /** Only ever shows up during a burst. */
  burstOnly: boolean;
};

/** Big soft shapes that only ever appear as glow, like blown out screen areas. */
export type Slab = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  strength: number;
  hold: number;
};

const HOLDS = [2, 3, 4, 5, 6, 8, 10];

export const buildBlocks = (width: number, height: number): Block[] => {
  // Uneven clusters: some bands are packed, others almost empty, so black gaps
  // survive between them instead of the corruption filling the plane evenly.
  const clusters = Array.from({ length: CLUSTER_COUNT }, (_, c) => ({
    y: (((c + 0.5) / CLUSTER_COUNT) * 1.08 - 0.04 + rand(-0.025, 0.025, CLUSTER, c)) * height,
    spread: randPow(0.006, 0.038, 1.5, CLUSTER, c, 1) * height,
    x: rand(-0.1, 0.72, CLUSTER, c, 2) * width,
    xSpread: rand(0.18, 0.68, CLUSTER, c, 3) * width,
    weight: randPow(0.25, 1, 1.4, CLUSTER, c, 4),
  }));

  const blocks: Block[] = [];
  for (let i = 0; i < BLOCK_COUNT; i++) {
    const cluster = clusters[randInt(0, CLUSTER_COUNT, BLOCK, i)];
    const kindRoll = hash(BLOCK, i, 1);
    // Three shape families: long thin streaks, short fat chunks and slabs.
    // Without the chunks everything reads as scan streaks rather than data.
    const shape = hash(BLOCK, i, 20);
    const size =
      shape < 0.45
        ? { w: randPow(0.02, 0.22, 1.8, BLOCK, i, 5), h: randPow(0.0012, 0.006, 1.4, BLOCK, i, 6) }
        : shape < 0.8
          ? { w: randPow(0.008, 0.06, 1.3, BLOCK, i, 5), h: randPow(0.006, 0.03, 1.2, BLOCK, i, 6) }
          : { w: randPow(0.03, 0.13, 1.2, BLOCK, i, 5), h: randPow(0.012, 0.045, 1.2, BLOCK, i, 6) };

    blocks.push({
      id: i,
      x: cluster.x + signed(BLOCK, i, 3) * cluster.xSpread,
      y: cluster.y + signed(BLOCK, i, 4) * cluster.spread,
      width: size.w * width,
      height: size.h * height,
      kind: kindRoll < 0.58 ? 0 : kindRoll < 0.9 ? 1 : 2,
      tone: Math.pow(hash(BLOCK, i, 7), 0.6),
      accent: chance(0.05, BLOCK, i, 2) ? randInt(0, 4, BLOCK, i, 8) : -1,
      alpha: rand(0.82, 1, BLOCK, i, 9),
      hold: HOLDS[randInt(0, HOLDS.length, BLOCK, i, 10)],
      density: rand(0.24, 0.8, BLOCK, i, 11) * cluster.weight,
      burstOnly: chance(0.18, BLOCK, i, 12),
    });
  }

  return blocks;
};

export const buildSlabs = (width: number, height: number): Slab[] =>
  Array.from({ length: SLAB_COUNT }, (_, i) => ({
    id: i,
    x: rand(-0.12, 0.92, SLAB, i) * width,
    y: rand(-0.1, 0.9, SLAB, i, 1) * height,
    width: randPow(0.02, 0.14, 1.4, SLAB, i, 2) * width,
    height: randPow(0.04, 0.34, 1.2, SLAB, i, 3) * height,
    strength: rand(0.25, 0.9, SLAB, i, 4),
    hold: [5, 6, 8, 10, 12][randInt(0, 5, SLAB, i, 5)],
  }));

/** 4x4 checker used for the dithered blocks. Built once per canvas context. */
export const makeDitherPattern = (ctx: CanvasRenderingContext2D): CanvasPattern | null => {
  const tile = document.createElement("canvas");
  tile.width = 4;
  tile.height = 4;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  tctx.fillStyle = "#ffffff";
  tctx.fillRect(0, 0, 2, 2);
  tctx.fillRect(2, 2, 2, 2);
  return ctx.createPattern(tile, "repeat");
};

const blockColor = (theme: Theme, block: Block): string =>
  block.accent >= 0 ? theme.accents[block.accent] : toneColor(theme, block.tone);

export type Rect = { x: number; y: number; width: number; height: number };

export const drawBlocks = (
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  theme: Theme,
  frame: number,
  level: number,
  dither: CanvasPattern | null,
  planeWidth: number,
  planeHeight: number,
): Rect[] => {
  /** The hottest shapes of this frame, handed to the bloom pass. */
  const bloom: Rect[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const slot = Math.floor(frame / block.hold);
    const threshold = block.burstOnly ? level * 0.85 : block.density + level * 0.4;
    if (hash(CHURN, block.id, slot) > threshold) continue;

    // Every time a block reappears it lands slightly differently.
    const jx = signed(CHURN, block.id, slot, 1) * block.width * 0.22;
    const stretch = 1 + signed(CHURN, block.id, slot, 2) * 0.25 * level;
    const x = block.x + jx;
    const w = Math.max(2, block.width * stretch);
    const h = Math.max(2, block.height);
    const color = blockColor(theme, block);
    // Accents are stray fragments, not a second colourway - keep them quieter.
    const alpha = Math.min(1, block.alpha * (0.85 + level * 0.35) * (block.accent >= 0 ? 0.7 : 1));

    if (block.kind === 2) {
      ctx.strokeStyle = withAlpha(color, alpha * 0.8);
      ctx.lineWidth = Math.max(2, h * 0.16);
      ctx.strokeRect(x, block.y, w, h * 2.2);
    } else if (block.kind === 1 && dither) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, block.y, w, h);
      ctx.clip();
      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle = color;
      ctx.fillRect(x, block.y, w, h);
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = dither;
      ctx.fillRect(x, block.y, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = withAlpha(color, alpha);
      ctx.fillRect(x, block.y, w, h);
    }

    if (block.tone > 0.62 && block.accent < 0 && alpha > 0.65) {
      bloom.push({ x, y: block.y, width: w, height: h });
    }
  }

  // Wide sweeps: only during the loud frames, spanning most of the plane.
  const sweepSlot = Math.floor(frame / 2);
  for (let s = 0; s < 5; s++) {
    if (hash(SWEEP, s, sweepSlot) > level * 0.5) continue;
    const y = rand(0, 1, SWEEP, s, sweepSlot, 1) * planeHeight;
    const h = randPow(0.002, 0.02, 2, SWEEP, s, sweepSlot, 2) * planeHeight;
    const x = rand(-0.2, 0.1, SWEEP, s, sweepSlot, 4) * planeWidth;
    const w = planeWidth * rand(0.5, 1.3, SWEEP, s, sweepSlot, 5);
    ctx.fillStyle = withAlpha(theme.hot, rand(0.35, 0.8, SWEEP, s, sweepSlot, 3));
    ctx.fillRect(x, y, w, h);
  }

  return bloom;
};

/**
 * The soft blown out patches. They are painted only into the bloom buffer, so
 * they come back as glow rather than as shapes with edges.
 */
export const slabGlow = (slabs: Slab[], frame: number, level: number): Rect[] => {
  const out: Rect[] = [];
  for (const slab of slabs) {
    const slot = Math.floor(frame / slab.hold);
    if (hash(SLAB, slab.id, slot, 1) > slab.strength + level * 0.25) continue;
    out.push({ x: slab.x, y: slab.y, width: slab.width, height: slab.height });
  }
  return out;
};
