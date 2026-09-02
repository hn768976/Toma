import React, { useMemo } from "react";
import { makeSprite, useCanvasDraw } from "@lib/canvas/canvas";
import { irregularDashes } from "@lib/draw/shapes";
import { pick, rndRange } from "@lib/random/seeded";
import { FRAME_H, FRAME_W, LAYOUT, STAGE, type Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { monoFont, sansFont } from "../fonts";
import { drawPanelChrome, smallCaps } from "@lib/draw/panel-chrome";

const GLYPHS = "0123456789".split("");

const digits = (seed: string, n: number) =>
  Array.from({ length: n }, (_, i) => pick(`${seed}-${i}`, GLYPHS)).join("");

/** Dense faint numeric columns down one side of the centre stage. */
const flankColumn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  seed: string,
) => {
  ctx.font = monoFont(400, 19);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const step = 31;
  let row = 0;
  for (let y = top; y < bottom; y += step, row++) {
    ctx.fillStyle = withAlpha(
      row % 9 === 4 ? PALETTE.elementCyan : PALETTE.textPale,
      rndRange(`${seed}-a-${row}`, 0.18, 0.5),
    );
    ctx.fillText(
      `${digits(`${seed}-d-${row}`, 4)} ${digits(`${seed}-e-${row}`, 2)}`,
      x,
      y,
    );
  }
};

/**
 * The frame's own furniture: the ground, the four corner brackets, the
 * hairline rules that divide the major regions, the header band above the
 * centre stage, and the centre stage's bracket frame.
 *
 * Entirely static, so it is rasterised once and blitted. Takes no variant —
 * the centre stage's framing is identical in all three versions because there
 * is only one copy of it, right here.
 */
export const FrameChrome: React.FC = () => {
  const sprite = useMemo(
    () =>
      makeSprite(FRAME_W, FRAME_H, (ctx) => {
        // Ground, with a soft wash lifting the centre-right.
        ctx.fillStyle = PALETTE.bgDeep;
        ctx.fillRect(0, 0, FRAME_W, FRAME_H);
        const wash = ctx.createRadialGradient(
          STAGE.x + STAGE.w / 2,
          STAGE.y + STAGE.h / 2,
          0,
          STAGE.x + STAGE.w / 2,
          STAGE.y + STAGE.h / 2,
          FRAME_W * 0.62,
        );
        wash.addColorStop(0, withAlpha(PALETTE.bgWash, 0.62));
        wash.addColorStop(1, withAlpha(PALETTE.bgWash, 0));
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, FRAME_W, FRAME_H);

        // Hairline rules between the major regions.
        ctx.strokeStyle = withAlpha(PALETTE.panelBorder, 0.42);
        ctx.lineWidth = 1;
        const rules: [number, number, number, number][] = [
          [28, 366, FRAME_W - 28, 366],
          [28, 1348, 2020, 1348],
          [2032, 26, 2032, FRAME_H - 26],
          [3360, 26, 3360, FRAME_H - 26],
          [28, 1888, 2020, 1888],
        ];
        for (const [x1, y1, x2, y2] of rules) {
          ctx.beginPath();
          ctx.moveTo(x1 + 0.5, y1 + 0.5);
          ctx.lineTo(x2 + 0.5, y2 + 0.5);
          ctx.stroke();
        }

        // Corner brackets at the four corners of the frame.
        const M = 26;
        const ARM = 190;
        ctx.strokeStyle = PALETTE.elementDim;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (const [cx, cy, sx, sy] of [
          [M, M, 1, 1],
          [FRAME_W - M, M, -1, 1],
          [M, FRAME_H - M, 1, -1],
          [FRAME_W - M, FRAME_H - M, -1, -1],
        ] as const) {
          ctx.moveTo(cx + sx * ARM, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + sy * ARM);
        }
        ctx.stroke();

        drawHeader(ctx, LAYOUT.header);
        drawStageFrame(ctx);
      }),
    [],
  );

  const ref = useCanvasDraw(FRAME_W, FRAME_H, (ctx) => {
    if (sprite) ctx.drawImage(sprite, 0, 0);
  });

  return (
    <canvas
      ref={ref}
      width={FRAME_W}
      height={FRAME_H}
      style={{ position: "absolute", left: 0, top: 0, width: FRAME_W, height: FRAME_H }}
    />
  );
};

const drawHeader = (ctx: CanvasRenderingContext2D, r: Rect) => {
  smallCaps(ctx, "signal integrity matrix", r.x, r.y + 34, {
    font: sansFont(600, 40),
    color: PALETTE.textBright,
    spacing: "8px",
  });
  smallCaps(ctx, "grid 04 / array c", r.x + r.w, r.y + 34, {
    font: sansFont(500, 28),
    color: PALETTE.textPale,
    align: "right",
    spacing: "5px",
  });

  ctx.strokeStyle = withAlpha(PALETTE.panelBorder, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + 66);
  ctx.lineTo(r.x + r.w, r.y + 66);
  ctx.stroke();

  // A run of irregular ticks under the rule — measurement, not decoration.
  ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.95);
  ctx.lineWidth = 2;
  for (const d of irregularDashes("header-ticks", r.w, 46, 0.15, 1)) {
    ctx.beginPath();
    ctx.moveTo(r.x + d.start, r.y + 72);
    ctx.lineTo(r.x + d.start, r.y + 72 + 10 + d.length * 0.5);
    ctx.stroke();
  }

  ctx.font = monoFont(400, 22);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const cols = 4;
  for (let i = 0; i < 8; i++) {
    const cx = r.x + (r.w / cols) * (i % cols);
    const cy = r.y + 132 + Math.floor(i / cols) * 34;
    ctx.fillStyle = withAlpha(i === 5 ? PALETTE.accentAmber : PALETTE.textPale, 0.8);
    ctx.fillText(
      `${["CHN", "SEQ", "REF", "BUS"][i % 4]} ${digits(`hdr-${i}`, 5)}`,
      cx,
      cy,
    );
  }

  ctx.strokeStyle = withAlpha(PALETTE.panelBorder, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h - 14);
  ctx.lineTo(r.x + r.w, r.y + r.h - 14);
  ctx.stroke();
};

const drawStageFrame = (ctx: CanvasRenderingContext2D) => {
  ctx.save();
  ctx.translate(STAGE.x, STAGE.y);
  drawPanelChrome(ctx, {
    w: STAGE.w,
    h: STAGE.h,
    label: "centre stage / primary",
    labelFont: sansFont(500, 24),
    colors: {
      fill: "rgba(0, 0, 0, 0)",
      border: withAlpha(PALETTE.panelBorder, 0.75),
      tick: withAlpha(PALETTE.elementDim, 0.85),
      labelText: withAlpha(PALETTE.textPale, 0.85),
      labelStrip: "rgba(0, 0, 0, 0)",
    },
    borderWidth: 2,
    cornerTick: 26,
    bracketOnly: true,
  });
  ctx.restore();

  // Faint numeric columns down both margins of the stage. They sit well
  // outside the segment ring at its largest (the v3 radius), so the stage
  // still reads as an open area while never going visually dead.
  const top = STAGE.y + 88;
  const bottom = STAGE.y + STAGE.h - 34;
  flankColumn(ctx, STAGE.x + 24, top, bottom, "flank-l1");
  flankColumn(ctx, STAGE.x + 112, top, bottom, "flank-l2");
  flankColumn(ctx, STAGE.x + STAGE.w - 190, top, bottom, "flank-r1");
  flankColumn(ctx, STAGE.x + STAGE.w - 102, top, bottom, "flank-r2");
};
