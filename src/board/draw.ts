import { random } from 'remotion';
import type { Buffers, Plane } from './buffers';
import { GRAIN_TILE_SIZE } from './buffers';
import {
  BAND_ALPHA,
  BAND_H,
  BAND_PASSES,
  BLOOM_ALPHA,
  BLOOM_BLUR,
  BREATHE_AMP,
  BREATHE_CYCLES,
  COL_ALPHA,
  COL_FONT,
  COL_LIFT,
  FLASH_DECAY,
  FLASH_HOLD,
  FLASH_PEAK,
  FRINGE_ALPHA,
  GRAIN_ALPHA,
  HEIGHT,
  LOOP,
  PLANE_GLOW_ALPHA,
  PLANES,
  RGB,
  ROW_H,
  ROWS_PER_LOOP,
  RULE,
  RULE_ROW_ALPHA,
  RULE_W,
  STRIPE_ALPHA,
  SUBSTRATE,
  VIGNETTE,
  WIDTH,
} from './constants';
import type { Cell, Schedule } from './data';
import { cellAt } from './data';
import type { Mat } from './geometry';
import {
  BOARD_MAT,
  COL_ANCHOR,
  COL_W,
  COL_X,
  focusDist,
  matApplyX,
  matApplyY,
  planeMat,
  planeWeights,
  RULE_X,
  ruleXAt,
} from './geometry';

/** Board-space band tall enough to cover the frame under the camera transform. */
const Y_TOP = -360;
const Y_BOT = 2520;

/** Below this weight a plane's contribution is not worth a draw call. */
const EPS = 0.004;

type TextItem = {
  text: string;
  x: number;
  y: number;
  col: number;
  rgb: [RGB, RGB, RGB];
  alpha: number;
  bright: number;
  w: [number, number, number];
};

type LineItem = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  w: [number, number, number];
};

const setMat = (ctx: CanvasRenderingContext2D, m: Mat) =>
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);

const clamp255 = (v: number) => (v > 255 ? 255 : v < 0 ? 0 : v);

const css = (c: RGB, k: number, a: number) =>
  `rgba(${clamp255(c[0] * k) | 0},${clamp255(c[1] * k) | 0},${
    clamp255(c[2] * k) | 0
  },${a.toFixed(3)})`;

/**
 * Brightness multiplier for a cell that rerolled `age` frames ago.
 *
 * Jumps to 180% for four frames and eases back over the next ten. This is the
 * only fast motion in the piece, and it is what makes the board read as live.
 */
const flashAt = (age: number) => {
  if (age >= FLASH_HOLD + FLASH_DECAY || age < 0) return 1;
  if (age < FLASH_HOLD) return FLASH_PEAK;
  const t = (age - FLASH_HOLD) / FLASH_DECAY;
  const e = 1 - t;
  return 1 + (FLASH_PEAK - 1) * e * e;
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Collect everything the frame draws, tagged with its depth-plane weights.
 *
 * Building the list first means each plane can be filled in one pass with a
 * single transform and one font switch per column, instead of thrashing canvas
 * state per cell.
 */
const collect = (
  frame: number,
  columns: Cell[][],
  schedule: Schedule,
  breathe: number,
) => {
  const texts: TextItem[] = [];
  const lines: LineItem[] = [];
  const w: [number, number, number] = [0, 0, 0];

  const cycle = mod(frame, LOOP);

  for (let c = 0; c < columns.length; c++) {
    const rows = columns[c];
    const n = ROWS_PER_LOOP[c];

    // One full list per loop: at frame 1160 the offset is exactly n·ROW_H, so
    // the modulo row index shifts by a whole list and the image repeats.
    const off = (frame / LOOP) * n * ROW_H;
    const lift = COL_LIFT[c];
    const anchor = COL_ANCHOR[c];
    const colAlpha = COL_ALPHA[c] * breathe;

    const iStart = Math.floor((Y_TOP + off - lift) / ROW_H);
    const iEnd = Math.ceil((Y_BOT + off - lift) / ROW_H);

    for (let i = iStart; i <= iEnd; i++) {
      const rowIdx = mod(i, n);
      const yTop = i * ROW_H - off + lift;
      const yMid = yTop + ROW_H / 2;

      const { cell, age } = cellAt(schedule.get(`${c}:${rowIdx}`), rows[rowIdx], cycle);

      const sx = matApplyX(BOARD_MAT, anchor, yMid);
      const sy = matApplyY(BOARD_MAT, anchor, yMid);
      planeWeights(focusDist(sx, sy), w);

      texts.push({
        text: cell.text,
        x: anchor,
        y: yMid,
        col: c,
        rgb: cell.rgb,
        alpha: colAlpha,
        bright: flashAt(age),
        w: [w[0], w[1], w[2]],
      });

      // Row rule along the top edge of the row, split in three so the focus
      // gradient runs along it rather than snapping at its midpoint.
      const x0 = COL_X[c];
      const seg = COL_W[c] / 3;
      for (let s = 0; s < 3; s++) {
        const a = x0 + seg * s;
        const b = a + seg;
        const mx = matApplyX(BOARD_MAT, (a + b) / 2, yTop);
        const my = matApplyY(BOARD_MAT, (a + b) / 2, yTop);
        planeWeights(focusDist(mx, my), w);
        lines.push({
          x1: a,
          y1: yTop,
          x2: b,
          y2: yTop,
          alpha: breathe * RULE_ROW_ALPHA,
          w: [w[0], w[1], w[2]],
        });
      }
    }
  }

  // Vertical rules, segmented the same way. Each leans slightly more than the
  // one to its left, so they converge toward the upper right.
  for (let r = 0; r < RULE_X.length; r++) {
    for (let y = Y_TOP; y < Y_BOT; y += ROW_H) {
      const y2 = y + ROW_H;
      const xa = ruleXAt(r, y);
      const xb = ruleXAt(r, y2);
      const mx = matApplyX(BOARD_MAT, (xa + xb) / 2, (y + y2) / 2);
      const my = matApplyY(BOARD_MAT, (xa + xb) / 2, (y + y2) / 2);
      planeWeights(focusDist(mx, my), w);
      lines.push({
        x1: xa,
        y1: y,
        x2: xb,
        y2: y2,
        alpha: breathe,
        w: [w[0], w[1], w[2]],
      });
    }
  }

  return { texts, lines };
};

const resetPlane = (p: Plane) => {
  p.ctx.setTransform(1, 0, 0, 1, 0, 0);
  p.ctx.globalAlpha = 1;
  p.ctx.globalCompositeOperation = 'source-over';
  p.ctx.filter = 'none';
  p.ctx.clearRect(0, 0, p.w, p.h);
};

/** Draw one frame. Pure in `frame` — nothing else varies between calls. */
export const renderFrame = (
  ctx: CanvasRenderingContext2D,
  buffers: Buffers,
  frame: number,
  columns: Cell[][],
  schedule: Schedule,
  fontFamily: string,
) => {
  const { planes, bloom } = buffers;
  const cycle = mod(frame, LOOP);

  const breathe =
    1 + BREATHE_AMP * Math.sin((2 * Math.PI * BREATHE_CYCLES * frame) / LOOP);

  const { texts, lines } = collect(frame, columns, schedule, breathe);

  // ── Fill the depth planes ────────────────────────────────────────────────

  for (let p = 0; p < planes.length; p++) {
    const plane = planes[p];
    const pctx = plane.ctx;
    resetPlane(plane);
    setMat(pctx, planeMat(plane.scale));
    pctx.textAlign = 'right';
    pctx.textBaseline = 'middle';

    // The sharp plane gets an RGB fringe underneath the glyphs: the same text
    // in pure red, green and blue at ±1px, composited additively. At ~10% it
    // reads as a lens/subpixel artefact; any stronger and it looks broken.
    if (p === 0) {
      pctx.globalCompositeOperation = 'lighter';
      let font = -1;
      for (const t of texts) {
        if (t.w[0] <= EPS) continue;
        if (t.col !== font) {
          pctx.font = `${COL_FONT[t.col]}px ${fontFamily}`;
          font = t.col;
        }
        const a = t.alpha * t.w[0] * FRINGE_ALPHA * t.bright;
        pctx.fillStyle = `rgba(255,0,0,${a.toFixed(3)})`;
        pctx.fillText(t.text, t.x - 1, t.y);
        pctx.fillStyle = `rgba(0,255,0,${a.toFixed(3)})`;
        pctx.fillText(t.text, t.x, t.y);
        pctx.fillStyle = `rgba(0,0,255,${a.toFixed(3)})`;
        pctx.fillText(t.text, t.x + 1, t.y);
      }
      pctx.globalCompositeOperation = 'source-over';
    }

    let font = -1;
    for (const t of texts) {
      if (t.w[p] <= EPS) continue;
      if (t.col !== font) {
        pctx.font = `${COL_FONT[t.col]}px ${fontFamily}`;
        font = t.col;
      }
      pctx.fillStyle = css(t.rgb[p], t.bright, t.alpha * t.w[p]);
      pctx.fillText(t.text, t.x, t.y);
    }

    // Carve the LCD stripe into the sharp glyphs before the rules go down, so
    // the rules stay solid lines rather than dashed ones.
    if (p === 0) {
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.globalCompositeOperation = 'destination-out';
      pctx.globalAlpha = STRIPE_ALPHA;
      pctx.fillStyle = buffers.stripe;
      pctx.fillRect(0, 0, plane.w, plane.h);
      pctx.globalAlpha = 1;
      pctx.globalCompositeOperation = 'source-over';
      setMat(pctx, planeMat(plane.scale));
    }

    pctx.lineWidth = RULE_W;
    pctx.lineCap = 'butt';
    for (const l of lines) {
      if (l.w[p] <= EPS) continue;
      pctx.strokeStyle = css(RULE, 1, l.alpha * l.w[p]);
      pctx.beginPath();
      pctx.moveTo(l.x1, l.y1);
      pctx.lineTo(l.x2, l.y2);
      pctx.stroke();
    }
  }

  // ── Composite far → mid → sharp onto the substrate ───────────────────────

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = SUBSTRATE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Additive, because the board is emissive text on near-black. It is also
  // what makes the two-plane split of a single cell sum back to full strength.
  ctx.globalCompositeOperation = 'lighter';

  for (let p = planes.length - 1; p >= 0; p--) {
    const plane = planes[p];
    const spec = PLANES[p];

    if (!plane.blur) {
      ctx.globalAlpha = 1;
      ctx.drawImage(plane.canvas, 0, 0, WIDTH, HEIGHT);
      continue;
    }

    // One blur per plane, at the plane's own reduced size.
    const b = plane.blur;
    b.ctx.setTransform(1, 0, 0, 1, 0, 0);
    b.ctx.globalAlpha = 1;
    b.ctx.globalCompositeOperation = 'source-over';
    b.ctx.clearRect(0, 0, b.w, b.h);
    b.ctx.filter = `blur(${(spec.blur * plane.scale).toFixed(2)}px)`;
    b.ctx.drawImage(plane.canvas, 0, 0);
    b.ctx.filter = 'none';

    ctx.globalAlpha = 1;
    ctx.drawImage(b.canvas, 0, 0, WIDTH, HEIGHT);

    // Defocused emissive text blooms outward as well as softening.
    if (plane.glow) {
      const g = plane.glow;
      g.ctx.setTransform(1, 0, 0, 1, 0, 0);
      g.ctx.globalAlpha = 1;
      g.ctx.globalCompositeOperation = 'source-over';
      g.ctx.clearRect(0, 0, g.w, g.h);
      g.ctx.filter = `blur(${(spec.glow * plane.scale).toFixed(2)}px)`;
      g.ctx.drawImage(b.canvas, 0, 0);
      g.ctx.filter = 'none';

      ctx.globalAlpha = PLANE_GLOW_ALPHA[p];
      ctx.drawImage(g.canvas, 0, 0, WIDTH, HEIGHT);
    }
  }

  // ── Refresh band ─────────────────────────────────────────────────────────

  {
    // Wrapped, so the band makes BAND_PASSES complete crossings per loop and
    // is back at its start on frame LOOP. Without the wrap it makes one slow
    // pass and the loop does not close.
    const travel = HEIGHT + BAND_H * 2;
    const phase = ((frame * BAND_PASSES) / LOOP) % 1;
    const y = phase * travel - BAND_H;
    setMat(ctx, BOARD_MAT);
    ctx.globalAlpha = 1;
    const grad = ctx.createLinearGradient(0, y, 0, y + BAND_H);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(190,215,255,${BAND_ALPHA})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-1200, y, WIDTH + 2400, BAND_H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── Bloom ────────────────────────────────────────────────────────────────

  bloom.ctx.setTransform(1, 0, 0, 1, 0, 0);
  bloom.ctx.globalAlpha = 1;
  bloom.ctx.globalCompositeOperation = 'source-over';
  bloom.ctx.clearRect(0, 0, bloom.w, bloom.h);
  bloom.ctx.filter = `blur(${BLOOM_BLUR}px)`;
  bloom.ctx.drawImage(ctx.canvas, 0, 0, bloom.w, bloom.h);
  bloom.ctx.filter = 'none';

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = BLOOM_ALPHA;
  ctx.drawImage(bloom.canvas, 0, 0, WIDTH, HEIGHT);

  // ── Vignette ─────────────────────────────────────────────────────────────

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    WIDTH * 0.24,
    WIDTH / 2,
    HEIGHT / 2,
    WIDTH * 0.66,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.6, `rgba(0,0,0,${(VIGNETTE * 0.32).toFixed(3)})`);
  vig.addColorStop(1, `rgba(0,0,0,${VIGNETTE.toFixed(3)})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Grain ────────────────────────────────────────────────────────────────

  {
    const tile = Math.floor(random(`grain-tile-${cycle}`) * buffers.grainPatterns.length);
    const ox = Math.floor(random(`grain-x-${cycle}`) * GRAIN_TILE_SIZE);
    const oy = Math.floor(random(`grain-y-${cycle}`) * GRAIN_TILE_SIZE);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = GRAIN_ALPHA;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = buffers.grainPatterns[tile];
    ctx.fillRect(-ox, -oy, WIDTH, HEIGHT);
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
