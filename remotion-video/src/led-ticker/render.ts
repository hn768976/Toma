// Per-frame draw. Pure function of the frame number: no rAF, no state, no
// clock. Called once per React render from a layout effect.

import {
  BANDS,
  BLOOM_ALPHA,
  BLOOM_BLUR,
  BREATHE_AMOUNT,
  BREATHE_PERIOD,
  BUCKET_FAR,
  BUCKET_MID,
  BUCKET_SHARP,
  DEFOCUS_BLUR,
  DURATION_IN_FRAMES,
  FAR_BLUR,
  GRAIN_ALPHA,
  HEIGHT,
  MID_BLUR,
  mod,
  PITCH,
  SUBSTRATE,
  TEXT_ROWS,
  WIDTH,
} from "./constants";
import {
  DEAD_LEDS,
  DEAD_RADIUS,
  getDarkPattern,
  getDeadSprite,
  getFocusMask,
  getGrain,
  getLitSprite,
  getRuleSprite,
  getVignette,
  makeCanvas,
  SPRITE_BOARD,
  SPRITE_HALF,
} from "./sprites";
import { getBandLeds } from "./strip";
import {
  BAND_H,
  bandTop,
  BOARD_TO_SCREEN,
  BOARD_W,
  BOARD_X0,
  BOARD_X1,
  TEXT_ROW_OFFSET,
} from "./transform";

export interface Buffers {
  /** One per depth-of-field bucket: sharp, mid, far. */
  buckets: HTMLCanvasElement[];
  scratch: HTMLCanvasElement;
}

export const createBuffers = (): Buffers => ({
  buckets: [
    makeCanvas(WIDTH, HEIGHT),
    makeCanvas(WIDTH, HEIGHT),
    makeCanvas(WIDTH, HEIGHT),
  ],
  scratch: makeCanvas(WIDTH, HEIGHT),
});

const M = BOARD_TO_SCREEN;

const setBoardTransform = (ctx: CanvasRenderingContext2D) =>
  ctx.setTransform(M.a, M.b, M.c, M.d, M.e, M.f);

const stamp = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
) =>
  ctx.drawImage(
    sprite,
    x - SPRITE_HALF,
    y - SPRITE_HALF,
    SPRITE_BOARD,
    SPRITE_BOARD,
  );

const drawBand = (
  ctx: CanvasRenderingContext2D,
  index: number,
  frame: number,
  breathe: number,
) => {
  const band = BANDS[index];
  const { cols, map } = getBandLeds(index);

  // One sequence of travel per loop: at frame 1200 the band has advanced
  // exactly cols * PITCH board px and is pixel-identical to frame 0.
  const travel = cols * PITCH;
  const offset = mod(-band.dir * frame * (travel / DURATION_IN_FRAMES), travel);
  // Scrolling is smooth, so the lattice phase drifts with it. Shifting the
  // band's unlit grid by the same phase keeps lit and unlit emitters on one
  // lattice; a uniform dot grid is periodic, so the shift itself is invisible.
  const phase = mod(offset, PITCH);

  const y0 = bandTop(index);
  const cFrom = Math.floor((BOARD_X0 - offset) / PITCH) - 1;
  const cTo = Math.ceil((BOARD_X1 - offset) / PITCH) + 1;

  setBoardTransform(ctx);

  // Unlit lattice across the whole band — the dark grid that proves the panel.
  ctx.save();
  ctx.translate(phase, y0);
  ctx.fillStyle = getDarkPattern(ctx);
  ctx.fillRect(BOARD_X0 - phase, 0, BOARD_W, BAND_H);
  ctx.restore();

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = breathe;

  // Separator rule: a single row of lit white emitters, so it reads dotted.
  const rule = getRuleSprite();
  const ruleY = y0 + PITCH / 2;
  for (let c = cFrom; c <= cTo; c++) {
    stamp(ctx, rule, offset + c * PITCH + PITCH / 2, ruleY);
  }

  // Content, tiled by wrapping the column index into the sampled sequence.
  const textY = y0 + TEXT_ROW_OFFSET * PITCH;
  for (let c = cFrom; c <= cTo; c++) {
    const s = mod(c, cols);
    const x = offset + c * PITCH + PITCH / 2;
    for (let r = 0; r < TEXT_ROWS; r++) {
      const state = map[r * cols + s];
      if (state !== 0) {
        stamp(ctx, getLitSprite(state), x, textY + r * PITCH + PITCH / 2);
      }
    }
  }

  // Dead and dim emitters, punched out of whatever this band drew.
  ctx.globalCompositeOperation = "destination-out";
  const dead = getDeadSprite();
  for (const d of DEAD_LEDS) {
    if (d.y < y0 || d.y >= y0 + BAND_H) {
      continue;
    }
    ctx.globalAlpha = d.dim;
    ctx.drawImage(
      dead,
      d.x - DEAD_RADIUS,
      d.y - DEAD_RADIUS,
      DEAD_RADIUS * 2,
      DEAD_RADIUS * 2,
    );
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};

/** Blurs the assembled frame into scratch, masks it, and lays it back down. */
const defocusPass = (
  ctx: CanvasRenderingContext2D,
  main: HTMLCanvasElement,
  scratch: HTMLCanvasElement,
) => {
  const s = scratch.getContext("2d") as CanvasRenderingContext2D;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = "copy";
  s.globalAlpha = 1;
  s.filter = `blur(${DEFOCUS_BLUR}px)`;
  s.drawImage(main, 0, 0);
  s.filter = "none";
  s.globalCompositeOperation = "destination-in";
  s.drawImage(getFocusMask(), 0, 0, WIDTH, HEIGHT);
  s.globalCompositeOperation = "source-over";

  ctx.drawImage(scratch, 0, 0);
};

export const drawFrame = (
  canvas: HTMLCanvasElement,
  buffers: Buffers,
  frame: number,
) => {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const loopFrame = mod(frame, DURATION_IN_FRAMES);

  // Very slow whole-board brightness breathe; period divides the loop.
  const breathe =
    1 + BREATHE_AMOUNT * Math.sin((2 * Math.PI * loopFrame) / BREATHE_PERIOD);

  for (const bucket of [BUCKET_SHARP, BUCKET_MID, BUCKET_FAR]) {
    const bctx = buffers.buckets[bucket].getContext(
      "2d",
    ) as CanvasRenderingContext2D;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = "source-over";
    bctx.filter = "none";
    bctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (let i = 0; i < BANDS.length; i++) {
      if (BANDS[i].bucket === bucket) {
        drawBand(bctx, i, loopFrame, breathe);
      }
    }
  }

  // Composite far -> mid -> sharp, blurring each buffer exactly once.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = SUBSTRATE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.filter = `blur(${FAR_BLUR}px)`;
  ctx.drawImage(buffers.buckets[BUCKET_FAR], 0, 0);
  ctx.filter = `blur(${MID_BLUR}px)`;
  ctx.drawImage(buffers.buckets[BUCKET_MID], 0, 0);
  ctx.filter = "none";
  ctx.drawImage(buffers.buckets[BUCKET_SHARP], 0, 0);

  // Focus falls off toward the lower-right and the frame edges, on top of the
  // per-band bucketing.
  defocusPass(ctx, canvas, buffers.scratch);

  // Global bloom — LED boards bloom heavily.
  const s = buffers.scratch.getContext("2d") as CanvasRenderingContext2D;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = "copy";
  s.globalAlpha = 1;
  s.filter = `blur(${BLOOM_BLUR}px)`;
  s.drawImage(canvas, 0, 0);
  s.filter = "none";
  s.globalCompositeOperation = "source-over";

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = BLOOM_ALPHA;
  ctx.drawImage(buffers.scratch, 0, 0);

  // Vignette.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = getVignette(ctx);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Fine grain, reseeded per loop frame.
  const grain = ctx.createPattern(
    getGrain(loopFrame),
    "repeat",
  ) as CanvasPattern;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
};
