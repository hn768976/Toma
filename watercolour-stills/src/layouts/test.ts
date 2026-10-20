import { concentrate } from "../engine/color";
import { bloom, drip, splatter, salt, swatch, drop } from "../engine/effects";
import { blob } from "../engine/shapes";
import type { Layout } from "./types";

export const test: Layout = {
  label: "Test",
  async paint({ painter, rng, noise, colors, W, H }) {
    const fx = { painter, rng, noise };
    const deep = concentrate(colors[0], 1.6);
    // wash + blooms + salt (left)
    await painter.wash(blob(rng, noise, W * 0.2, H * 0.35, 480, 380), deep, { opacity: 110, bleed: 0.12, texture: 0.4 });
    await drop(fx, W * 0.25, H * 0.4, 160, concentrate(colors[1], 1.3));
    await bloom(fx, W * 0.15, H * 0.3, 120, deep);
    await bloom(fx, W * 0.27, H * 0.5, 80, deep);
    await salt(fx, W * 0.22, H * 0.25, 140, 160, deep);
    // swatches (middle)
    await swatch(fx, W * 0.42, H * 0.2, 700, 150, 0.04, colors[1]);
    await swatch(fx, W * 0.42, H * 0.42, 650, 140, -0.03, concentrate(colors[2], 1.4));
    // splatter + drips (right / bottom)
    await splatter(fx, W * 0.8, H * 0.75, 90, 140, deep, { angle: -0.4 });
    await drip(fx, W * 0.3, H * 0.65, 420, 26, colors[2]);
    await drip(fx, W * 0.36, H * 0.62, 300, 18, colors[2]);
  },
};
