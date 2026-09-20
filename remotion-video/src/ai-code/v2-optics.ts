import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { DURATION_IN_FRAMES } from "./constants";
import { createHazeTexture, createNoiseTexture } from "./textures";
import { rand } from "./rng";
import type { PixiContext, PixiScene } from "./PixiLayer";

// V2's optical pass: the blue wash across the top, and grain. Nothing
// else — no rays, no streaks. On this plate the code is the visual.

export const createV2Optics = async ({
  width,
  height,
  scale,
}: PixiContext): Promise<PixiScene> => {
  const stage = new Container();

  const topGlow = new Sprite(
    Texture.from(
      createHazeTexture(
        Math.round(1400 * scale),
        Math.round(560 * scale),
        "84, 150, 245",
      ),
    ),
  );
  topGlow.anchor.set(0.5, 0.5);
  topGlow.blendMode = "add";
  topGlow.width = width * 1.5;
  topGlow.height = height * 0.75;
  topGlow.x = width * 0.5;
  topGlow.y = height * 0.02;
  stage.addChild(topGlow);

  const grain = new TilingSprite({
    texture: Texture.from(createNoiseTexture(Math.round(256 * scale), 5)),
    width,
    height,
  });
  grain.blendMode = "add";
  grain.alpha = 0.045;
  grain.tint = 0x88aacc;
  stage.addChild(grain);

  const update = (frame: number) => {
    const f = frame % DURATION_IN_FRAMES;
    const tau = (f / DURATION_IN_FRAMES) * Math.PI * 2;

    topGlow.alpha = 0.45 + 0.14 * Math.sin(tau) ** 2;
    topGlow.x = width * (0.5 + 0.02 * Math.sin(tau));

    grain.tilePosition.set(
      Math.floor(rand(f, 46) * 256),
      Math.floor(rand(f, 47) * 256),
    );
  };

  return { stage, update };
};
