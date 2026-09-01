import React, { useLayoutEffect, useMemo, useRef } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY, fontsReady } from "../fonts";
import {
  BRACKET_ARM,
  BRACKET_BOX,
  BRACKET_STROKE,
  HEIGHT,
  LABEL_BASELINE_Y,
  LABEL_FONT_SIZE,
  LABEL_LETTER_SPACING,
  LABEL_RIGHT_X,
  LABEL_RULE_WIDTH,
  TIMING,
  WIDTH,
} from "../layout";
import type { Variant } from "../variants";
import { drawTrackedText, withAlpha } from "../util";

const MARGIN = 40;
const BUFFER_X = BRACKET_BOX.left - MARGIN;
const BUFFER_Y = BRACKET_BOX.top - MARGIN;
const BUFFER_WIDTH = BRACKET_BOX.right - BRACKET_BOX.left + MARGIN * 2;
const BUFFER_HEIGHT = BRACKET_BOX.bottom - BRACKET_BOX.top + MARGIN * 2;

/**
 * Corner brackets and a few dashed rules, loosely framing the central group.
 * Never a complete box - the edges are implied, not drawn.
 */
const drawBrackets = (ctx: CanvasRenderingContext2D, textPale: string): void => {
  const left = BRACKET_BOX.left - BUFFER_X;
  const top = BRACKET_BOX.top - BUFFER_Y;
  const right = BRACKET_BOX.right - BUFFER_X;
  const bottom = BRACKET_BOX.bottom - BUFFER_Y;

  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.lineWidth = BRACKET_STROKE;
  ctx.strokeStyle = withAlpha(textPale, 0.55);

  const corners = [
    { x: left, y: top, dx: 1, dy: 1 },
    { x: right, y: top, dx: -1, dy: 1 },
    { x: right, y: bottom, dx: -1, dy: -1 },
    { x: left, y: bottom, dx: 1, dy: -1 },
  ];
  for (const c of corners) {
    ctx.beginPath();
    ctx.moveTo(c.x + c.dx * BRACKET_ARM, c.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c.x, c.y + c.dy * BRACKET_ARM);
    ctx.stroke();
  }

  // Dashed runs that stop well short of the corners.
  ctx.strokeStyle = withAlpha(textPale, 0.3);
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 18]);
  const runs: [number, number, number, number][] = [
    [left + BRACKET_ARM + 60, top, left + BRACKET_ARM + 660, top],
    [right - BRACKET_ARM - 60, bottom, right - BRACKET_ARM - 720, bottom],
    [left, top + BRACKET_ARM + 40, left, top + BRACKET_ARM + 300],
    [right, bottom - BRACKET_ARM - 40, right, bottom - BRACKET_ARM - 260],
  ];
  for (const [x0, y0, x1, y1] of runs) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // A pair of tick marks that read as measurement marks on the edge.
  ctx.strokeStyle = withAlpha(textPale, 0.45);
  ctx.lineWidth = 3;
  for (const [x, y, len] of [
    [left + BRACKET_ARM + 700, top, 26],
    [left + BRACKET_ARM + 740, top, 14],
    [right - BRACKET_ARM - 760, bottom, -26],
    [right - BRACKET_ARM - 800, bottom, -14],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
};

type Props = { variant: Variant };

export const FrameBrackets: React.FC<Props> = ({ variant }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { palette, label } = variant;

  const buffer = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = BUFFER_WIDTH;
    canvas.height = BUFFER_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    drawBrackets(ctx, palette.textPale);
    return canvas;
  }, [palette.textPale]);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const paint = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const bracketAlpha = interpolate(frame, TIMING.bracketsFadeIn, [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      if (buffer && bracketAlpha > 0) {
        ctx.globalAlpha = bracketAlpha;
        ctx.drawImage(buffer, BUFFER_X, BUFFER_Y);
        ctx.globalAlpha = 1;
      }

      const labelAlpha = interpolate(frame, TIMING.labelFadeIn, [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      if (labelAlpha <= 0) return;

      ctx.globalAlpha = labelAlpha;
      ctx.font = `300 ${LABEL_FONT_SIZE}px "${FONT_FAMILY}", sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = palette.textPale;
      drawTrackedText(
        ctx,
        label.toUpperCase(),
        LABEL_RIGHT_X,
        LABEL_BASELINE_Y,
        LABEL_LETTER_SPACING,
        "right",
      );

      ctx.strokeStyle = withAlpha(palette.textPale, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(LABEL_RIGHT_X - LABEL_RULE_WIDTH, LABEL_BASELINE_Y + 28);
      ctx.lineTo(LABEL_RIGHT_X, LABEL_BASELINE_Y + 28);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    paint();
    let cancelled = false;
    fontsReady.then(() => {
      if (!cancelled) paint();
    });
    return () => {
      cancelled = true;
    };
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
    />
  );
};
