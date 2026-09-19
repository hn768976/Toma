import React, { useMemo } from "react";
import { Container, Sprite } from "pixi.js";
import { z } from "zod";
import { PixiScene, type SceneSetup } from "./pixi/PixiScene";
import { createBloom, createGrade, createNebulaLayer } from "./pixi/passes";
import { glowTexture, streakTexture } from "./pixi/textures";
import { between, betweenBiased, loopWave, loopWave01, makeRandom } from "./pixi/rng";

// Plate 2 -- "Cosmic Dust".
// A deep navy field of drifting star dust, lit from the lower left by a cold
// teal bloom and cut on the right by a single vertical shaft of cyan.

const DUST = [0xdff4ff, 0xa9dcf5, 0x7ec8ec, 0x6fd8cf, 0x4fa9e0];

const DUST_COUNT = 2400;
const EMBER_COUNT = 140;

const setup =
  (seed: number): SceneSetup =>
  ({ app, width, height, scale, durationInFrames }) => {
    const rnd = makeRandom(seed);
    const stage = app.stage;

    // --- cloud field --------------------------------------------------------
    const backdrop = createNebulaLayer(width, height, {
      colorSky: 0x01030c,
      colorDeep: 0x05162c,
      colorMid: 0x0b3455,
      colorHot: 0x156d94,
      // Slow enough that the clouds read as a still field that is breathing.
      drift: [0.55, -0.35],
      scale: 1.5,
      contrast: 2.1,
      gain: 0.95,
      bandCenter: 0.82,
      bandWidth: 0.46,
      bandTilt: -0.14,
      vignette: 0.75,
      detail: 0.22,
    });
    stage.addChild(backdrop.view);

    const glow = new Container();

    const softTex = glowTexture(256 * scale, 0.0, 1.6);
    const dustTex = glowTexture(16 * scale, 0.3, 2.4);
    const beamTex = streakTexture(512, 64);
    const emberTex = glowTexture(48 * scale, 0.0, 1.9);

    // --- the two key lights -------------------------------------------------
    // Teal pool on the left edge, roughly two thirds down frame.
    const tealPool = new Sprite(softTex);
    tealPool.anchor.set(0.5);
    tealPool.tint = 0x21c9b4;
    tealPool.blendMode = "add";
    tealPool.tint = 0x139e98;
    tealPool.x = -0.09 * width;
    tealPool.y = 0.76 * height;
    tealPool.width = 0.72 * width;
    tealPool.height = 0.9 * height;
    glow.addChild(tealPool);

    // Wider, dimmer blue wash filling the lower half.
    const blueWash = new Sprite(softTex);
    blueWash.anchor.set(0.5);
    blueWash.tint = 0x11447f;
    blueWash.blendMode = "add";
    blueWash.x = 0.42 * width;
    blueWash.y = 1.02 * height;
    blueWash.width = 2.0 * width;
    blueWash.height = 1.15 * height;
    glow.addChild(blueWash);

    // The vertical cyan shaft on the right. Three stacked passes -- a wide
    // haze, the shaft itself, then a tight white core -- so the edge stays
    // soft instead of reading as a drawn line.
    const beamHaze = new Sprite(softTex);
    beamHaze.anchor.set(0.5);
    beamHaze.tint = 0x1f86c8;
    beamHaze.blendMode = "add";
    beamHaze.x = 0.795 * width;
    beamHaze.y = 0.78 * height;
    beamHaze.width = 0.5 * width;
    beamHaze.height = 1.15 * height;
    glow.addChild(beamHaze);

    const beam = new Sprite(beamTex);
    beam.anchor.set(0.5);
    beam.rotation = Math.PI / 2;
    beam.tint = 0x36d7ff;
    beam.blendMode = "add";
    beam.x = 0.795 * width;
    beam.y = 0.74 * height;
    // Rotated, so width runs vertically and height runs horizontally.
    beam.width = 1.0 * height;
    beam.height = 0.075 * width;
    glow.addChild(beam);

    // A tight hot core inside the shaft keeps its centre reading as white.
    const beamCore = new Sprite(beamTex);
    beamCore.anchor.set(0.5);
    beamCore.rotation = Math.PI / 2;
    beamCore.tint = 0xd8f6ff;
    beamCore.blendMode = "add";
    beamCore.x = beam.x;
    beamCore.y = 0.8 * height;
    beamCore.width = 0.62 * height;
    beamCore.height = 0.014 * width;
    glow.addChild(beamCore);

    // --- star dust ----------------------------------------------------------
    type Dust = {
      sprite: Sprite;
      x0: number;
      y0: number;
      driftX: number;
      driftY: number;
      harmonic: number;
      phase: number;
      alpha: number;
      twinkle: number;
    };
    const dust: Dust[] = [];
    const dustLayer = new Container();
    const wrapX = width + 120 * scale;
    const wrapY = height + 120 * scale;

    for (let i = 0; i < DUST_COUNT; i++) {
      const sprite = new Sprite(dustTex);
      sprite.anchor.set(0.5);
      const r = betweenBiased(rnd, 0.5, 3.4, 2.4) * scale;
      sprite.width = r * 2;
      sprite.height = r * 2;
      sprite.tint = DUST[Math.floor(rnd() * DUST.length)];
      sprite.blendMode = "add";
      dustLayer.addChild(sprite);
      dust.push({
        sprite,
        x0: rnd() * wrapX,
        y0: rnd() * wrapY,
        // Whole-loop travel counts, so the field wraps without a jump.
        driftX: Math.round(between(rnd, -1, 2)),
        driftY: Math.round(between(rnd, -2, 1)),
        harmonic: Math.round(between(rnd, 3, 14)),
        phase: rnd(),
        alpha: between(rnd, 0.12, 0.9),
        twinkle: between(rnd, 0.25, 1.0),
      });
    }
    glow.addChild(dustLayer);

    // --- embers -------------------------------------------------------------
    // A handful of larger, softer motes that give the field some depth.
    type Ember = { sprite: Sprite; x0: number; y0: number; driftY: number; harmonic: number; phase: number; alpha: number };
    const embers: Ember[] = [];
    const emberLayer = new Container();
    for (let i = 0; i < EMBER_COUNT; i++) {
      const sprite = new Sprite(emberTex);
      sprite.anchor.set(0.5);
      const r = betweenBiased(rnd, 4, 26, 2.1) * scale;
      sprite.width = r * 2;
      sprite.height = r * 2;
      sprite.tint = DUST[Math.floor(rnd() * 4)];
      sprite.blendMode = "add";
      sprite.x = rnd() * width;
      emberLayer.addChild(sprite);
      embers.push({
        sprite,
        x0: rnd() * width,
        y0: rnd() * wrapY,
        driftY: Math.round(between(rnd, -2, 1)),
        harmonic: Math.round(between(rnd, 2, 6)),
        phase: rnd(),
        alpha: between(rnd, 0.06, 0.3),
      });
    }
    glow.addChild(emberLayer);

    stage.addChild(glow);

    const bloom = createBloom(app, glow, {
      width,
      height,
      resolution: 0.4,
      radius: 70 * scale,
      threshold: 0.2,
      softness: 0.35,
      strength: 0.55,
    });
    stage.addChild(bloom.view);

    const grade = createGrade(width, height, {
      grain: 0.011,
      // Deep blue ramps band badly in 8-bit H.264; this keeps them smooth.
      dither: 2.2,
      saturation: 1.08,
      lift: 0.003,
    });
    stage.filters = [grade.filter];

    return {
      draw: (frame: number) => {
        const u = (frame % durationInFrames) / durationInFrames;

        backdrop.setProgress(u);

        // Key lights breathe on long, offset cycles.
        tealPool.alpha = 0.34 + 0.1 * loopWave(u, 1, 0.0);
        blueWash.alpha = 0.22 + 0.07 * loopWave(u, 1, 0.37);
        beamHaze.alpha = 0.3 + 0.1 * loopWave(u, 1, 0.55);
        beam.alpha = 0.42 + 0.18 * loopWave(u, 2, 0.15);
        beamCore.alpha = 0.34 + 0.24 * loopWave(u, 3, 0.62);
        beam.x = (0.795 + 0.006 * loopWave(u, 1, 0.2)) * width;
        beamCore.x = beam.x;
        beamHaze.x = beam.x;

        for (const d of dust) {
          d.sprite.x = (d.x0 + u * d.driftX * wrapX + wrapX) % wrapX - 60 * scale;
          d.sprite.y = (d.y0 + u * d.driftY * wrapY + wrapY) % wrapY - 60 * scale;
          const tw = loopWave01(u, d.harmonic, d.phase);
          d.sprite.alpha = d.alpha * (1 - d.twinkle + d.twinkle * tw);
        }

        for (const e of embers) {
          e.sprite.x = e.x0;
          e.sprite.y = (e.y0 + u * e.driftY * wrapY + wrapY) % wrapY - 60 * scale;
          e.sprite.alpha = e.alpha * loopWave01(u, e.harmonic, e.phase);
        }

        bloom.update();
        grade.setFrame(frame % durationInFrames);
      },
      destroy: () => {
        bloom.destroy();
        softTex.destroy(true);
        dustTex.destroy(true);
        beamTex.destroy(true);
        emberTex.destroy(true);
      },
    };
  };

export const cosmicDustSchema = z.object({
  seed: z.number().int().min(0).max(999999),
});

export const cosmicDustDefaults: z.infer<typeof cosmicDustSchema> = { seed: 77431 };

export const CosmicDust: React.FC<z.infer<typeof cosmicDustSchema>> = ({ seed }) => {
  const sceneSetup = useMemo(() => setup(seed), [seed]);
  return <PixiScene setup={sceneSetup} background="#01030c" />;
};
