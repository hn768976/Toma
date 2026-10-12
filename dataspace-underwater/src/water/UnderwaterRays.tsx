import { Container } from "pixi.js";
import React, { useCallback } from "react";
import { BubbleField, BubbleSpec } from "./bubbles";
import { WaterKit, WaterLook } from "./kit";
import { WATER_PALETTES, WaterPaletteKey } from "./palettes";
import { PixiHost, PixiSceneFactory } from "./PixiHost";
import { MarineSnow } from "./snow";

// Look 3 — Underwater Rays. The kit at full strength: ~30 broad rays, sun patch
// top centre slightly left, flaring briefly twice per loop.
export const RAYS_LOOK: WaterLook = {
  sun: [0.49, -0.04],
  sunR: 0.1,
  rayDensity: 0.85,
  rayReach: 0.85,
  rayGain: 1.4,
  surface: 0.1,
  lift: 1.2,
  // Two brief flares per loop (cos(2θ) peaks at θ=0.9 and 0.9+π).
  flare: (th) => Math.pow(0.5 + 0.5 * Math.cos(2 * th - 1.8), 16),
  grain: 0.02,
  raySrc: 0.55,
  rayFan: 1.3,
  sunCore: 0.12,
  liftReach: 0.85,
  rayLean: 0,
  rayStart: 0.3,
  raySharp: 0.6,
  sunEdge: 0.9,
  sunBreak: 1,
  columnGlow: [0.5, 0],
  rayFine: 1.0,
};

// A few groups of 5–12 tiny bubbles on a seeded schedule (6 groups → every 100 frames).
export const raysBubbleSpec = (aspect: number): BubbleSpec => ({
  seed: 0x7a75_0b0b,
  aspect,
  bursts: [
    { frame: 40, count: 7, duration: 14, spreadMul: 0.2, srcX: 0.22 },
    { frame: 140, count: 11, duration: 18, spreadMul: 0.2, srcX: 0.71 },
    { frame: 240, count: 5, duration: 10, spreadMul: 0.2, srcX: 0.38 },
    { frame: 340, count: 9, duration: 16, spreadMul: 0.2, srcX: 0.86 },
    { frame: 440, count: 12, duration: 20, spreadMul: 0.2, srcX: 0.13 },
    { frame: 540, count: 6, duration: 12, spreadMul: 0.2, srcX: 0.6 },
  ],
  plumeV: 0,
  plumeTau: 60,
  fizzSizeMax: 1,
  trickle: 0,
  sourceX: 0.5,
  sourceJitter: 0,
  sizeMin: 1.6,
  sizeMax: 4.2,
  powerLaw: 1.5,
  trickleSizeMax: 2,
  nearFraction: 0,
  farFraction: 0,
  waver: 8,
  brightness: 1.3,
  spreadScale: 40,
  diffusion: 1.5,
  y0: [10, 40],
});

export const UnderwaterRays: React.FC<{ palette: WaterPaletteKey }> = ({ palette }) => {
  const factory: PixiSceneFactory = useCallback(
    (app, pw, ph) => {
      const pal = WATER_PALETTES[palette];
      const kit = new WaterKit(app, pw, ph, pal, RAYS_LOOK);
      const bubbles = new BubbleField(kit, raysBubbleSpec(pw / ph), pal);
      const snow = new MarineSnow(kit, 0x5e0c, 300, 1.3, 0.02);
      const root = new Container();
      root.addChild(kit.bg, bubbles.layers[0], kit.rays, snow.container, bubbles.layers[1], kit.snell);
      return {
        render: (frame) => {
          kit.setFrame(frame);
          bubbles.update(frame);
          snow.update(frame);
          kit.draw(root);
        },
        destroy: () => {
          root.destroy({ children: true });
          kit.destroy();
        },
      };
    },
    [palette],
  );
  return <PixiHost factory={factory} />;
};
