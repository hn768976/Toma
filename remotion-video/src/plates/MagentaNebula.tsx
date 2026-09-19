import React, { useMemo } from "react";
import { Container, Graphics, Sprite } from "pixi.js";
import { z } from "zod";
import { PixiScene, type SceneSetup } from "./pixi/PixiScene";
import { createBloom, createGrade, createNebulaLayer } from "./pixi/passes";
import { glowTexture, starTexture } from "./pixi/textures";
import { bell, makeBandWave } from "./pixi/band";
import { between, betweenBiased, loopWave, loopWave01, makeRandom } from "./pixi/rng";

// Plate 3 -- "Magenta Nebula".
// Hot pink cloud banks on the left falling away into violet on the right, with
// a river of glitter running through the middle of frame.

const SPARK = [0xffffff, 0xffd9f2, 0xff8fd2, 0xf45bb0, 0xc46bff];
const CLOUD_BOKEH = [0xff5fae, 0xd04bd8, 0x8a5cff, 0xff9ad2];

const RIVER_COUNT = 5200;
const DUST_COUNT = 1800;
const BOKEH_COUNT = 150;
const GLINT_COUNT = 60;

const setup =
  (seed: number): SceneSetup =>
  ({ app, width, height, scale, durationInFrames }) => {
    const rnd = makeRandom(seed);
    const stage = app.stage;

    // --- magenta cloud bank -------------------------------------------------
    const magenta = createNebulaLayer(width, height, {
      colorSky: 0x0a0316,
      colorDeep: 0x4e0a3e,
      colorMid: 0xd4176f,
      colorHot: 0xff86c6,
      drift: [1.9, 0.22],
      scale: 2.7,
      contrast: 1.0,
      gain: 1.75,
      bandCenter: 0.52,
      bandWidth: 0.62,
      bandTilt: -0.18,
      vignette: 0.4,
      detail: 0.3,
      // Hot pink owns the left of frame and thins out towards the right.
      sideStart: 0.2,
      sideEnd: 1.25,
    });
    stage.addChild(magenta.view);

    // --- violet counter-layer ----------------------------------------------
    // Added on top so the right-hand side cools off into blue-violet instead of
    // staying pink all the way across.
    const violet = createNebulaLayer(width, height, {
      colorSky: 0x000000,
      colorDeep: 0x0a0628,
      colorMid: 0x2a1a72,
      colorHot: 0x6b4de0,
      drift: [1.2, -0.4],
      scale: 2.4,
      contrast: 1.55,
      gain: 1.35,
      bandCenter: 0.34,
      bandWidth: 0.6,
      bandTilt: 0.3,
      vignette: 0.25,
      detail: 0.4,
      // Mirror image of the magenta ramp: cool violet only on the right.
      sideStart: 1.0,
      sideEnd: 0.05,
    });
    violet.view.blendMode = "add";
    violet.view.alpha = 0.62;
    stage.addChild(violet.view);

    // --- colour masses ------------------------------------------------------
    // The cloud shader supplies texture, but the reference plate is carried by
    // two big blocks of colour. Painting them explicitly means the hero pink is
    // always where it should be instead of wherever the noise happens to land.
    // They sit outside the glow container so they do not drive the bloom.
    const poolTex = glowTexture(256 * scale, 0.0, 1.7);

    const pinkPool = new Sprite(poolTex);
    pinkPool.anchor.set(0.5);
    pinkPool.tint = 0xe01a78;
    pinkPool.blendMode = "add";
    pinkPool.x = 0.1 * width;
    pinkPool.y = 0.5 * height;
    pinkPool.width = 1.15 * width;
    pinkPool.height = 1.5 * height;
    stage.addChild(pinkPool);

    const pinkPoolLow = new Sprite(poolTex);
    pinkPoolLow.anchor.set(0.5);
    pinkPoolLow.tint = 0xc01070;
    pinkPoolLow.blendMode = "add";
    pinkPoolLow.x = 0.42 * width;
    pinkPoolLow.y = 1.0 * height;
    pinkPoolLow.width = 1.5 * width;
    pinkPoolLow.height = 1.0 * height;
    stage.addChild(pinkPoolLow);

    const violetPool = new Sprite(poolTex);
    violetPool.anchor.set(0.5);
    violetPool.tint = 0x4a2fb0;
    violetPool.blendMode = "add";
    violetPool.x = 0.95 * width;
    violetPool.y = 0.3 * height;
    violetPool.width = 1.1 * width;
    violetPool.height = 1.3 * height;
    stage.addChild(violetPool);

    const glow = new Container();

    const sparkTex = glowTexture(16 * scale, 0.32, 2.4);
    const bokehTex = glowTexture(128 * scale, 0.0, 1.7);
    const glintTex = starTexture(96 * scale, 1.1, 4);

    // --- the glitter river --------------------------------------------------
    // A travelling wave defines the spine; particles are scattered around it
    // with a bell falloff and flow along it, wrapping at the right edge.
    const spine = makeBandWave([
      { freq: 0.7, amp: 0.55, cycles: 1, phase: 0.0 },
      { freq: 1.6, amp: 0.26, cycles: 2, phase: 0.31 },
      { freq: 3.3, amp: 0.12, cycles: 3, phase: 0.67 },
    ]);
    const spineY = 0.55;
    const spineAmp = 0.085 * height;
    const spread = 0.115 * height;

    type Spark = {
      sprite: Sprite;
      x0: number;
      speed: number;
      off: number;
      harmonic: number;
      phase: number;
      alpha: number;
      size: number;
    };
    const sparks: Spark[] = [];
    const riverLayer = new Container();
    const wrapX = width + 80 * scale;

    for (let i = 0; i < RIVER_COUNT; i++) {
      const sprite = new Sprite(sparkTex);
      sprite.anchor.set(0.5);
      sprite.tint = SPARK[Math.floor(rnd() * SPARK.length)];
      sprite.blendMode = "add";
      riverLayer.addChild(sprite);
      const off = bell(rnd);
      sparks.push({
        sprite,
        x0: rnd() * wrapX,
        // Whole loops across frame; faster particles sit nearer the spine.
        speed: Math.round(between(rnd, 1, 3)),
        off,
        harmonic: Math.round(between(rnd, 4, 16)),
        phase: rnd(),
        alpha: between(rnd, 0.25, 1.0),
        size: betweenBiased(rnd, 0.6, 3.6, 2.2) * scale,
      });
    }
    glow.addChild(riverLayer);

    // --- cloud speckle ------------------------------------------------------
    // Fine dust spread over the whole frame, not just the river, so the cloud
    // banks read as glittering rather than as smooth gradients.
    type Dust = { sprite: Sprite; x0: number; y: number; speed: number; harmonic: number; phase: number; alpha: number };
    const dust: Dust[] = [];
    const dustLayer = new Container();
    for (let i = 0; i < DUST_COUNT; i++) {
      const sprite = new Sprite(sparkTex);
      sprite.anchor.set(0.5);
      const r = betweenBiased(rnd, 0.5, 2.4, 2.4) * scale;
      sprite.width = r * 2;
      sprite.height = r * 2;
      sprite.tint = SPARK[Math.floor(rnd() * SPARK.length)];
      sprite.blendMode = "add";
      dustLayer.addChild(sprite);
      dust.push({
        sprite,
        x0: rnd() * wrapX,
        y: between(rnd, -0.02, 1.02) * height,
        speed: Math.round(between(rnd, 1, 3)),
        harmonic: Math.round(between(rnd, 3, 13)),
        phase: rnd(),
        alpha: between(rnd, 0.1, 0.6),
      });
    }
    glow.addChild(dustLayer);

    // --- cloud bokeh --------------------------------------------------------
    type Bokeh = { sprite: Sprite; x0: number; y: number; speed: number; harmonic: number; phase: number; alpha: number };
    const bokehs: Bokeh[] = [];
    const bokehLayer = new Container();
    for (let i = 0; i < BOKEH_COUNT; i++) {
      const sprite = new Sprite(bokehTex);
      sprite.anchor.set(0.5);
      const r = betweenBiased(rnd, 8, 70, 2.0) * scale;
      sprite.width = r * 2;
      sprite.height = r * 2;
      sprite.tint = CLOUD_BOKEH[Math.floor(rnd() * CLOUD_BOKEH.length)];
      sprite.blendMode = "add";
      bokehLayer.addChild(sprite);
      bokehs.push({
        sprite,
        x0: rnd() * wrapX,
        y: between(rnd, -0.05, 1.05) * height,
        speed: Math.round(between(rnd, 1, 2)),
        harmonic: Math.round(between(rnd, 1, 5)),
        phase: rnd(),
        alpha: between(rnd, 0.05, 0.3),
      });
    }
    glow.addChild(bokehLayer);

    // --- glints -------------------------------------------------------------
    type Glint = { sprite: Sprite; x0: number; off: number; speed: number; harmonic: number; phase: number; peak: number; size: number };
    const glints: Glint[] = [];
    const glintLayer = new Container();
    for (let i = 0; i < GLINT_COUNT; i++) {
      const sprite = new Sprite(glintTex);
      sprite.anchor.set(0.5);
      sprite.tint = SPARK[Math.floor(rnd() * 3)];
      sprite.blendMode = "add";
      glintLayer.addChild(sprite);
      glints.push({
        sprite,
        x0: rnd() * wrapX,
        off: bell(rnd) * 0.7,
        speed: Math.round(between(rnd, 1, 3)),
        harmonic: Math.round(between(rnd, 5, 15)),
        phase: rnd(),
        peak: between(rnd, 0.3, 0.95),
        size: betweenBiased(rnd, 9, 40, 1.9) * scale,
      });
    }
    glow.addChild(glintLayer);

    // A faint lens ring, the kind of optical artefact the reference plate has
    // sitting just left of centre.
    const ring = new Graphics();
    ring.circle(0, 0, 88 * scale).stroke({ width: 1.6 * scale, color: 0xb886ff, alpha: 1 });
    ring.blendMode = "add";
    ring.x = 0.33 * width;
    ring.y = 0.26 * height;
    glow.addChild(ring);

    stage.addChild(glow);

    const bloom = createBloom(app, glow, {
      width,
      height,
      resolution: 0.4,
      radius: 58 * scale,
      threshold: 0.18,
      softness: 0.3,
      strength: 0.8,
    });
    stage.addChild(bloom.view);

    const grade = createGrade(width, height, {
      grain: 0.013,
      dither: 1.4,
      saturation: 1.12,
      lift: 0.004,
    });
    stage.filters = [grade.filter];

    /** World-space y of the spine at a given normalised x. */
    const spineAt = (xn: number, u: number) =>
      spineY * height + spine.offsetAt(xn, u) * spineAmp;

    return {
      draw: (frame: number) => {
        const u = (frame % durationInFrames) / durationInFrames;

        magenta.setProgress(u);
        violet.setProgress(u);

        // The colour masses breathe on long, offset cycles so the frame never
        // settles into a still image.
        pinkPool.alpha = 0.46 + 0.1 * loopWave(u, 1, 0.0);
        pinkPool.x = (0.1 + 0.03 * loopWave(u, 1, 0.25)) * width;
        pinkPoolLow.alpha = 0.3 + 0.09 * loopWave(u, 1, 0.41);
        violetPool.alpha = 0.34 + 0.08 * loopWave(u, 1, 0.66);

        for (const s of sparks) {
          const x = (s.x0 + u * s.speed * wrapX) % wrapX - 40 * scale;
          const xn = x / width;
          s.sprite.x = x;
          s.sprite.y = spineAt(xn, u) + s.off * spread;
          // Particles close to the spine are the bright ones.
          const core = Math.exp(-s.off * s.off * 3.2);
          const tw = loopWave01(u, s.harmonic, s.phase);
          s.sprite.alpha = s.alpha * (0.3 + 0.7 * tw) * (0.25 + 0.75 * core);
          const size = s.size * (0.75 + 0.5 * core);
          s.sprite.width = size * 2;
          s.sprite.height = size * 2;
        }

        for (const d of dust) {
          d.sprite.x = (d.x0 + u * d.speed * wrapX) % wrapX - 40 * scale;
          d.sprite.y = d.y;
          d.sprite.alpha = d.alpha * loopWave01(u, d.harmonic, d.phase);
        }

        for (const b of bokehs) {
          b.sprite.x = (b.x0 + u * b.speed * wrapX) % wrapX - 40 * scale;
          b.sprite.y = b.y;
          b.sprite.alpha = b.alpha * loopWave01(u, b.harmonic, b.phase);
        }

        for (const g of glints) {
          const x = (g.x0 + u * g.speed * wrapX) % wrapX - 40 * scale;
          g.sprite.x = x;
          g.sprite.y = spineAt(x / width, u) + g.off * spread;
          const pulse = Math.pow(loopWave01(u, g.harmonic, g.phase), 3.0);
          g.sprite.alpha = g.peak * pulse;
          const size = g.size * (0.5 + 0.8 * pulse);
          g.sprite.width = size * 2;
          g.sprite.height = size * 2;
        }

        ring.alpha = 0.035 + 0.02 * loopWave(u, 1, 0.1);
        ring.scale.set(1 + 0.05 * loopWave(u, 1, 0.4));

        bloom.update();
        grade.setFrame(frame % durationInFrames);
      },
      destroy: () => {
        bloom.destroy();
        poolTex.destroy(true);
        sparkTex.destroy(true);
        bokehTex.destroy(true);
        glintTex.destroy(true);
      },
    };
  };

export const magentaNebulaSchema = z.object({
  seed: z.number().int().min(0).max(999999),
});

export const magentaNebulaDefaults: z.infer<typeof magentaNebulaSchema> = { seed: 51207 };

export const MagentaNebula: React.FC<z.infer<typeof magentaNebulaSchema>> = ({ seed }) => {
  const sceneSetup = useMemo(() => setup(seed), [seed]);
  return <PixiScene setup={sceneSetup} background="#0a0316" />;
};
