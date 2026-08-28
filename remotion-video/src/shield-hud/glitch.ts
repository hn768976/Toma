import { random } from "remotion";
import { DURATION_IN_FRAMES, HEIGHT, WIDTH } from "./constants";
import type { Layer } from "./buffers";

export type Slice = { y: number; height: number; dx: number };

export type GlitchState = {
  active: boolean;
  slices: Slice[];
  /** Channel separation on the glyph, in frame pixels. */
  split: number;
};

type Event = { start: number; length: number };

/**
 * Tear events every 35-70 frames, two to four frames long, clustered
 * irregularly. Every event closes before frame 330, so frames 0 and 330 are
 * both clean and the loop still matches.
 */
export const buildGlitchSchedule = (seed: string): Event[] => {
  const events: Event[] = [];
  let at = 12 + Math.floor(random(`${seed}-first`) * 20);
  let i = 0;
  while (at < DURATION_IN_FRAMES - 8) {
    const length = 2 + Math.floor(random(`${seed}-len-${i}`) * 3);
    events.push({ start: at, length });
    at += 35 + Math.floor(random(`${seed}-gap-${i}`) * 36);
    i++;
  }
  return events;
};

export const glitchAt = (events: Event[], frame: number, seed: string): GlitchState => {
  const loopFrame = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const event = events.find((e) => loopFrame >= e.start && loopFrame < e.start + e.length);
  if (!event) return { active: false, slices: [], split: 0 };

  const key = `${seed}-${event.start}-${loopFrame}`;
  const count = 3 + Math.floor(random(`${key}-n`) * 3);
  const slices: Slice[] = [];
  for (let i = 0; i < count; i++) {
    const height = 26 + random(`${key}-h-${i}`) * 150;
    slices.push({
      y: random(`${key}-y-${i}`) * (HEIGHT - height),
      height,
      dx: (random(`${key}-d-${i}`) < 0.5 ? -1 : 1) * (40 + random(`${key}-x-${i}`) * 120),
    });
  }
  return { active: true, slices, split: 14 + random(`${key}-split`) * 12 };
};

/** Shifts horizontal bands of the finished frame sideways. */
export const applyTear = (
  ctx: CanvasRenderingContext2D,
  scratch: Layer,
  slices: Slice[],
) => {
  scratch.ctx.setTransform(1, 0, 0, 1, 0, 0);
  scratch.ctx.globalCompositeOperation = "source-over";
  scratch.ctx.globalAlpha = 1;
  scratch.ctx.filter = "none";
  scratch.ctx.clearRect(0, 0, WIDTH, HEIGHT);
  scratch.ctx.drawImage(ctx.canvas, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  for (const slice of slices) {
    ctx.drawImage(
      scratch.canvas,
      0,
      slice.y,
      WIDTH,
      slice.height,
      slice.dx,
      slice.y,
      WIDTH,
      slice.height,
    );
    // Fill the strip the shift left behind with the edge of the same band.
    const gapWidth = Math.abs(slice.dx);
    const sourceX = slice.dx > 0 ? 0 : WIDTH - gapWidth;
    const destX = slice.dx > 0 ? 0 : WIDTH - gapWidth;
    ctx.drawImage(
      scratch.canvas,
      sourceX,
      slice.y,
      gapWidth,
      slice.height,
      destX,
      slice.y,
      gapWidth,
      slice.height,
    );
  }
  ctx.restore();
};

/**
 * Composites the glyph buffer three times, one colour channel at a time,
 * with the red and blue copies pushed apart horizontally.
 */
export const compositeSplitGlyph = (
  ctx: CanvasRenderingContext2D,
  glyph: Layer,
  scratch: Layer,
  split: number,
  alpha: number,
) => {
  const channels: { colour: string; dx: number }[] = [
    { colour: "#FF0000", dx: split },
    { colour: "#00FF00", dx: 0 },
    { colour: "#0000FF", dx: -split },
  ];
  for (const channel of channels) {
    scratch.ctx.setTransform(1, 0, 0, 1, 0, 0);
    scratch.ctx.globalCompositeOperation = "source-over";
    scratch.ctx.globalAlpha = 1;
    scratch.ctx.filter = "none";
    scratch.ctx.clearRect(0, 0, WIDTH, HEIGHT);
    scratch.ctx.drawImage(glyph.canvas, 0, 0);
    scratch.ctx.globalCompositeOperation = "multiply";
    scratch.ctx.fillStyle = channel.colour;
    scratch.ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // The multiply fill is opaque everywhere, so the glyph's own alpha has
    // to be stamped back in to leave just the isolated channel.
    scratch.ctx.globalCompositeOperation = "destination-in";
    scratch.ctx.drawImage(glyph.canvas, 0, 0);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.filter = "none";
    ctx.drawImage(scratch.canvas, channel.dx, 0);
    ctx.restore();
  }
};
