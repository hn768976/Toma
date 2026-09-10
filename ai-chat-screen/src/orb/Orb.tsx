import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";

import { ORB_BREATH_PERIOD, ORB_ROTATION_PERIOD } from "../constants";
import { hexToRgb, mixRgb, rgbaString, type OrbPalette } from "../theme";
import { ORB_POINTS } from "./points";

const TAU = Math.PI * 2;

// Dots are quantised into (colour x alpha) buckets so a frame is a few
// hundred fill() calls over batched paths instead of ~3200 individual
// state changes. The visible banding from quantising is nil at these
// counts, and it is the difference between a fast render and a slow one.
const COLOUR_BUCKETS = 26;
const ALPHA_BUCKETS = 16;

const FAR_ALPHA = 0.14;
const NEAR_ALPHA = 0.95;

type OrbProps = {
  palette: OrbPalette;
  centerX: number;
  centerY: number;
  radius: number;
};

const buildFillTable = (palette: OrbPalette) => {
  const from = hexToRgb(palette.from);
  const to = hexToRgb(palette.to);
  const table: string[] = new Array(COLOUR_BUCKETS * ALPHA_BUCKETS);
  for (let c = 0; c < COLOUR_BUCKETS; c++) {
    const rgb = mixRgb(from, to, c / (COLOUR_BUCKETS - 1));
    for (let a = 0; a < ALPHA_BUCKETS; a++) {
      table[c * ALPHA_BUCKETS + a] = rgbaString(rgb, (a + 1) / ALPHA_BUCKETS);
    }
  }
  return table;
};

export const Orb: React.FC<OrbProps> = ({ palette, centerX, centerY, radius }) => {
  const frame = useCurrentFrame();

  // The canvas covers only the orb's bounding box rather than the whole
  // 4K frame: blurring the bloom copy is the expensive part and it scales
  // with area.
  const box = Math.ceil(radius * 2.6);
  const localCx = box / 2;
  const localCy = box / 2;

  const fills = useMemo(() => buildFillTable(palette), [palette]);
  const sharpRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);

  const breath =
    0.5 + 0.5 * Math.sin((frame / ORB_BREATH_PERIOD) * TAU - Math.PI / 2);

  useLayoutEffect(() => {
    const sharp = sharpRef.current;
    const bloom = bloomRef.current;
    if (!sharp || !bloom) return;
    const ctx = sharp.getContext("2d");
    const bloomCtx = bloom.getContext("2d");
    if (!ctx || !bloomCtx) return;

    ctx.clearRect(0, 0, box, box);
    ctx.globalCompositeOperation = "lighter";

    const angle = (frame / ORB_ROTATION_PERIOD) * TAU;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const minSize = radius * 0.0035;
    const maxSize = radius * 0.0092;

    // Flat [x, y, r, x, y, r, ...] runs, one per bucket.
    const buckets: number[][] = [];
    const accents: number[] = [];

    for (const p of ORB_POINTS) {
      const x = p.x * cosA + p.z * sinA;
      const z = -p.x * sinA + p.z * cosA;

      const sx = localCx + x * radius;
      const sy = localCy - p.y * radius;

      const depth = (z + 1) / 2; // 0 = far side, 1 = near side
      const depthCurve = Math.pow(depth, 1.35);

      // The gradient runs across the screen, not around the ball, so it
      // stays put while the ball turns: upper-left `from`, lower-right `to`.
      const gradient = ((x + 1) / 2) * 0.5 + ((-p.y + 1) / 2) * 0.5;

      const alpha =
        (FAR_ALPHA + (NEAR_ALPHA - FAR_ALPHA) * depthCurve) *
        p.alphaScale *
        (0.92 + 0.08 * breath);
      const size = (minSize + (maxSize - minSize) * depthCurve) * p.sizeScale;

      if (p.bright) {
        accents.push(sx, sy, size * 1.7, Math.min(1, alpha * 1.5), gradient);
        continue;
      }

      const c = Math.min(
        COLOUR_BUCKETS - 1,
        Math.max(0, Math.round(gradient * (COLOUR_BUCKETS - 1))),
      );
      const a = Math.min(
        ALPHA_BUCKETS - 1,
        Math.max(0, Math.round(alpha * ALPHA_BUCKETS) - 1),
      );
      const key = c * ALPHA_BUCKETS + a;
      const run = buckets[key] ?? (buckets[key] = []);
      run.push(sx, sy, size);
    }

    for (let key = 0; key < buckets.length; key++) {
      const run = buckets[key];
      if (!run || run.length === 0) continue;
      ctx.fillStyle = fills[key];
      ctx.beginPath();
      for (let i = 0; i < run.length; i += 3) {
        const x = run[i];
        const y = run[i + 1];
        const r = run[i + 2];
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
    }

    // A handful of brighter dots scattered through the cloud, pushed
    // toward white so they read as highlights rather than as bigger dots.
    const from = hexToRgb(palette.from);
    const to = hexToRgb(palette.to);
    const white = { r: 255, g: 255, b: 255 };
    for (let i = 0; i < accents.length; i += 5) {
      const tint = mixRgb(mixRgb(from, to, accents[i + 4]), white, 0.45);
      ctx.fillStyle = rgbaString(tint, accents[i + 3]);
      ctx.beginPath();
      ctx.arc(accents[i], accents[i + 1], accents[i + 2], 0, TAU);
      ctx.fill();
    }

    bloomCtx.clearRect(0, 0, box, box);
    bloomCtx.drawImage(sharp, 0, 0);
  }, [frame, box, radius, fills, breath, palette, localCx, localCy]);

  const style: React.CSSProperties = {
    position: "absolute",
    left: centerX - box / 2,
    top: centerY - box / 2,
    width: box,
    height: box,
  };

  return (
    <>
      {/* Wide, soft atmosphere under everything, breathing gently. */}
      <div
        style={{
          position: "absolute",
          left: centerX - radius * 2.1,
          top: centerY - radius * 2.1,
          width: radius * 4.2,
          height: radius * 4.2,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${palette.glow}2e 0%, ${palette.glow}12 32%, ${palette.glow}00 66%)`,
          opacity: 0.72 + breath * 0.28,
        }}
      />
      {/* Bloom pass: the same dots, blurred and screened back over the
          crisp pass. Confined to this layer so the code never blooms. */}
      <canvas
        ref={bloomRef}
        width={box}
        height={box}
        style={{
          ...style,
          filter: `blur(${Math.round(radius * 0.052)}px)`,
          opacity: 0.55 + breath * 0.16,
          mixBlendMode: "screen",
        }}
      />
      <canvas ref={sharpRef} width={box} height={box} style={style} />
    </>
  );
};
