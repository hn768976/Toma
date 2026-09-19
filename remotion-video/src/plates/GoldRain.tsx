import React, { useMemo } from "react";
import { Container, Sprite } from "pixi.js";
import { z } from "zod";
import { PixiScene, type SceneSetup } from "./pixi/PixiScene";
import { createBloom, createGrade, createNebulaLayer } from "./pixi/passes";
import { glowTexture, starTexture, verticalFadeTexture } from "./pixi/textures";
import { between, betweenBiased, loopWave01, makeRandom } from "./pixi/rng";

// Plate 1 -- "Gold Rain".
// Vertical dotted strands of gold falling through a warm, almost-black haze,
// with bokeh and diffraction glints riding on top.

const GOLD = [0xfff4d2, 0xffd98a, 0xffc24d, 0xf0a02a, 0xd9821f];
const ACCENT = [0xe8643c, 0xff8b3d];

/** Every strand scrolls by a whole number of pattern heights per loop. */
const STRAND_COUNT = 190;
const BOKEH_COUNT = 170;
const GLINT_COUNT = 80;

const setup =
  (seed: number): SceneSetup =>
  ({ app, width, height, scale, durationInFrames }) => {
    const rnd = makeRandom(seed);

    const stage = app.stage;

    // --- backdrop -----------------------------------------------------------
    // Faint warm mottling rather than a flat gradient, so the dark areas still
    // have something happening in them.
    const backdrop = createNebulaLayer(width, height, {
      colorSky: 0x070502,
      colorDeep: 0x1b1206,
      colorMid: 0x2e1d08,
      colorHot: 0x3d2708,
      drift: [0.28, -0.75],
      scale: 1.8,
      contrast: 1.5,
      gain: 0.92,
      bandCenter: 0.02,
      bandWidth: 0.72,
      bandTilt: 0.0,
      vignette: 0.7,
      detail: 0.2,
    });
    stage.addChild(backdrop.view);

    // --- glowing content ----------------------------------------------------
    // Everything in here is additive and feeds the bloom pass.
    const glow = new Container();

    const dotTex = glowTexture(32 * scale, 0.22, 2.0);
    const bokehTex = glowTexture(64 * scale, 0.0, 1.7);
    const glintTex = starTexture(96 * scale, 1.0, 4);

    // Strands: a column of dots that scrolls down by whole pattern heights.
    type Strand = { node: Container; period: number; travel: number };
    const strands: Strand[] = [];
    const strandLayer = new Container();

    for (let i = 0; i < STRAND_COUNT; i++) {
      const node = new Container();
      node.x = Math.round(between(rnd, -0.02, 1.02) * width);

      // Pattern height in design pixels; the strand repeats every `period`.
      const period = Math.round(between(rnd, 150, 320) * scale);
      const spacing = between(rnd, 9, 19) * scale;
      const dotCount = Math.ceil((height + period * 2) / spacing);

      // Strands towards the back are dimmer, thinner and slower.
      const depth = rnd(); // 0 = far, 1 = near
      const baseAlpha = 0.18 + depth * 0.62;
      const baseSize = (0.9 + depth * 2.2) * scale;
      const tint = GOLD[Math.floor(rnd() * GOLD.length)];

      for (let d = 0; d < dotCount; d++) {
        if (rnd() < 0.2) continue; // gaps turn the line into a dashed trail
        const dot = new Sprite(dotTex);
        dot.anchor.set(0.5);
        dot.x = between(rnd, -0.6, 0.6) * scale;
        dot.y = d * spacing + between(rnd, -0.25, 0.25) * spacing;
        const s = baseSize * between(rnd, 0.6, 1.7);
        dot.width = s * 2;
        dot.height = s * 2;
        dot.alpha = baseAlpha * between(rnd, 0.45, 1.0);
        dot.tint = rnd() < 0.045 ? ACCENT[Math.floor(rnd() * ACCENT.length)] : tint;
        dot.blendMode = "add";
        node.addChild(dot);
      }

      node.y = -period;
      strandLayer.addChild(node);
      strands.push({
        node,
        period,
        // Whole number of periods per loop keeps the scroll seamless.
        travel: Math.round(between(rnd, 5, 14)),
      });
    }
    glow.addChild(strandLayer);

    // Bokeh: soft out-of-focus circles drifting down through the strands.
    type Bokeh = { sprite: Sprite; wrap: number; travel: number; y0: number; harmonic: number; phase: number; alpha: number };
    const bokehs: Bokeh[] = [];
    const bokehLayer = new Container();
    for (let i = 0; i < BOKEH_COUNT; i++) {
      const sprite = new Sprite(bokehTex);
      sprite.anchor.set(0.5);
      const r = betweenBiased(rnd, 2.5, 20, 2.0) * scale;
      sprite.width = r * 2;
      sprite.height = r * 2;
      sprite.x = between(rnd, 0, 1) * width;
      sprite.tint = rnd() < 0.08 ? ACCENT[Math.floor(rnd() * ACCENT.length)] : GOLD[Math.floor(rnd() * GOLD.length)];
      sprite.blendMode = "add";
      bokehLayer.addChild(sprite);
      const wrap = height + 200 * scale;
      bokehs.push({
        sprite,
        wrap,
        travel: Math.round(between(rnd, 1, 4)),
        y0: rnd() * wrap,
        harmonic: Math.round(between(rnd, 2, 7)),
        phase: rnd(),
        alpha: between(rnd, 0.1, 0.55),
      });
    }
    glow.addChild(bokehLayer);

    // Glints: four-point flares that bloom in and out on their own cycle.
    type Glint = { sprite: Sprite; size: number; harmonic: number; phase: number; peak: number; wrap: number; travel: number; y0: number };
    const glints: Glint[] = [];
    const glintLayer = new Container();
    for (let i = 0; i < GLINT_COUNT; i++) {
      const sprite = new Sprite(glintTex);
      sprite.anchor.set(0.5);
      sprite.x = between(rnd, 0, 1) * width;
      sprite.tint = GOLD[1 + Math.floor(rnd() * 3)];
      sprite.blendMode = "add";
      glintLayer.addChild(sprite);
      const wrap = height + 200 * scale;
      glints.push({
        sprite,
        size: betweenBiased(rnd, 8, 34, 2.0) * scale,
        harmonic: Math.round(between(rnd, 4, 13)),
        phase: rnd(),
        peak: between(rnd, 0.35, 1.0),
        wrap,
        travel: Math.round(between(rnd, 1, 3)),
        y0: rnd() * wrap,
      });
    }
    glow.addChild(glintLayer);

    stage.addChild(glow);

    const bloom = createBloom(app, glow, {
      width,
      height,
      resolution: 0.4,
      radius: 46 * scale,
      threshold: 0.16,
      softness: 0.3,
      strength: 0.85,
    });
    stage.addChild(bloom.view);

    // The reference lets the rain dissolve into black before it lands.
    const fadeTex = verticalFadeTexture([
      { at: 0.0, alpha: 0 },
      { at: 0.42, alpha: 0 },
      { at: 0.72, alpha: 0.45 },
      { at: 1.0, alpha: 0.88 },
    ]);
    const fade = new Sprite(fadeTex);
    fade.width = width;
    fade.height = height;
    stage.addChild(fade);

    const grade = createGrade(width, height, {
      grain: 0.014,
      dither: 1.2,
      saturation: 1.06,
      lift: 0.004,
    });
    stage.filters = [grade.filter];

    return {
      draw: (frame: number) => {
        const u = (frame % durationInFrames) / durationInFrames;

        backdrop.setProgress(u);

        for (const s of strands) {
          // Scroll a whole number of pattern heights, then wrap.
          s.node.y = -s.period + ((u * s.travel * s.period) % s.period);
        }

        for (const b of bokehs) {
          const y = (b.y0 + u * b.travel * b.wrap) % b.wrap;
          b.sprite.y = y - 100 * scale;
          // Fade the bokeh out as it reaches the dark bottom of frame.
          const depthFade = 1 - Math.pow(Math.max(y / b.wrap - 0.25, 0) / 0.75, 1.6);
          b.sprite.alpha = b.alpha * loopWave01(u, b.harmonic, b.phase) * Math.max(depthFade, 0);
        }

        for (const g of glints) {
          const y = (g.y0 + u * g.travel * g.wrap) % g.wrap;
          g.sprite.y = y - 100 * scale;
          const pulse = Math.pow(loopWave01(u, g.harmonic, g.phase), 3.2);
          const depthFade = 1 - Math.pow(Math.max(y / g.wrap - 0.2, 0) / 0.8, 1.5);
          g.sprite.alpha = g.peak * pulse * Math.max(depthFade, 0);
          const s = g.size * (0.55 + 0.75 * pulse);
          g.sprite.width = s * 2;
          g.sprite.height = s * 2;
        }

        bloom.update();
        grade.setFrame(frame % durationInFrames);
      },
      destroy: () => {
        bloom.destroy();
        dotTex.destroy(true);
        bokehTex.destroy(true);
        glintTex.destroy(true);
        fadeTex.destroy(true);
      },
    };
  };

export const goldRainSchema = z.object({
  seed: z.number().int().min(0).max(999999),
});

export const goldRainDefaults: z.infer<typeof goldRainSchema> = { seed: 20250 };

export const GoldRain: React.FC<z.infer<typeof goldRainSchema>> = ({ seed }) => {
  const sceneSetup = useMemo(() => setup(seed), [seed]);
  return <PixiScene setup={sceneSetup} background="#050301" />;
};
