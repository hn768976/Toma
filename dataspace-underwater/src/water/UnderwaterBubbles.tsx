import { Container } from "pixi.js";
import React, { useCallback } from "react";
import { BubbleField, BubbleSpec } from "./bubbles";
import { WaterKit, WaterLook } from "./kit";
import { WATER_PALETTES, WaterPaletteKey } from "./palettes";
import { PixiHost, PixiSceneFactory } from "./PixiHost";
import { MarineSnow } from "./snow";

// Look 2 — Underwater Bubbles. Sun patch at the top centre, moderate rays.
export const BUBBLES_LOOK: WaterLook = {
  sun: [0.5, -0.02],
  sunR: 0.13,
  rayDensity: 2.0,
  rayReach: 1.0,
  rayGain: 0.6,
  surface: 0.14,
  lift: 1.0,
  flare: () => 0,
  grain: 0.02,
  raySrc: 0.75,
  rayFan: 1.6,
  sunCore: 1,
  liftReach: 1.6,
  rayLean: -0.05,
  rayStart: 0.08,
  raySharp: 0.8,
  sunEdge: 0.35,
  sunBreak: 0.25,
  columnGlow: [0.55, 0.16],
  rayFine: 0.4,
};

export const bubbleSpec = (aspect: number): BubbleSpec => ({
  seed: 0x5eed_b0b1,
  aspect,
  // 5 bursts per loop, every 120 frames, 500–900 bubbles each (seeded counts).
  bursts: [
    { frame: 0, count: 820, duration: 34, fizz: 3600, clumps: 34 },
    { frame: 120, count: 610, duration: 28, fizz: 3000, clumps: 26 },
    { frame: 240, count: 900, duration: 38, fizz: 3900, clumps: 38 },
    { frame: 360, count: 540, duration: 26, fizz: 2800, clumps: 24 },
    { frame: 480, count: 740, duration: 32, fizz: 3400, clumps: 30 },
  ],
  plumeV: 2.3,
  plumeTau: 120,
  fizzSizeMax: 2.2,
  trickle: 6,
  sourceX: 0.55,
  sourceJitter: 0.06,
  sizeMin: 0.5,
  sizeMax: 14,
  powerLaw: 1.6,
  burstSizeMin: 1.2,
  trickleSizeMax: 5,
  nearFraction: 0.3,
  farFraction: 0.2,
  waver: 42,
  brightness: 1,
  spreadScale: 30,
  diffusion: 1.2,
  y0: [15, 70],
});

export const UnderwaterBubbles: React.FC<{ palette: WaterPaletteKey }> = ({ palette }) => {
  const factory: PixiSceneFactory = useCallback(
    (app, pw, ph) => {
      const pal = WATER_PALETTES[palette];
      const kit = new WaterKit(app, pw, ph, pal, BUBBLES_LOOK);
      const bubbles = new BubbleField(kit, bubbleSpec(pw / ph), pal);
      const snow = new MarineSnow(kit, 0x5e0b, 300, 0.45, 0.1);
      const root = new Container();
      // Composite order: background → far bubbles → god rays → mid → near (blurred) → Snell glow.
      root.addChild(kit.bg, bubbles.layers[0], kit.rays, snow.container, bubbles.layers[1], bubbles.layers[2], kit.snell);
      return {
        render: (frame) => {
          kit.setFrame(frame);
          bubbles.update(frame);
          snow.update(frame);
          if (frame === 300) console.log(`[bubbles] records=${bubbles.count} alive@300=${bubbles.aliveLastFrame}`);
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
