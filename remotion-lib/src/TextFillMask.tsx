import React, {useMemo, useRef} from "react";
import {random} from "remotion";
import {createGlyphAtlas} from "./glyph-atlas";
import type {MaskField} from "./mask-field";
import {makeCanvas, useCanvas2D} from "./use-canvas";

/**
 * Fills an arbitrary shape with a dense field of characters clipped to it, and
 * rerolls a trickle of those characters over time.
 *
 * The shape is supplied as a rasterised {@link MaskField}, so this component is
 * completely subject-agnostic: give it a map, a logo, a letterform or a body
 * silhouette and you get the same "shape made of text" treatment. Colours
 * arrive as a caller-supplied ramp, so it is palette-agnostic too.
 *
 * Determinism: every character's value at frame `f` is a pure function of `f`.
 * Rerolls are drawn from a global event stream indexed by
 * `floor(frame * rerollsPerFrame)`, so replaying the stream from zero
 * reconstructs any frame exactly. That is what allows the fast path below to
 * be a cache rather than a source of truth.
 *
 * Performance: the visible canvas *is* the persistent buffer. When the
 * requested frame is exactly one after the last one drawn, only the handful of
 * cells that changed value or stopped flashing are repaired in place (each
 * repair redraws a small neighbourhood so jittered glyphs that overlap cell
 * boundaries stay intact). Any other frame — first render, a scrub, an
 * out-of-order render worker — triggers a full redraw, which produces a
 * pixel-identical result.
 *
 * @example
 * <TextFillMask
 *   width={3840} height={2160} mask={landMask}
 *   chars={["0", "1"]} ramp={ramp} weights={weights} flashColor="#7FD4FF"
 *   fontFamily="Share Tech Mono" fontSize={14}
 *   cellWidth={9} rowHeight={15} jitter={1.6}
 *   rerollsPerFrame={55 / 30} flashFrames={3} seed="land" frame={frame}
 * />
 */
export type TextFillMaskProps = {
  width: number;
  height: number;
  /** Rasterised shape the character field is clipped to. */
  mask: MaskField;
  /** Character set cycled through on reroll, e.g. `["0", "1"]`. */
  chars: readonly string[];
  /** Colour per brightness bracket, dim first. */
  ramp: readonly string[];
  /** Relative frequency of each bracket; same length as `ramp`. */
  weights: readonly number[];
  /** Colour a character flashes for `flashFrames` after it rerolls. */
  flashColor: string;
  fontFamily: string;
  fontSize: number;
  /** Horizontal advance of one cell in the grid. */
  cellWidth: number;
  /** Vertical advance of one row. */
  rowHeight: number;
  /** Max horizontal offset applied per character so rows do not read as a grid. */
  jitter: number;
  /** Characters rerolled per frame; may be fractional. */
  rerollsPerFrame: number;
  /** How many frames a rerolled character stays flashed. */
  flashFrames: number;
  seed: string;
  frame: number;
  style?: React.CSSProperties;
  /** Receives the live canvas so a caller can post-process it (e.g. bloom). */
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
};

type Field = {
  count: number;
  /** Blit position (top-left of the atlas cell), jitter already applied. */
  x: Float32Array;
  y: Float32Array;
  col: Int32Array;
  row: Int32Array;
  bracket: Uint8Array;
  base: Uint8Array;
  cols: number;
  rows: number;
  /** cell index by row * cols + col, or -1 where the mask excluded it. */
  lookup: Int32Array;
};

/** Total rerolls that have happened strictly before `frame`. */
const rerollsBefore = (frame: number, perFrame: number) =>
  Math.max(0, Math.floor(frame * perFrame));

export const TextFillMask: React.FC<TextFillMaskProps> = ({
  width,
  height,
  mask,
  chars,
  ramp,
  weights,
  flashColor,
  fontFamily,
  fontSize,
  cellWidth,
  rowHeight,
  jitter,
  rerollsPerFrame,
  flashFrames,
  seed,
  frame,
  style,
  canvasRef,
}) => {
  const atlas = useMemo(
    () =>
      createGlyphAtlas({
        chars,
        colors: [...ramp, flashColor],
        fontFamily,
        fontSize,
        boxWidth: cellWidth,
        boxHeight: rowHeight,
        padX: Math.ceil(jitter) + 1,
        padY: 2,
      }),
    [chars, ramp, flashColor, fontFamily, fontSize, cellWidth, rowHeight, jitter],
  );

  const flashBracket = ramp.length;

  // The grid is built once: every candidate cell is tested against the mask and
  // only the ones inside survive. This is the single most expensive step in the
  // piece and it must never run per frame.
  const field = useMemo<Field>(() => {
    const cols = Math.ceil(width / cellWidth) + 1;
    const rows = Math.ceil(height / rowHeight) + 1;
    const lookup = new Int32Array(cols * rows).fill(-1);

    const xs: number[] = [];
    const ys: number[] = [];
    const cs: number[] = [];
    const rs: number[] = [];
    const bs: number[] = [];
    const vs: number[] = [];

    for (let r = 0; r < rows; r++) {
      const cy = r * rowHeight + rowHeight / 2;
      for (let c = 0; c < cols; c++) {
        const cx = c * cellWidth + cellWidth / 2;
        if (!mask.contains(cx, cy)) continue;

        const i = xs.length;
        const jx = (random(`${seed}-j-${r}-${c}`) * 2 - 1) * jitter;
        xs.push(c * cellWidth + jx - atlas.padX);
        ys.push(r * rowHeight - atlas.padY);
        cs.push(c);
        rs.push(r);

        // Weighted brightness bracket: mostly dim, a scattering mid, a few bright.
        let total = 0;
        for (const w of weights) total += w;
        let acc = random(`${seed}-b-${r}-${c}`) * total;
        let bracket = weights.length - 1;
        for (let k = 0; k < weights.length; k++) {
          acc -= weights[k];
          if (acc < 0) {
            bracket = k;
            break;
          }
        }
        bs.push(bracket);
        vs.push(Math.floor(random(`${seed}-v-${r}-${c}`) * chars.length));
        lookup[r * cols + c] = i;
      }
    }

    return {
      count: xs.length,
      x: Float32Array.from(xs),
      y: Float32Array.from(ys),
      col: Int32Array.from(cs),
      row: Int32Array.from(rs),
      bracket: Uint8Array.from(bs),
      base: Uint8Array.from(vs),
      cols,
      rows,
      lookup,
    };
  }, [width, height, cellWidth, rowHeight, jitter, mask, seed, weights, chars.length, atlas.padX, atlas.padY]);

  // Mutable render cache. `frame: -1` means "nothing valid drawn yet".
  const cache = useRef<{
    frame: number;
    parity: Uint8Array;
    flashUntil: Int32Array;
    scratch: {canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D};
    key: string;
  } | null>(null);

  const cacheKey = `${field.count}-${atlas.canvas.width}-${seed}`;

  const canvas = useCanvas2D(width, height, (ctx) => {
    if (canvasRef) canvasRef.current = ctx.canvas;

    if (!cache.current || cache.current.key !== cacheKey) {
      cache.current = {
        frame: -1,
        parity: new Uint8Array(field.count),
        flashUntil: new Int32Array(field.count).fill(-1),
        scratch: makeCanvas(
          atlas.cellWidth * 8 + cellWidth * 8,
          atlas.cellHeight * 4 + rowHeight * 4,
        ),
        key: cacheKey,
      };
    }
    const state = cache.current;

    const blit = (
      target: CanvasRenderingContext2D,
      i: number,
      bracket: number,
      offX: number,
      offY: number,
    ) => {
      const charIndex = (field.base[i] + state.parity[i]) % chars.length;
      const {sx, sy} = atlas.source(charIndex, bracket);
      target.drawImage(
        atlas.canvas,
        sx,
        sy,
        atlas.cellWidth,
        atlas.cellHeight,
        field.x[i] - offX,
        field.y[i] - offY,
        atlas.cellWidth,
        atlas.cellHeight,
      );
    };

    const bracketAt = (i: number, f: number) =>
      state.flashUntil[i] > f ? flashBracket : field.bracket[i];

    const fullRedraw = () => {
      state.parity.fill(0);
      state.flashUntil.fill(-1);

      // Replay the whole reroll stream. At ~2 events per frame this is under a
      // thousand iterations even at the end of the composition.
      let cursor = 0;
      for (let f = 0; f <= frame; f++) {
        const upto = rerollsBefore(f + 1, rerollsPerFrame);
        for (; cursor < upto; cursor++) {
          const i = Math.floor(random(`${seed}-rr-${cursor}`) * field.count);
          if (i >= field.count) continue;
          state.parity[i] ^= 1;
          state.flashUntil[i] = f + flashFrames;
        }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < field.count; i++) {
        blit(ctx, i, bracketAt(i, frame), 0, 0);
      }
      // One mask pass for the whole field: the coastline is where the text is
      // cut, not merely where whole glyphs happen to stop.
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask.canvas, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    };

    /**
     * Repair one cell and every neighbour whose jittered glyph can reach the
     * repaired rect.
     *
     * The rect is snapped to whole pixels on purpose. A fractional `clearRect`
     * leaves partial alpha at its edges, and a fractional source rect makes
     * `drawImage` resample the mask — either one would make an incrementally
     * drawn frame differ from the same frame redrawn in full, which is exactly
     * the guarantee this component rests on.
     */
    const repair = (i: number) => {
      const c = field.col[i];
      const r = field.row[i];
      const x0 = Math.floor(c * cellWidth - jitter - atlas.padX - cellWidth * 2);
      const y0 = Math.floor(r * rowHeight - atlas.padY - rowHeight);
      const w = Math.ceil(atlas.cellWidth + cellWidth * 4 + jitter * 2) + 2;
      const h = Math.ceil(atlas.cellHeight + rowHeight * 2) + 2;

      const sctx = state.scratch.ctx;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = "source-over";
      sctx.clearRect(0, 0, state.scratch.canvas.width, state.scratch.canvas.height);

      for (let rr = r - 2; rr <= r + 2; rr++) {
        if (rr < 0 || rr >= field.rows) continue;
        for (let cc = c - 5; cc <= c + 5; cc++) {
          if (cc < 0 || cc >= field.cols) continue;
          const j = field.lookup[rr * field.cols + cc];
          if (j < 0) continue;
          blit(sctx, j, bracketAt(j, frame), x0, y0);
        }
      }
      sctx.globalCompositeOperation = "destination-in";
      sctx.drawImage(mask.canvas, x0, y0, w, h, 0, 0, w, h);
      sctx.globalCompositeOperation = "source-over";

      ctx.clearRect(x0, y0, w, h);
      ctx.drawImage(state.scratch.canvas, 0, 0, w, h, x0, y0, w, h);
    };

    if (state.frame !== frame - 1 || state.frame < 0) {
      fullRedraw();
    } else {
      const dirty = new Set<number>();

      // Characters that reroll on this frame.
      const from = rerollsBefore(frame, rerollsPerFrame);
      const upto = rerollsBefore(frame + 1, rerollsPerFrame);
      for (let cursor = from; cursor < upto; cursor++) {
        const i = Math.floor(random(`${seed}-rr-${cursor}`) * field.count);
        if (i >= field.count) continue;
        state.parity[i] ^= 1;
        state.flashUntil[i] = frame + flashFrames;
        dirty.add(i);
      }
      // Characters whose flash expires on this frame.
      for (let i = 0; i < field.count; i++) {
        if (state.flashUntil[i] === frame) dirty.add(i);
      }
      dirty.forEach(repair);
    }

    state.frame = frame;
  });

  return (
    <canvas
      ref={canvas}
      style={{position: "absolute", inset: 0, width: "100%", height: "100%", ...style}}
    />
  );
};
