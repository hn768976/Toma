import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer } from "../layout";
import { THEME } from "../theme";
import type { StrokeSet } from "../theme";
import { circle, ctxOf, dot, line, loopPhase, makeCanvas } from "../draw/util";
import { HudCanvas } from "./canvas";

const RET_R = 180;
export const RETICLE_BOX = 480;
const DASHES = 8;
/** The dashed ring's symmetry period, in degrees. */
const SYMMETRY = 360 / DASHES;
const PERIODS = 8;

export const measureReticle: Measurer = ({ scale }) => ({
  w: Math.round(RETICLE_BOX * scale),
  h: Math.round(RETICLE_BOX * scale),
});

const renderStatic = (size: number, scale: number, stroke: StrokeSet) => {
  const canvas = makeCanvas(size, size);
  const ctx = ctxOf(canvas);
  const c = size / 2;
  const r = RET_R * scale;

  ctx.strokeStyle = THEME.mid;
  ctx.lineWidth = stroke.structure;
  circle(ctx, c, c, r * 0.52);

  ctx.fillStyle = THEME.bright;
  dot(ctx, c, c, 5 * scale);

  // Four cardinal ticks, extending beyond the outer ring.
  ctx.strokeStyle = THEME.mid;
  ctx.lineWidth = stroke.emphasis;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    line(ctx, c + cos * r * 1.04, c + sin * r * 1.04, c + cos * r * 1.3, c + sin * r * 1.3);
  }

  return canvas;
};

export const Reticle: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  stroke,
  width,
  height,
  dimmed,
}) => {
  const size = Math.round(RETICLE_BOX * scale);
  const chrome = useMemo(
    () => renderStatic(size, scale, stroke),
    [size, scale, stroke],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;
    ctx.drawImage(chrome, 0, 0);

    const c = size / 2;
    const r = RET_R * scale;
    const angle = PERIODS * SYMMETRY * loopPhase(frame) * (Math.PI / 180);

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    ctx.strokeStyle = THEME.bright;
    ctx.lineWidth = stroke.emphasis;
    const step = (Math.PI * 2) / DASHES;
    for (let i = 0; i < DASHES; i++) {
      const a0 = i * step;
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a0 + step * 0.34);
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
