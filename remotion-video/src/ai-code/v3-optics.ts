import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { DURATION_IN_FRAMES } from "./constants";
import {
  createDotTexture,
  createHazeTexture,
  createNoiseTexture,
} from "./textures";
import { rand, randRange } from "./rng";
import type { PixiContext, PixiScene } from "./PixiLayer";

// V3's optical pass: a teal atmospheric wash, a scatter of out-of-focus
// bokeh close to the lens, and grain. Deliberately restrained — this
// plate is meant to sit behind text.

const HAZE_COUNT = 3;
const BOKEH_COUNT = 16;

export const createV3Optics = async ({
  width,
  height,
  scale,
}: PixiContext): Promise<PixiScene> => {
  const stage = new Container();

  const hazeTexture = Texture.from(
    createHazeTexture(
      Math.round(900 * scale),
      Math.round(900 * scale),
      "58, 150, 150",
    ),
  );
  const hazes: Sprite[] = [];
  for (let i = 0; i < HAZE_COUNT; i++) {
    const haze = new Sprite(hazeTexture);
    haze.anchor.set(0.5);
    haze.blendMode = "add";
    haze.width = width * randRange(i, 50, 0.7, 1.3);
    haze.height = height * randRange(i, 51, 0.8, 1.4);
    haze.alpha = randRange(i, 52, 0.08, 0.16);
    stage.addChild(haze);
    hazes.push(haze);
  }

  const bokehTexture = Texture.from(
    createDotTexture(Math.round(256 * scale), "140, 235, 220"),
  );
  const bokeh: Sprite[] = [];
  for (let i = 0; i < BOKEH_COUNT; i++) {
    const dot = new Sprite(bokehTexture);
    dot.anchor.set(0.5);
    dot.blendMode = "add";
    const size = randRange(i, 53, 24, 130) * scale;
    dot.width = size;
    dot.height = size;
    stage.addChild(dot);
    bokeh.push(dot);
  }

  const grain = new TilingSprite({
    texture: Texture.from(createNoiseTexture(Math.round(256 * scale), 9)),
    width,
    height,
  });
  grain.blendMode = "add";
  grain.alpha = 0.04;
  grain.tint = 0x6f9c98;
  stage.addChild(grain);

  const update = (frame: number) => {
    const f = frame % DURATION_IN_FRAMES;
    const progress = f / DURATION_IN_FRAMES;
    const tau = progress * Math.PI * 2;

    hazes.forEach((haze, i) => {
      const phase = rand(i, 54) * Math.PI * 2;
      haze.x = width * (0.5 + 0.28 * Math.sin(tau + phase));
      haze.y = height * (0.5 + 0.24 * Math.cos(tau * (1 + (i % 2)) + phase));
    });

    bokeh.forEach((dot, i) => {
      const phase = rand(i, 55);
      // A slow horizontal crawl, one full traverse per loop.
      const t = (progress * (i % 2 === 0 ? 1 : -1) + phase + 1) % 1;
      dot.x = (t * 1.3 - 0.15) * width;
      dot.y =
        height *
        (randRange(i, 56, 0.1, 0.9) +
          0.05 * Math.sin(tau * (1 + (i % 3)) + phase * 6.283));
      dot.alpha =
        randRange(i, 57, 0.05, 0.16) * (0.4 + 0.6 * Math.sin(Math.PI * t) ** 2);
    });

    grain.tilePosition.set(
      Math.floor(rand(f, 58) * 256),
      Math.floor(rand(f, 59) * 256),
    );
  };

  return { stage, update };
};
