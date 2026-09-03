/**
 * <CodePanel> — a bordered rectangle of dense, illegible monospace.
 *
 * The text is entirely fictional, assembled from token pools by a seeded
 * generator; no real library source and no copyright header is reproduced. At
 * this size it is texture, not data. The block is rasterised once into a tall
 * offscreen canvas and then scrolled by blitting it twice, so no text is laid
 * out per frame.
 */
import React, { useEffect, useRef } from "react";
import { monoFont } from "../fonts";
import { useOffscreen, withAlpha } from "../shared/draw";
import { drawPanelChrome } from "../lib/chrome";
import { pick, rand, randInt, rerolled } from "../shared/rng";
import type { Rect } from "../layout";
import type { Palette } from "../variants";

const KEYWORDS = ["for", "while", "if", "static", "const", "return", "case", "goto"];
const TYPES = ["u8", "u16", "u32", "f32", "size_t", "ridge_t", "minutia_t", "frame_t"];
const NAMES = [
  "ridge_map", "core_delta", "tap_index", "arena", "sweep_row", "bin_edge",
  "orient_field", "pore_list", "crest", "valley_id", "seg_mask", "quality",
];
const CALLS = [
  "pool_take", "clamp_row", "orient_at", "bin_pack", "trace_ridge", "seg_flush",
  "quality_of", "delta_scan", "emit_pair", "wrap_index",
];

const hex = (seed: string, digits: number) => {
  let s = "";
  for (let i = 0; i < digits; i++) {
    s += "0123456789ABCDEF"[randInt(`${seed}-h${i}`, 0, 15)];
  }
  return s;
};

/** One line of plausible-looking, wholly invented code. */
const codeLine = (seed: string): string => {
  const shape = randInt(`${seed}-shape`, 0, 5);
  const n = NAMES[randInt(`${seed}-n`, 0, NAMES.length - 1)];
  const c = CALLS[randInt(`${seed}-c`, 0, CALLS.length - 1)];
  const t = TYPES[randInt(`${seed}-t`, 0, TYPES.length - 1)];
  const k = pick(`${seed}-k`, KEYWORDS);
  const a = randInt(`${seed}-a`, 0, 255);
  const b = randInt(`${seed}-b`, 2, 512);
  const indent = " ".repeat(randInt(`${seed}-i`, 0, 3) * 2);

  switch (shape) {
    case 0:
      return `${indent}${k} (${n} = 0; ${n} < ${b}; ${n}++)`;
    case 1:
      return `${indent}${t} *${n} = ${c}(&${NAMES[(a + 3) % NAMES.length]}, 0x${hex(seed, 2)});`;
    case 2:
      return `${indent}0x${hex(seed, 4)}  ${c}  r${a % 8}, [sp, #0x${hex(seed, 2)}]`;
    case 3:
      return `${indent}${n}[${a % 64}] = ${c}(${b}, 0x${hex(seed, 3)}) >> ${a % 7};`;
    case 4:
      return `${indent}// ${c}: ${b} taps, window 0x${hex(seed, 2)}`;
    default:
      return `${indent}${t} ${n} = ${a}.${randInt(`${seed}-f`, 100, 999)}e-${a % 5};`;
  }
};

export const CodePanel: React.FC<{
  rect: Rect;
  palette: Palette;
  label: string;
  seed: string;
  frame: number;
  fps: number;
  /** Pixels of scroll per frame. */
  speed: number;
}> = ({ rect, palette, label, seed, frame, fps, speed }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  const chrome = useOffscreen(
    rect.w,
    rect.h,
    (ctx) => drawPanelChrome(ctx, rect, palette, label),
    [rect.w, rect.h, palette, label],
  );

  const LINE_H = 26;
  const LINES = 70;
  const block = useOffscreen(
    rect.w,
    LINES * LINE_H,
    (ctx) => {
      ctx.font = monoFont(19);
      ctx.textBaseline = "middle";
      for (let i = 0; i < LINES; i++) {
        const s = `${seed}-l${i}`;
        ctx.fillStyle = withAlpha(palette.textPale, rand(`${s}-a`, 0.3, 0.92));
        ctx.fillText(codeLine(s), 20, i * LINE_H + LINE_H / 2);
      }
    },
    [rect.w, seed, palette.textPale],
  );

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, rect.w, rect.h);
    ctx.drawImage(chrome, 0, 0);

    const inset = 22;
    const viewH = rect.h - inset * 2 - 34;
    ctx.save();
    ctx.beginPath();
    ctx.rect(inset, inset, rect.w - inset * 2, viewH);
    ctx.clip();
    const total = block.height;
    const off = ((frame * speed) % total + total) % total;
    ctx.drawImage(block, 0, inset - off);
    ctx.drawImage(block, 0, inset - off + total);

    // Live values sitting over the scroll, rerolling 5 times a second. Panel
    // content is texture, not data — these just have to keep moving.
    ctx.font = monoFont(19, 500);
    ctx.textBaseline = "middle";
    for (let i = 0; i < 3; i++) {
      const v = rerolled(`${seed}-val-${i}`, frame, fps, 5);
      const row = rerolled(`${seed}-row-${i}`, frame, fps, 5);
      const y = inset + 18 + Math.floor(row * (viewH - 36));
      const x = inset + 20 + rand(`${seed}-vx-${i}`, 0, 0.5) * (rect.w - inset * 2);
      const text = `0x${Math.floor(v * 0xffffff)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0")}`;
      const tw = ctx.measureText(text).width;
      // Knock the scrolling text out behind the value so it reads as a live
      // field rather than as two overlapping lines.
      ctx.fillStyle = withAlpha(palette.panelFill, 0.96);
      ctx.fillRect(x - 6, y - 13, tw + 12, 26);
      ctx.fillStyle = withAlpha(palette.textBright, 0.95);
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  });

  return (
    <canvas
      ref={ref}
      width={rect.w}
      height={rect.h}
      style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    />
  );
};
