import { Container, Graphics } from "pixi.js";
import { interpolate } from "remotion";
import { PixiStage, type SceneFactory } from "../PixiStage";
import { BLOCKS_PALETTE, hexToNumber } from "../constants";
import { createRng, range, rangeInt } from "../rng";

/**
 * Version 4 - "Blocks".
 *
 * A 3.6 second burst: the frame flashes from black to white, banded
 * orange/violet/black rectangles snap in around the edges and centre, then
 * everything clears back to black. Each block is built once as a Pixi
 * Container and animated by scaling it about its own base.
 */

type Band = { colour: number; fraction: number };

type Block = {
  x: number; // 0..1
  y: number; // 0..1, top edge
  width: number; // fraction of frame width
  height: number; // fraction of frame height
  bands: Band[];
  inAt: number; // seconds
  outAt: number;
  /** Blocks grow from the top or the bottom, alternating. */
  fromTop: boolean;
};

const BLOCK_COUNT = 22;

const buildBlocks = (): Block[] => {
  const rng = createRng(0xc0ffee42);
  const { orange, violet, ink } = BLOCKS_PALETTE;
  const colours = [hexToNumber(orange), hexToNumber(violet), hexToNumber(ink)];

  return Array.from({ length: BLOCK_COUNT }, (_, i) => {
    // Most blocks hug the edges; a few cluster near the middle like the
    // reference's central stack.
    const central = i % 5 === 0;
    const x = central ? range(rng, 0.3, 0.62) : range(rng, -0.05, 0.98);
    const y = central ? range(rng, 0.28, 0.62) : range(rng, -0.08, 0.86);

    // Each block is 2-3 stacked colour bands, orange-dominant.
    const bandCount = rangeInt(rng, 2, 3);
    const raw = Array.from({ length: bandCount }, () => range(rng, 0.15, 1));
    const total = raw.reduce((a, b) => a + b, 0);
    const bands = raw.map((value, index) => ({
      // Orange leads, then black, then violet - the reference's proportions.
      colour: index === 0 ? colours[0] : colours[rng() < 0.62 ? 2 : 1],
      fraction: value / total,
    }));

    const inAt = range(rng, 0.38, 2.35);
    return {
      x,
      y,
      width: range(rng, 0.035, 0.085),
      height: range(rng, 0.09, 0.3),
      bands,
      inAt,
      outAt: inAt + range(rng, 0.5, 1.5),
      fromTop: rng() < 0.5,
    };
  });
};

/** Snap-in with a small overshoot, then a fast snap-out. */
const popAt = (time: number, inAt: number, outAt: number) => {
  if (time < inAt) return 0;
  if (time < inAt + 0.22) {
    return interpolate(time, [inAt, inAt + 0.13, inAt + 0.22], [0, 1.12, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return interpolate(time, [outAt, outAt + 0.16], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

const createBlocksScene: SceneFactory = (app) => {
  const blocks = buildBlocks();
  const background = new Graphics();
  const layer = new Container();
  app.stage.addChild(background, layer);

  const bg = hexToNumber(BLOCKS_PALETTE.background);

  // Build each block's geometry once; only transforms change per frame.
  const nodes = blocks.map((block) => {
    const container = new Container();
    const g = new Graphics();
    container.addChild(g);
    layer.addChild(container);
    return { block, container, graphic: g, drawnAt: -1 };
  });

  return ({ time, width, height }) => {
    // Black -> white -> black. The opening and closing blacks are hard cuts.
    const lightness = interpolate(
      time,
      [0, 0.34, 0.42, 3.04, 3.16, 3.64],
      [0, 0, 1, 1, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    background.clear();
    background
      .rect(0, 0, width, height)
      .fill({ color: lightness > 0.5 ? bg : 0x000000 });

    for (const node of nodes) {
      const { block, container, graphic } = node;
      const pop = popAt(time, block.inAt, block.outAt);

      if (pop <= 0.001 || lightness < 0.5) {
        container.visible = false;
        continue;
      }
      container.visible = true;

      const w = block.width * width;
      const h = block.height * height;

      // Redraw only when the pixel size changes (i.e. once per resolution).
      if (node.drawnAt !== w) {
        graphic.clear();
        let offset = 0;
        for (const band of block.bands) {
          const bandHeight = band.fraction * h;
          graphic.rect(0, offset, w, bandHeight).fill({ color: band.colour });
          offset += bandHeight;
        }
        node.drawnAt = w;
      }

      container.x = block.x * width;
      container.y = block.y * height + (block.fromTop ? 0 : h);
      container.scale.set(1, block.fromTop ? pop : -pop);
    }
  };
};

export const ConfettiBlocks: React.FC = () => (
  <PixiStage createScene={createBlocksScene} backgroundColor="#000000" />
);
