import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer } from "../layout";
import { THEME } from "../theme";
import {
  ctxOf,
  cycleIndex,
  hLine,
  makeCanvas,
  pick,
  rnd,
  rndInt,
  strokeRect,
} from "../draw/util";
import { HudCanvas } from "./canvas";
import { condensedFont, monoFont } from "../fonts";

const PCT_W = 460;
const PCT_H = 200;
const BOX = { x: 0, y: 32, w: 232, h: 108 };
/** Divides 600 exactly and sits inside the 60-90 frame window. */
const CHANGE_PERIOD = 75;
const MINI_ROWS = 5;

export const measurePercentReadout: Measurer = ({ scale }) => ({
  w: Math.round(PCT_W * scale),
  h: Math.round(PCT_H * scale),
});

export const PercentReadout: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  stroke,
  config,
  width,
  height,
  dimmed,
}) => {
  const strip = useMemo(
    () =>
      `${pick(`${config.seed}-s1`, ["ZAD", "QRL", "VEK", "NOM"] as const)} ${rndInt(`${config.seed}-s2`, 10, 99)} ${rndInt(`${config.seed}-s3`, 1000, 9999)}`,
    [config.seed],
  );

  const chrome = useMemo(() => {
    const canvas = makeCanvas(width, height);
    const ctx = ctxOf(canvas);

    // Label strip above the box.
    ctx.fillStyle = THEME.textDim;
    ctx.font = condensedFont(Math.round(22 * scale), 500);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(strip, 0, Math.round(22 * scale));

    // The mini-table beside the readout.
    const mx = Math.round(258 * scale);
    const mw = Math.round((PCT_W - 258) * scale);
    ctx.strokeStyle = THEME.dim;
    ctx.lineWidth = stroke.structure;
    hLine(ctx, mx, mx + mw, BOX.y * scale);
    hLine(ctx, mx, mx + mw, (BOX.y + BOX.h) * scale);

    ctx.font = monoFont(Math.round(15 * scale));
    for (let r = 0; r < MINI_ROWS; r++) {
      const y = Math.round((BOX.y + 12) * scale) + r * Math.round(19 * scale) + Math.round(14 * scale);
      ctx.textAlign = "left";
      ctx.fillStyle = THEME.textDim;
      ctx.globalAlpha = 0.65;
      ctx.fillText(
        `${pick(`${config.seed}-ml-${r}`, ["AX", "LM", "QT", "VR", "PD", "CU"] as const)}${rndInt(`${config.seed}-mn-${r}`, 10, 99)}`,
        mx,
        y,
      );
    }
    ctx.globalAlpha = 1;

    // Small strip below the box.
    ctx.font = monoFont(Math.round(16 * scale));
    ctx.textAlign = "left";
    ctx.fillStyle = THEME.textDim;
    ctx.globalAlpha = 0.75;
    ctx.fillText(
      `PQ ${rndInt(`${config.seed}-b1`, 10, 99)}   PNV ${rndInt(`${config.seed}-b2`, 100, 999)}`,
      0,
      Math.round((BOX.y + BOX.h + 30) * scale),
    );
    ctx.globalAlpha = 1;

    return canvas;
  }, [width, height, scale, stroke, config.seed, strip]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;
    ctx.drawImage(chrome, 0, 0);

    const base = dimmed ? 0.3 : 1;
    const index = cycleIndex(frame, CHANGE_PERIOD, 0);
    const value = rndInt(`${config.seed}-pct-${index}`, 10, 99);
    const sinceChange = frame % CHANGE_PERIOD;
    // Three frames of flash as the value lands, then it settles.
    const flash = [0.32, 1, 0.55][sinceChange] ?? 1;

    ctx.strokeStyle = THEME.mid;
    ctx.lineWidth = sinceChange === 1 ? stroke.emphasis : stroke.structure;
    ctx.globalAlpha = base;
    strokeRect(ctx, BOX.x * scale, BOX.y * scale, BOX.w * scale, BOX.h * scale);

    ctx.globalAlpha = base * flash;
    ctx.fillStyle = THEME.bright;
    ctx.font = monoFont(Math.round(52 * scale), 500);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${value}%`,
      (BOX.x + BOX.w / 2) * scale,
      (BOX.y + BOX.h / 2 + 3) * scale,
    );

    // Mini-table values, rerolling off the same clock at staggered phases.
    const mx = Math.round(258 * scale);
    const mw = Math.round((PCT_W - 258) * scale);
    ctx.font = monoFont(Math.round(15 * scale));
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    for (let r = 0; r < MINI_ROWS; r++) {
      const idx = cycleIndex(frame, 150, r * 47);
      const y = Math.round((BOX.y + 12) * scale) + r * Math.round(19 * scale) + Math.round(14 * scale);
      ctx.globalAlpha = base * (rnd(`${config.seed}-ma-${r}`) < 0.3 ? 0.95 : 0.6);
      ctx.fillStyle = THEME.textWhite;
      ctx.fillText(
        String(rndInt(`${config.seed}-mv-${r}-${idx}`, 0, 999)).padStart(3, "0"),
        mx + mw,
        y,
      );
    }

    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
