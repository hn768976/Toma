/**
 * <DotGlobe> — a small sphere rendered as a dot field, rotating slowly inside a
 * thin ring with fine radial ticks.
 *
 * The dots are a Fibonacci sphere thinned to seeded blobs, so the sphere reads
 * as a globe with landmasses rather than as an evenly speckled ball. Rotation
 * completes a whole number of turns across the piece.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { tickRing, useOffscreen, withAlpha } from "../shared/draw";
import { rand } from "../shared/rng";
import type { Rect } from "../layout";
import type { Palette } from "../variants";

const TURNS = 2;
const POINTS = 2600;

type P = { x: number; y: number; z: number };

const sphere = (seed: string): P[] => {
  // Seeded blob centres act as landmasses; only dots inside one are kept.
  const blobs = Array.from({ length: 11 }, (_, i) => {
    const a = rand(`${seed}-b${i}-a`, 0, Math.PI * 2);
    const u = rand(`${seed}-b${i}-u`, -1, 1);
    const s = Math.sqrt(1 - u * u);
    return {
      x: s * Math.cos(a),
      y: u,
      z: s * Math.sin(a),
      r: rand(`${seed}-b${i}-r`, 0.34, 0.8),
    };
  });

  const out: P[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < POINTS; i++) {
    const y = 1 - (i / (POINTS - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    const p = { x: Math.cos(th) * r, y, z: Math.sin(th) * r };
    for (const b of blobs) {
      const dot = p.x * b.x + p.y * b.y + p.z * b.z;
      if (Math.acos(Math.max(-1, Math.min(1, dot))) < b.r) {
        out.push(p);
        break;
      }
    }
  }
  return out;
};

export const DotGlobe: React.FC<{
  rect: Rect;
  palette: Palette;
  frame: number;
  duration: number;
  seed: string;
}> = ({ rect, palette, frame, duration, seed }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const pts = useMemo(() => sphere(seed), [seed]);

  const cx = rect.w / 2;
  const cy = rect.h / 2;
  const radius = rect.w * 0.34;

  const chrome = useOffscreen(
    rect.w,
    rect.h,
    (ctx) => {
      tickRing(ctx, cx, cy, radius * 1.34, withAlpha(palette.panelBorder, 0.95), {
        ticks: 90,
        tickLength: 9,
        thickness: 2,
        everyNthLong: 6,
      });
      ctx.strokeStyle = withAlpha(palette.panelBorder, 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.12, 0, Math.PI * 2);
      ctx.stroke();
    },
    [rect.w, rect.h, palette, cx, cy, radius],
  );

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, rect.w, rect.h);
    ctx.drawImage(chrome, 0, 0);

    const a = (Math.PI * 2 * TURNS * frame) / duration;
    const ca = Math.cos(a);
    const sa = Math.sin(a);

    ctx.fillStyle = palette.globe;
    for (const p of pts) {
      const z = -p.x * sa + p.z * ca;
      const x = p.x * ca + p.z * sa;
      const front = z >= 0;
      // The far hemisphere is drawn faintly rather than culled, so the sphere
      // still reads as a sphere when the landmasses rotate away.
      const depth = front ? 0.4 + 0.6 * z : 0.16 + 0.1 * (1 + z);
      ctx.globalAlpha = Math.min(1, front ? depth * 1.35 : depth);
      const s = front ? 2.4 + depth * 3.0 : 2.0;
      ctx.fillRect(cx + x * radius - s / 2, cy + p.y * radius - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
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
