/**
 * Out-of-focus highlight fields, drawn with PixiJS.
 *
 * Defocused points of light are a screen-space phenomenon: their size comes
 * from the lens aperture, not from their distance, so they are built as 2D
 * sprites rather than as more 3D geometry. Each field is one flat layer that
 * the composition then blurs as a whole.
 *
 * Real bokeh is not a plain gaussian -- a defocused highlight has a brighter
 * rim where the aperture's edge concentrates light -- so the sprite texture
 * carries an optional rim term.
 */

import { Container, Sprite, Texture, type Application } from "pixi.js";
import { mulberry32 } from "../core/noise";
import type { PixiStage, PixiStageBuilder } from "./PixiLayer";

export type BokehSpec = {
  seed: number;
  count: number;
  /** Sprite diameter as a fraction of composition height. */
  sizeMin: number;
  sizeMax: number;
  colors: readonly string[];
  alphaMin: number;
  alphaMax: number;
  /** Drift per second, in fractions of the frame. */
  driftX: number;
  driftY: number;
  /** Higher values give a tighter core. */
  softness: number;
  /** 0 = plain falloff, 1 = pronounced aperture rim. */
  rim: number;
  twinkle: number;
  /** When set, every motion is periodic over this many frames. */
  loopFrames?: number;
  /** Seconds over which the field fades up at the start. */
  fadeInSeconds?: number;
};

/**
 * Built synchronously on purpose: the layer renders the frame it was asked
 * for as soon as `build()` returns, so a texture that resolved a tick later
 * would leave frame zero empty.
 */
const makeBokehTexture = (softness: number, rim: number): Texture => {
  const size = 128;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D context unavailable for bokeh sprite");
  }

  const image = ctx.createImageData(size, size);
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x + 0.5 - half) / half, (y + 0.5 - half) / half);
      let v = d >= 1 ? 0 : Math.pow(1 - d, softness);

      if (rim > 0 && d < 1) {
        // A soft band just inside the edge of the disc.
        const band = Math.exp(-Math.pow((d - 0.82) / 0.13, 2));
        v = Math.min(1, v + band * rim * 0.55);
      }

      const o = (y * size + x) * 4;
      image.data[o] = 255;
      image.data[o + 1] = 255;
      image.data[o + 2] = 255;
      image.data[o + 3] = Math.round(v * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
  return Texture.from(canvas);
};

const wrap01 = (v: number): number => {
  const w = v % 1;
  return w < 0 ? w + 1 : w;
};

export const createBokehStage = (spec: BokehSpec): PixiStageBuilder => {
  return (app: Application, width: number, height: number): PixiStage => {
    const rnd = mulberry32(spec.seed);

    const sprites: Sprite[] = [];
    const baseX = new Float32Array(spec.count);
    const baseY = new Float32Array(spec.count);
    const sizes = new Float32Array(spec.count);
    const alphas = new Float32Array(spec.count);
    const phases = new Float32Array(spec.count);
    const wobbleX = new Float32Array(spec.count);
    const wobbleY = new Float32Array(spec.count);

    for (let i = 0; i < spec.count; i++) {
      baseX[i] = rnd();
      baseY[i] = rnd();
      // Squaring biases towards the small end, so a few large orbs read as
      // genuinely nearer than the rest instead of the field looking uniform.
      sizes[i] = spec.sizeMin + Math.pow(rnd(), 2.1) * (spec.sizeMax - spec.sizeMin);
      alphas[i] = spec.alphaMin + rnd() * (spec.alphaMax - spec.alphaMin);
      phases[i] = rnd() * Math.PI * 2;
      wobbleX[i] = (rnd() - 0.5) * 0.035;
      wobbleY[i] = (rnd() - 0.5) * 0.035;
    }

    const colorFor = (i: number): number => {
      const pick = mulberry32(spec.seed + i * 2654435761)();
      const hex = spec.colors[Math.floor(pick * spec.colors.length)];
      return parseInt(hex.slice(1), 16);
    };

    const texture = makeBokehTexture(spec.softness, spec.rim);
    const container = new Container();

    for (let i = 0; i < spec.count; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = "add";
      sprite.tint = colorFor(i);
      container.addChild(sprite);
      sprites.push(sprite);
    }
    app.stage.addChild(container);

    return {
      update: (frame) => {
        const seconds = frame / 30;
        const loop = spec.loopFrames;
        const theta = loop ? (frame / loop) * Math.PI * 2 : 0;
        const fadeIn = spec.fadeInSeconds
          ? Math.min(1, seconds / spec.fadeInSeconds)
          : 1;

        for (let i = 0; i < sprites.length; i++) {
          const sprite = sprites[i];

          let fx: number;
          let fy: number;
          let twinkle: number;

          if (loop) {
            // Periodic motion only: sampling frame `loop` reproduces frame 0
            // exactly, so the clip repeats without a seam.
            fx = wrap01(
              baseX[i] + Math.sin(theta + phases[i]) * spec.driftX,
            );
            fy = wrap01(
              baseY[i] + Math.cos(theta + phases[i] * 1.7) * spec.driftY,
            );
            twinkle =
              1 - spec.twinkle * 0.5 * (1 + Math.sin(theta * 2 + phases[i]));
          } else {
            fx = wrap01(
              baseX[i] +
                spec.driftX * seconds +
                Math.sin(seconds * 0.31 + phases[i]) * wobbleX[i],
            );
            fy = wrap01(
              baseY[i] +
                spec.driftY * seconds +
                Math.cos(seconds * 0.27 + phases[i]) * wobbleY[i],
            );
            twinkle =
              1 -
              spec.twinkle *
                0.5 *
                (1 + Math.sin(seconds * 0.8 + phases[i] * 2.3));
          }

          // Placed across a margin wider than the frame so sprites drift in
          // and out rather than popping at the edges.
          sprite.x = (fx * 1.3 - 0.15) * width;
          sprite.y = (fy * 1.3 - 0.15) * height;

          const diameter = sizes[i] * height;
          sprite.width = diameter;
          sprite.height = diameter;
          sprite.alpha = alphas[i] * twinkle * fadeIn;
        }
      },
      dispose: () => {
        container.destroy({ children: true, texture: true });
      },
    };
  };
};
