// Blitting one glyph instance into a depth buffer.

import type { Instance } from "./field";
import type { Sprite } from "./sprites";

/** Weights of the three motion-blur samples; they sum to 1. */
const TRAIL = [0.62, 0.26, 0.12];
/** Below this much travel in a frame there is nothing to smear. */
const TRAIL_MIN = 3;
/** Above this, the glyph just recycled — that jump is not motion. */
const TRAIL_MAX = 260;

export const blitInstance = (
  ctx: CanvasRenderingContext2D,
  inst: Instance,
  sprite: Sprite,
  weight: number,
  motionBlur: boolean,
  frameW: number,
  frameH: number,
) => {
  const a = inst.alpha * weight;
  if (a <= 0.003) return;

  const s = sprite;
  const scale = sprite.baseScale * inst.sizeScale;
  const w = s.w * scale;
  const h = s.h * scale;

  // Cull only glyphs that are entirely off-frame. A near glyph whose centre
  // has left the frame must still be drawn, so it crops at the edge rather
  // than vanishing.
  if (inst.x + w / 2 < -40 || inst.x - w / 2 > frameW + 40) return;
  if (inst.y + h / 2 < -40 || inst.y - h / 2 > frameH + 40) return;
  const lo = Math.min(1, Math.floor(inst.tone));
  const mix = inst.tone - lo;

  const drawAt = (cx: number, cy: number, alpha: number) => {
    const x = cx - w / 2;
    const yy = cy - h / 2;
    ctx.globalAlpha = alpha * (1 - mix);
    ctx.drawImage(s.tones[lo], x, yy, w, h);
    if (mix > 0.002) {
      ctx.globalAlpha = alpha * mix;
      ctx.drawImage(s.tones[lo + 1], x, yy, w, h);
    }
  };

  const dx = inst.x - inst.px;
  const dy = inst.y - inst.py;
  const travel = Math.hypot(dx, dy);

  if (motionBlur && travel > TRAIL_MIN && travel < TRAIL_MAX) {
    // Three samples along the motion vector, spanning one frame of travel:
    // at 30fps the nearest, fastest glyphs strobe badly without this.
    for (let k = 0; k < TRAIL.length; k++) {
      drawAt(inst.x - (dx * k) / TRAIL.length, inst.y - (dy * k) / TRAIL.length, a * TRAIL[k]);
    }
  } else {
    drawAt(inst.x, inst.y, a);
  }

  if (inst.flare > 0.002) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a * inst.flare * 0.7;
    ctx.drawImage(s.tones[2], inst.x - w / 2, inst.y - h / 2, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.globalAlpha = 1;
};
