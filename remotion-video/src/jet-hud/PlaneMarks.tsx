import React, { useLayoutEffect, useMemo } from "react";
import { withAlpha } from "../lib/color";
import { FONT_CONDENSED } from "./fonts";
import { fieldLabel, readoutValue } from "./hud-content";
import {
  drawCornerBracket,
  drawCrosshair,
  irregularDashes,
  tickRing,
} from "../lib/marks";
import { rndInt, rndRange } from "../lib/seeded";
import type { HudPlane } from "./hud-plane";

/**
 * Scattered crosshairs, corner brackets, short dashed rules and one tick ring.
 * These are the marks that stop the plane reading as a grid of boxes. Their
 * positions are seeded once and fixed; they are anchored like the panels.
 */

type Mark =
  | { kind: "cross"; x: number; y: number; r: number; accent: boolean }
  | {
      kind: "bracket";
      x: number;
      y: number;
      w: number;
      h: number;
      label: boolean;
    }
  | { kind: "dash"; x: number; y: number; len: number; vertical: boolean }
  | { kind: "ring"; x: number; y: number; r: number };

export const PlaneMarks: React.FC<{
  plane: HudPlane;
  frame: number;
  seed: string;
}> = ({ plane, frame, seed }) => {
  const dense = plane.variant.density === "high";
  const marks = useMemo<Mark[]>(() => {
    const out: Mark[] = [];
    const n = dense ? 22 : 11;
    for (let i = 0; i < n; i++) {
      const x = rndRange(`${seed}:x:${i}`, -2300, 2300);
      const y = rndRange(`${seed}:y:${i}`, -1500, 1500);
      const roll = rndInt(`${seed}:k:${i}`, 0, 10);
      if (roll < 3)
        out.push({
          kind: "cross",
          x,
          y,
          r: rndRange(`${seed}:r:${i}`, 26, 62),
          accent: rndInt(`${seed}:a:${i}`, 0, 7) === 0,
        });
      else if (roll < 6)
        out.push({
          kind: "bracket",
          x,
          y,
          w: rndRange(`${seed}:w:${i}`, 150, 380),
          h: rndRange(`${seed}:h:${i}`, 90, 230),
          label: rndInt(`${seed}:lb:${i}`, 0, 2) === 0,
        });
      else if (roll < 9)
        out.push({
          kind: "dash",
          x,
          y,
          len: rndRange(`${seed}:l:${i}`, 200, 620),
          vertical: rndInt(`${seed}:v:${i}`, 0, 2) === 0,
        });
      else
        out.push({
          kind: "ring",
          x,
          y,
          r: rndRange(`${seed}:rr:${i}`, 70, 130),
        });
    }
    return out;
  }, [seed, dense]);

  useLayoutEffect(() => {
    const p = plane.variant.palette;

    // A reticle at the plane's origin, i.e. the frame's centre. Unlike the
    // scattered marks this one is not seeded: for the stretch of the loop
    // when the aircraft is offstage the centre of frame would otherwise be
    // empty, and a HUD with nothing in its middle reads as unfinished.
    plane.paint({ u: -520, v: -520, w: 1040, h: 1040 }, (ctx) => {
      tickRing(ctx, 0, 0, 330, 48, 6, p.panelBorder, {
        alpha: 0.72,
        minor: 15,
        major: 34,
      });
      tickRing(ctx, 0, 0, 214, 24, 4, p.panelBorder, {
        alpha: 0.4,
        minor: 9,
        major: 18,
      });
      drawCrosshair(ctx, 0, 0, 168, p.panelBorder, 0.7);
      drawCornerBracket(ctx, -470, -470, 940, 940, 58, p.panelBorder, 0.6);
      ctx.fillStyle = withAlpha(p.textPale, 0.8);
      ctx.font = `500 30px ${FONT_CONDENSED}`;
      ctx.fillText(readoutValue(`${seed}:ret`, frame, 4), -466, -492);
    });

    for (const m of marks) {
      const x = m.x + plane.sway;
      const extent =
        m.kind === "cross"
          ? { u: x - m.r, v: m.y - m.r, w: m.r * 2, h: m.r * 2 }
          : m.kind === "bracket"
            ? { u: x, v: m.y - 60, w: m.w, h: m.h + 60 }
            : m.kind === "dash"
              ? {
                  u: x,
                  v: m.y,
                  w: m.vertical ? 8 : m.len,
                  h: m.vertical ? m.len : 8,
                }
              : { u: x - m.r, v: m.y - m.r, w: m.r * 2, h: m.r * 2 };
      plane.paint(extent, (ctx) => {
        if (m.kind === "cross") {
          const col = m.accent ? p.accent : p.panelBorder;
          drawCrosshair(ctx, x, m.y, m.r, col, m.accent ? 0.9 : 0.55);
        } else if (m.kind === "bracket") {
          drawCornerBracket(ctx, x, m.y, m.w, m.h, 26, p.panelBorder, 0.6);
          if (m.label) {
            ctx.fillStyle = withAlpha(p.textPale, 0.7);
            ctx.font = `500 24px ${FONT_CONDENSED}`;
            ctx.fillText(
              `${fieldLabel(`${seed}:ml:${m.x}`)} ${readoutValue(`${seed}:mv:${m.x}`, frame, 3)}`,
              x + 4,
              m.y - 12,
            );
          }
        } else if (m.kind === "dash") {
          irregularDashes(ctx, x, m.y, m.len, `${seed}:d:${m.x}`, p.gridLine, {
            vertical: m.vertical,
            alpha: 0.7,
          });
        } else {
          tickRing(ctx, x, m.y, m.r, 36, 6, p.panelBorder, { alpha: 0.5 });
        }
      });
      if (m.kind === "cross" && m.accent) {
        drawCrosshair(plane.glow, x, m.y, m.r, p.accent, 0.55);
      }
    }
  });

  return null;
};
