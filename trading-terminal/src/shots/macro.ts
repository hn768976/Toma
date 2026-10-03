import { DURATION } from "../engine/data";
import { easeInOutSine, lerp } from "../engine/random";
import { drawMacroPanels } from "../draw/macro";
import { drawScreenBase } from "./background";
import { ShotDef } from "./types";

// Shot 3 – Indicators macro: extreme close-up sliding sideways along the
// lower indicator panels, very shallow focus through the oscillator.
const W = 7300;
const PANELS_W = 6200;
const H = 2900;

const e = (f: number) => easeInOutSine(f / (DURATION - 1));
const look = (f: number): [number, number] => [lerp(4820, 5060, e(f)), lerp(990, 1010, e(f))];

export const macro: ShotDef = {
  W,
  H,
  camera: (f) => ({
    rx: 4,
    ry: -18,
    rz: 0,
    look: look(f),
    zLook: lerp(1450, 1560, e(f)),
    perspective: 4000,
  }),
  // Sharp band through the value-tag column (the nearest part of the screen).
  focus: (f) => [lerp(5550, 5650, e(f)), 850],
  dof: { k: 0.045, max: 80 },
  crop: [3200, 50, 6400, 1950],
  oversample: 2.0,
  bloom: { wide: 0.9, tight: 0.3 },
  vignette: 0.6,
  draw: (p, v, s, clock) => {
    drawScreenBase(p, W, H, W * 0.6, H * 0.5);
    if (!p.glow) {
      // Violet cast toward the top of the panel stack.
      const g = p.ctx.createLinearGradient(0, 0, 0, H * 0.55);
      g.addColorStop(0, "rgba(84, 52, 168, 0.42)");
      g.addColorStop(1, "rgba(78, 52, 150, 0)");
      p.ctx.fillStyle = g;
      p.ctx.fillRect(0, 0, W, H);
    }
    drawMacroPanels(p, v, s, clock, PANELS_W, H);
  },
};
