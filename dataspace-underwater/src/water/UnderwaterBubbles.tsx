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
  sunR: 0.2,
  rayDensity: 2.0,
  rayReach: 1.0,
  rayGain: 0.45,
  surface: 0.6,
  lift: 1.0,
  flare: () => 0,
  grain: 0.02,
};

export const bubbleSpec = (aspect: number): BubbleSpec => ({
  seed: 0x5eed_b0b1,
  aspect,
  // 5 bursts per loop, every 120 frames, 500–900 bubbles each (seeded counts).
  bursts: [
    { frame: 0, count: 820, duration: 34, fizz: 2100 },
    { frame: 120, count: 610, duration: 28, fizz: 1800 },
    { frame: 240, count: 900, duration: 38, fizz: 2300 },
    { frame: 360, count: 540, duration: 26, fizz: 1700 },
    { frame: 480, count: 740, duration: 32, fizz: 2000 },
  ],
  plumeV: 2.3,
  plumeTau: 120,
  fizzSizeMax: 1.6,
  trickle: 6,
  sourceX: 0.55,
  sourceJitter: 0.06,
  sizeMin: 0.5,
  sizeMax: 14,
  powerLaw: 1.9,
  burstSizeMin: 1.2,
  trickleSizeMax: 5,
  nearFraction: 0.3,
  farFraction: 0.2,
  waver: 26,
  brightness: 1,
  spreadScale: 62,
  y0: [15, 70],
});

export const UnderwaterBubbles: React.FC<{ palette: WaterPaletteKey }> = ({ palette }) => {
  const factory: PixiSceneFactory = useCallback(
    (app, pw, ph) => {
      const pal = WATER_PALETTES[palette];
      const kit = new WaterKit(app, pw, ph, pal, BUBBLES_LOOK);
      const bubbles = new BubbleField(kit, bubbleSpec(pw / ph), pal);
      const snow = new MarineSnow(kit, 0x5e0b, 300, 0.8);
      const root = new Container();
      // Composite order: background → far bubbles → god rays → mid → near (blurred) → Snell glow.
      root.addChild(kit.bg, bubbles.layers[0], kit.rays, snow.container, bubbles.layers[1], bubbles.layers[2], kit.snell);
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
