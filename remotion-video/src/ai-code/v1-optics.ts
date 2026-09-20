import { Sprite, Texture, TilingSprite, Container } from "pixi.js";
import { DURATION_IN_FRAMES } from "./constants";
import { createHazeTexture, createNoiseTexture } from "./textures";
import { rand, randRange } from "./rng";
import type { PixiContext, PixiScene } from "./PixiLayer";

// The code plate's optical pass: a soft lens veil and fine grain,
// composited with `screen` over the three.js stage so everything here
// only ever adds light. Deliberately quiet.
//
// The tints are a parameter because the veil is broad enough to grade
// whatever is under it: a blue veil over green syntax pulls the whole
// plate to teal, which is exactly what V5 must not do.

const VEIL_COUNT = 4;

export type OpticsPalette = {
  /** Alternating tints across the veil blobs. */
  readonly veilTints: readonly [number, number];
  readonly grainTint: number;
};

export const BLUE_OPTICS: OpticsPalette = {
  veilTints: [0x4f9bd8, 0x2f6fa8],
  grainTint: 0x7fa8cc,
};

export const GREEN_OPTICS: OpticsPalette = {
  veilTints: [0x49b083, 0x2d7a62],
  grainTint: 0x8cc4a8,
};

export const createCodePlateOptics =
  (palette: OpticsPalette) =>
  async ({ width, height, scale }: PixiContext): Promise<PixiScene> => {
  const stage = new Container();

  const hazeTexture = Texture.from(
    createHazeTexture(Math.round(768 * scale), Math.round(768 * scale)),
  );
  const [tintA, tintB] = palette.veilTints;
  const noiseTexture = Texture.from(
    createNoiseTexture(Math.round(256 * scale), 3),
  );

  const veils: Sprite[] = [];
  for (let i = 0; i < VEIL_COUNT; i++) {
    const veil = new Sprite(hazeTexture);
    veil.anchor.set(0.5);
    veil.blendMode = "add";
    veil.scale.set(randRange(i, 90, 0.9, 2.1));
    veil.alpha = randRange(i, 91, 0.07, 0.17);
    veil.tint = i % 2 === 0 ? tintA : tintB;
    stage.addChild(veil);
    veils.push(veil);
  }

  const grain = new TilingSprite({
    texture: noiseTexture,
    width,
    height,
  });
  grain.blendMode = "add";
  grain.alpha = 0.05;
  grain.tint = palette.grainTint;
  stage.addChild(grain);

  const update = (frame: number) => {
    const f = frame % DURATION_IN_FRAMES;
    const progress = f / DURATION_IN_FRAMES;
    const tau = progress * Math.PI * 2;

    veils.forEach((veil, i) => {
      // Lissajous with integer frequencies: the veil returns to its
      // starting point exactly on the loop point.
      const fx = 1 + (i % 2);
      const fy = 1 + ((i + 1) % 3);
      const phase = rand(i, 94) * Math.PI * 2;
      veil.x = width * (0.5 + 0.34 * Math.sin(tau * fx + phase));
      veil.y = height * (0.5 + 0.3 * Math.cos(tau * fy + phase));
    });

    // Grain re-tiles every frame; a whole-texture step keeps it crawling
    // rather than sliding, and stays a pure function of the frame.
    grain.tilePosition.set(
      Math.floor(rand(f, 98) * 256),
      Math.floor(rand(f, 99) * 256),
    );
  };

  return { stage, update };
};
