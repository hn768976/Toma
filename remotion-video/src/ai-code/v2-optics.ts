import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { DURATION_IN_FRAMES } from "./constants";
import {
  createHazeTexture,
  createNoiseTexture,
  createRayTexture,
} from "./textures";
import { rand, randRange } from "./rng";
import type { PixiContext, PixiScene } from "./PixiLayer";

// V2's optical pass: the thin rays fanning out of a point above the
// frame centre, the blue wash across the top, and grain.

const RAY_COUNT = 14;

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
  topGlow.alpha = 0.55;
  stage.addChild(topGlow);

  const rayTexture = Texture.from(
    createRayTexture(Math.round(1024 * scale), Math.round(28 * scale)),
  );
  // A small bloom sits on the convergence point; without it the fan
  // reads as a hard vertex rather than a light source.
  const originGlow = new Sprite(
    Texture.from(
      createHazeTexture(
        Math.round(512 * scale),
        Math.round(512 * scale),
        "150, 200, 255",
      ),
    ),
  );
  originGlow.anchor.set(0.5);
  originGlow.blendMode = "add";
  originGlow.width = 420 * scale;
  originGlow.height = 420 * scale;
  originGlow.alpha = 0.16;
  stage.addChild(originGlow);

  const rays: Sprite[] = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    const ray = new Sprite(rayTexture);
    // Anchored at the hot end so rotation pivots on the origin point.
    ray.anchor.set(0, 0.5);
    ray.blendMode = "add";
    stage.addChild(ray);
    rays.push(ray);
  }

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
    const progress = f / DURATION_IN_FRAMES;
    const tau = progress * Math.PI * 2;

    const originX = width * (0.44 + 0.03 * Math.sin(tau));
    const originY = height * (0.3 + 0.04 * Math.cos(tau));

    rays.forEach((ray, i) => {
      const spread = randRange(i, 40, -0.95, 0.95);
      const angle = spread + Math.sin(tau + rand(i, 41) * 6.283) * 0.06;
      // Start each ray a little way out from the vertex so the fan has
      // no single hard convergence pixel.
      const inset = randRange(i, 48, 10, 90) * scale;
      ray.x = originX + Math.cos(angle) * inset;
      ray.y = originY + Math.sin(angle) * inset;
      ray.rotation = angle;
      ray.width = width * randRange(i, 42, 0.5, 1.2);
      ray.height = randRange(i, 43, 3, 11) * scale;
      // Each ray breathes on its own integer harmonic, so the fan
      // shimmers without any of it drifting off the loop.
      const harmonic = 1 + (i % 3);
      ray.alpha =
        randRange(i, 44, 0.05, 0.19) *
        (0.45 + 0.55 * Math.sin(tau * harmonic + rand(i, 45) * 6.283) ** 2);
    });

    originGlow.x = originX;
    originGlow.y = originY;
    originGlow.alpha = 0.12 + 0.07 * Math.sin(tau * 2) ** 2;

    topGlow.alpha = 0.45 + 0.14 * Math.sin(tau) ** 2;

    grain.tilePosition.set(
      Math.floor(rand(f, 46) * 256),
      Math.floor(rand(f, 47) * 256),
    );
  };

  return { stage, update };
};
