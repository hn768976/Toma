/**
 * <PatternPanel> — a small bordered panel of pure texture: either a faint dot
 * field or a mesh fragment. Never photographic, never data.
 */
import React, { useEffect, useRef } from "react";
import { useOffscreen, withAlpha } from "../shared/draw";
import { drawPanelChrome } from "../lib/chrome";
import { rand, rerolled } from "../shared/rng";
import type { Rect } from "../layout";
import type { Palette } from "../variants";

export const PatternPanel: React.FC<{
  rect: Rect;
  palette: Palette;
  label: string;
  kind: "dots" | "mesh";
  seed: string;
  frame: number;
  fps: number;
}> = ({ rect, palette, label, kind, seed, frame, fps }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  const chrome = useOffscreen(
    rect.w,
    rect.h,
    (ctx) => drawPanelChrome(ctx, rect, palette, label),
    [rect.w, rect.h, palette, label],
  );

  const inset = 30;
  const iw = rect.w - inset * 2;
  const ih = rect.h - inset * 2 - 34;

  const content = useOffscreen(
    rect.w,
    rect.h,
    (ctx) => {
      if (kind === "dots") {
        const cols = 26;
        const rows = 15;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const a = rand(`${seed}-d-${r}-${c}`, 0, 1);
            if (a < 0.34) continue;
            ctx.fillStyle = withAlpha(palette.textPale, (a - 0.34) * 0.75);
            const x = inset + (c + 0.5) * (iw / cols);
            const y = inset + (r + 0.5) * (ih / rows);
            ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
          }
        }
      } else {
        const n = 26;
        const pts = Array.from({ length: n }, (_, i) => ({
          x: inset + rand(`${seed}-mx-${i}`, 0.04, 0.96) * iw,
          y: inset + rand(`${seed}-my-${i}`, 0.04, 0.96) * ih,
        }));
        ctx.lineWidth = 1.8;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
            if (d > iw * 0.26) continue;
            ctx.strokeStyle = withAlpha(palette.textPale, 0.42 * (1 - d / (iw * 0.26)));
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = withAlpha(palette.textPale, 0.75);
        for (const p of pts) ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      }
    },
    [rect.w, rect.h, kind, seed, palette.textPale, inset, iw, ih],
  );

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, rect.w, rect.h);
    ctx.drawImage(chrome, 0, 0);
    ctx.drawImage(content, 0, 0);

    // A few cells light up and reroll several times a second.
    for (let i = 0; i < 4; i++) {
      const v = rerolled(`${seed}-hi-${i}`, frame, fps, 5);
      const u = rerolled(`${seed}-hu-${i}`, frame, fps, 5);
      ctx.fillStyle = withAlpha(palette.textBright, 0.85);
      ctx.fillRect(inset + v * (iw - 8), inset + u * (ih - 8), 8, 8);
    }
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
