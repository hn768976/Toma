/**
 * Retro VCR on-screen display — an overlay plate.
 *
 * White-on-black by design: drop the clip over your own footage with a Screen
 * blend and the black falls away, leaving only the OSD and the tape artifacts.
 *
 * The whole frame is composited by hand into one ImageData: the static plate is
 * sampled with per-row displacement (tracking, tear, vertical hold) and a small
 * red/blue split, then the tape noise is laid on top. Doing it per pixel is
 * what keeps the letterforms as exact rectangles and the untouched background
 * at a true 0,0,0.
 */

import React, {useLayoutEffect, useMemo, useRef} from "react";
import {AbsoluteFill, useCurrentFrame, useCurrentScale, useVideoConfig} from "remotion";
import {blink, rowField, verticalHold} from "./distortion";
import type {GlyphName} from "./glyphs";
import {hashInt} from "./noise";
import {buildPlate} from "./plate";

/** Warm white — a phosphor is never quite neutral. */
const TINT_R = 1;
const TINT_G = 0.982;
const TINT_B = 0.947;

/** Share of device pixels carrying a grain speck on any given frame. */
const GRAIN_DENSITY = 0.022;

export type VCROSDProps = {
  label: string;
  glyph: GlyphName;
  /** Decorrelates the tape artifacts between clips in the set. */
  seed: number;
};

export const VCROSD: React.FC<VCROSDProps> = ({label, glyph, seed}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const scale = useCurrentScale();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Work in device pixels so blocks and noise land on whole output pixels.
  const dw = Math.max(1, Math.round(width * scale));
  const dh = Math.max(1, Math.round(height * scale));
  const unit = dh / 2160;

  const plate = useMemo(
    () => buildPlate({dw, dh, label, glyph}),
    [dw, dh, label, glyph],
  );

  const image = useMemo(() => {
    const buffer = new ArrayBuffer(dw * dh * 4);
    return {
      data: new ImageData(new Uint8ClampedArray(buffer), dw, dh),
      u8: new Uint8ClampedArray(buffer),
      u32: new Uint32Array(buffer),
    };
  }, [dw, dh]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", {alpha: false});
    if (!ctx) return;

    const f = ((frame % durationInFrames) + durationInFrames) % durationInFrames;
    const {u8, u32, data} = image;
    const {lum, rowHas, rowMin, rowMax} = plate;

    // Opaque black everywhere; anything not written stays exactly 0,0,0.
    u32.fill(0xff000000);

    const ctxArgs = {frame: f, period: durationInFrames, dh, unit, seed};
    const {shift, energy, peak} = rowField(ctxArgs, plate.top, plate.bottom);
    const hold = verticalHold(ctxArgs);
    const dim = blink(f);

    // --- the OSD itself -----------------------------------------------------
    for (let y = 0; y < dh; y++) {
      const srcY = y - hold;
      if (srcY < 0 || srcY >= dh || rowHas[srcY] === 0) continue;

      const dx = shift[y];
      const chroma = Math.max(1, Math.round((1.2 + 6 * energy[y]) * unit));
      const src = srcY * dw;
      const from = Math.max(0, rowMin[srcY] + dx - chroma);
      const to = Math.min(dw - 1, rowMax[srcY] + dx + chroma);

      for (let x = from; x <= to; x++) {
        const sx = x - dx;
        // Red trails to the right of the core, blue to the left.
        const sr = sx - chroma;
        const sb = sx + chroma;
        const g = sx >= 0 && sx < dw ? lum[src + sx] : 0;
        const r = sr >= 0 && sr < dw ? lum[src + sr] : 0;
        const b = sb >= 0 && sb < dw ? lum[src + sb] : 0;
        if ((r | g | b) === 0) continue;
        const o = (y * dw + x) * 4;
        u8[o] = r * TINT_R * dim;
        u8[o + 1] = g * TINT_G * dim;
        u8[o + 2] = b * TINT_B * dim;
      }
    }

    const put = (o: number, v: number) => {
      if (u8[o] < v) {
        u8[o] = v;
        u8[o + 1] = v;
        u8[o + 2] = v;
      }
    };

    // --- noise inside the tracking bands ------------------------------------
    if (peak > 0.02) {
      const run = Math.max(1, Math.round(1.5 * unit));
      for (let y = 0; y < dh; y++) {
        const e = energy[y];
        if (e < 0.05) continue;
        const density = 0.1 * e;
        for (let x = 0; x < dw; x++) {
          const h = hashInt((x / run) | 0, y, f, seed + 41);
          if ((h & 4095) / 4096 > density) continue;
          put((y * dw + x) * 4, 12 + (((h >>> 12) & 63) * e));
        }
      }
    }

    // --- fine luminance grain, sparse so the black stays black --------------
    const grains = Math.round(dw * dh * GRAIN_DENSITY);
    const pixels = dw * dh;
    for (let i = 0; i < grains; i++) {
      const h = hashInt(i, f, seed + 7);
      const idx = h % pixels;
      const bright = (h & 63) === 0 ? 70 : 0;
      put(idx * 4, 7 + ((h >>> 8) & 21) + bright);
    }

    // --- head-switching noise along the bottom edge -------------------------
    // The tape head leaves a band of torn noise at the foot of every frame.
    // It is always there; its height and its ragged upper edge jitter.
    const bandHeight = Math.max(
      3,
      Math.round((0.024 + 0.012 * ((hashInt(f, seed + 61) & 255) / 255)) * dh),
    );
    const bandTop = dh - bandHeight;
    const run = Math.max(1, Math.round(2 * unit));
    const clump = run * 6;
    for (let y = bandTop; y < dh; y++) {
      const rowHash = hashInt(y, f, seed + 62);
      const gain = 0.55 + ((rowHash & 255) / 255) * 0.45;
      const depth = (y - bandTop) / bandHeight;
      const base = (0.05 + 0.8 * depth * depth) * gain;
      const tear = Math.round((((rowHash >>> 9) & 255) / 255 - 0.5) * 60 * unit);
      const row = y * dw;
      for (let x = 0; x < dw; x++) {
        // Each clump of columns starts at its own height: a ragged top edge
        // rather than a ruled grey bar.
        const colHash = hashInt((x / clump) | 0, f, seed + 64);
        if (depth < ((colHash & 255) / 255) * 0.5) continue;
        const h = hashInt(((x + tear) / run) | 0, y, f, seed + 63);
        if ((h & 1023) / 1024 > base) continue;
        put((row + x) * 4, 26 + ((h >>> 10) & 127) + ((h >>> 18) & 63));
      }
    }

    ctx.putImageData(data, 0, 0);
  }, [frame, durationInFrames, plate, image, dw, dh, unit, seed]);

  return (
    <AbsoluteFill style={{backgroundColor: "black"}}>
      <canvas
        ref={canvasRef}
        width={dw}
        height={dh}
        style={{width, height, display: "block", imageRendering: "pixelated"}}
      />
    </AbsoluteFill>
  );
};
