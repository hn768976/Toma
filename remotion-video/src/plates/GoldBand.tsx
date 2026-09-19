import React, { useMemo } from "react";
import { Container, Sprite } from "pixi.js";
import { z } from "zod";
import { PixiScene, type SceneSetup } from "./pixi/PixiScene";
import { createBloom, createGrade } from "./pixi/passes";
import { glowTexture, starTexture, streakTexture } from "./pixi/textures";
import { bell, makeBandWave } from "./pixi/band";
import { between, betweenBiased, loopWave, loopWave01, makeRandom } from "./pixi/rng";

// Plate 4 -- "Gold Band".
// A turbulent river of gold glitter tearing across pure black, with a hot
// molten core running down its middle. No cloud layer at all: the black has to
// stay black for the band to read as light.

const GOLD = [0xfffaf0, 0xffe6ae, 0xffc861, 0xf5a327, 0xd97e12];
const CORE = [0xfff0c8, 0xffbe52, 0xff8a1e];

const BAND_COUNT = 15000;
const HALO_COUNT = 1400;
const GLINT_COUNT = 130;
const CORE_SEGMENTS = 96;

const setup =
  (seed: number): SceneSetup =>
  ({ app, width, height, scale, durationInFrames }) => {
    const rnd = makeRandom(seed);
    const stage = app.stage;

    const glow = new Container();

    const sparkTex = glowTexture(16 * scale, 0.34, 2.3);
    const haloTex = glowTexture(48 * scale, 0.0, 1.9);
    const glintTex = starTexture(96 * scale, 1.0, 4);
    const coreTex = streakTexture(256, 48);

    // The spine: a few travelling harmonics, each closing a whole number of
    // cycles over the loop.
    const spine = makeBandWave([
      { freq: 0.9, amp: 0.5, cycles: 1, phase: 0.12 },
      { freq: 2.1, amp: 0.3, cycles: 2, phase: 0.55 },
      { freq: 4.3, amp: 0.14, cycles: 3, phase: 0.8 },
      { freq: 8.1, amp: 0.06, cycles: 5, phase: 0.27 },
    ]);
    const spineY = 0.5;
    const spineAmp = 0.05 * height;
    const spread = 0.115 * height;
    const wrapX = width + 80 * scale;

    const spineAt = (xn: number, u: number) =>
      spineY * height + spine.offsetAt(xn, u) * spineAmp;

    // --- ambient haze -------------------------------------------------------
    // A wide, very dim wash that follows the spine. Without it the band reads
    // as dots on black rather than a body of light.
    const hazeSegments: Sprite[] = [];
    const hazeLayer = new Container();
    const HAZE_SEGMENTS = 48;
    for (let i = 0; i < HAZE_SEGMENTS; i++) {
      const seg = new Sprite(haloTex);
      seg.anchor.set(0.5);
      seg.tint = 0xb8791e;
      seg.blendMode = "add";
      seg.width = (width / HAZE_SEGMENTS) * 4.5;
      seg.height = 0.34 * height;
      hazeLayer.addChild(seg);
      hazeSegments.push(seg);
    }
    glow.addChild(hazeLayer);

    // --- molten core --------------------------------------------------------
    // Overlapping streak segments laid along the spine; together they read as
    // one continuous glowing filament that bends with the band.
    const coreSegments: Sprite[] = [];
    const coreLayer = new Container();
    for (let i = 0; i < CORE_SEGMENTS; i++) {
      const seg = new Sprite(coreTex);
      seg.anchor.set(0.5);
      seg.tint = CORE[Math.floor(rnd() * CORE.length)];
      seg.blendMode = "add";
      seg.width = (width / CORE_SEGMENTS) * 2.6;
      seg.height = between(rnd, 4, 10) * scale;
      coreLayer.addChild(seg);
      coreSegments.push(seg);
    }
    glow.addChild(coreLayer);

    // --- band particles -----------------------------------------------------
    type Spark = {
      sprite: Sprite;
      x0: number;
      speed: number;
      off: number;
      /** Slow vertical creep away from the spine, so the band keeps shedding. */
      driftCycles: number;
      harmonic: number;
      phase: number;
      alpha: number;
      size: number;
    };
    const sparks: Spark[] = [];
    const bandLayer = new Container();
    for (let i = 0; i < BAND_COUNT; i++) {
      const sprite = new Sprite(sparkTex);
      sprite.anchor.set(0.5);
      sprite.tint = GOLD[Math.floor(rnd() * GOLD.length)];
      sprite.blendMode = "add";
      bandLayer.addChild(sprite);
      sparks.push({
        sprite,
        x0: rnd() * wrapX,
        speed: Math.round(between(rnd, 1, 4)),
        off: bell(rnd),
        driftCycles: Math.round(between(rnd, -2, 2)),
        harmonic: Math.round(between(rnd, 5, 20)),
        phase: rnd(),
        alpha: between(rnd, 0.35, 1.0),
        size: betweenBiased(rnd, 0.7, 3.4, 2.1) * scale,
      });
    }
    glow.addChild(bandLayer);

    // --- halo ---------------------------------------------------------------
    // Sparse, much softer motes thrown well clear of the band.
    type Halo = { sprite: Sprite; x0: number; speed: number; off: number; harmonic: number; phase: number; alpha: number };
    const halos: Halo[] = [];
    const haloLayer = new Container();
    for (let i = 0; i < HALO_COUNT; i++) {
      const sprite = new Sprite(haloTex);
      sprite.anchor.set(0.5);
      const r = betweenBiased(rnd, 1.5, 11, 2.2) * scale;
      sprite.width = r * 2;
      sprite.height = r * 2;
      sprite.tint = GOLD[Math.floor(rnd() * GOLD.length)];
      sprite.blendMode = "add";
      haloLayer.addChild(sprite);
      halos.push({
        sprite,
        x0: rnd() * wrapX,
        speed: Math.round(between(rnd, 1, 3)),
        off: bell(rnd) * 3.2,
        harmonic: Math.round(between(rnd, 2, 9)),
        phase: rnd(),
        alpha: between(rnd, 0.05, 0.45),
      });
    }
    glow.addChild(haloLayer);

    // --- glints -------------------------------------------------------------
    type Glint = { sprite: Sprite; x0: number; off: number; speed: number; harmonic: number; phase: number; peak: number; size: number };
    const glints: Glint[] = [];
    const glintLayer = new Container();
    for (let i = 0; i < GLINT_COUNT; i++) {
      const sprite = new Sprite(glintTex);
      sprite.anchor.set(0.5);
      sprite.tint = GOLD[Math.floor(rnd() * 3)];
      sprite.blendMode = "add";
      glintLayer.addChild(sprite);
      glints.push({
        sprite,
        x0: rnd() * wrapX,
        off: bell(rnd) * 0.9,
        speed: Math.round(between(rnd, 1, 4)),
        harmonic: Math.round(between(rnd, 6, 18)),
        phase: rnd(),
        peak: between(rnd, 0.35, 1.0),
        size: betweenBiased(rnd, 8, 38, 2.0) * scale,
      });
    }
    glow.addChild(glintLayer);

    stage.addChild(glow);

    const bloom = createBloom(app, glow, {
      width,
      height,
      resolution: 0.4,
      radius: 64 * scale,
      threshold: 0.14,
      softness: 0.28,
      strength: 1.15,
    });
    stage.addChild(bloom.view);

    const grade = createGrade(width, height, {
      grain: 0.012,
      dither: 1.0,
      saturation: 1.1,
      lift: 0,
    });
    stage.filters = [grade.filter];

    return {
      draw: (frame: number) => {
        const u = (frame % durationInFrames) / durationInFrames;

        for (let i = 0; i < HAZE_SEGMENTS; i++) {
          const seg = hazeSegments[i];
          const xn = (i + 0.5) / HAZE_SEGMENTS;
          seg.x = xn * width;
          seg.y = spineAt(xn, u);
          seg.alpha = 0.05 + 0.035 * loopWave01(u, 2, xn * 1.1);
        }

        for (let i = 0; i < CORE_SEGMENTS; i++) {
          const seg = coreSegments[i];
          const xn = (i + 0.5) / CORE_SEGMENTS;
          const x = xn * width;
          seg.x = x;
          seg.y = spineAt(xn, u);
          // Tilt each segment along the local slope so the filament looks
          // continuous rather than like a row of dashes.
          const slope = spineAt(xn + 0.01, u) - spineAt(xn - 0.01, u);
          seg.rotation = Math.atan2(slope, 0.02 * width);
          // Brightness travels along the core in slow pulses.
          const heat = loopWave01(u, 2, xn * 1.7) * loopWave01(u, 5, xn * 0.6 + 0.3);
          seg.alpha = 0.1 + 0.4 * heat;
        }

        for (const s of sparks) {
          const x = (s.x0 + u * s.speed * wrapX) % wrapX - 40 * scale;
          const xn = x / width;
          // The creep is a full sine over the loop, so it returns home.
          const off = s.off + 0.35 * loopWave(u, s.driftCycles === 0 ? 1 : s.driftCycles, s.phase);
          s.sprite.x = x;
          s.sprite.y = spineAt(xn, u) + off * spread;
          const core = Math.exp(-off * off * 2.2);
          const tw = loopWave01(u, s.harmonic, s.phase);
          s.sprite.alpha = s.alpha * (0.3 + 0.7 * tw) * (0.08 + 0.92 * core);
          const size = s.size * (0.7 + 0.6 * core);
          s.sprite.width = size * 2;
          s.sprite.height = size * 2;
        }

        for (const h of halos) {
          const x = (h.x0 + u * h.speed * wrapX) % wrapX - 40 * scale;
          h.sprite.x = x;
          h.sprite.y = spineAt(x / width, u) + h.off * spread;
          h.sprite.alpha = h.alpha * loopWave01(u, h.harmonic, h.phase) * 0.5;
        }

        for (const g of glints) {
          const x = (g.x0 + u * g.speed * wrapX) % wrapX - 40 * scale;
          g.sprite.x = x;
          g.sprite.y = spineAt(x / width, u) + g.off * spread;
          const pulse = Math.pow(loopWave01(u, g.harmonic, g.phase), 3.2);
          g.sprite.alpha = g.peak * pulse;
          const size = g.size * (0.5 + 0.8 * pulse);
          g.sprite.width = size * 2;
          g.sprite.height = size * 2;
        }

        bloom.update();
        grade.setFrame(frame % durationInFrames);
      },
      destroy: () => {
        bloom.destroy();
        sparkTex.destroy(true);
        haloTex.destroy(true);
        glintTex.destroy(true);
        coreTex.destroy(true);
      },
    };
  };

export const goldBandSchema = z.object({
  seed: z.number().int().min(0).max(999999),
});

export const goldBandDefaults: z.infer<typeof goldBandSchema> = { seed: 90312 };

export const GoldBand: React.FC<z.infer<typeof goldBandSchema>> = ({ seed }) => {
  const sceneSetup = useMemo(() => setup(seed), [seed]);
  return <PixiScene setup={sceneSetup} background="#000000" />;
};
