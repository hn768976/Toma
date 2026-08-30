import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer } from "../layout";
import { THEME } from "../theme";
import { ctxOf, cycleIndex, makeCanvas } from "../draw/util";
import { buildSkeleton, codeLine } from "../draw/codegen";
import type { Skeleton } from "../draw/codegen";
import { HudCanvas } from "./canvas";
import { monoFont } from "../fonts";

/** Roboto Mono's advance width, used to size the panel from its column count. */
const ADVANCE = 0.6;

const dims = (config: { lines?: number; cols?: number; fontSize?: number; leading?: number }) => ({
  lines: config.lines ?? 20,
  cols: config.cols ?? 60,
  fontSize: config.fontSize ?? 16,
  leading: config.leading ?? 30,
});

export const measureCodePanel: Measurer = ({ config, scale }) => {
  const d = dims(config);
  return {
    w: Math.round(d.cols * d.fontSize * ADVANCE * scale),
    h: Math.round(d.lines * d.leading * scale),
  };
};

const lineText = (skel: Skeleton, seed: string, index: number, contentIndex: number, cols: number) =>
  codeLine(skel.kind, skel.indent, `${seed}-L${index}-C${contentIndex}`, cols);

export const CodePanel: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  config,
  width,
  height,
  dimmed,
}) => {
  const d = dims(config);
  const fontSize = Math.round(d.fontSize * scale);
  const leading = d.leading * scale;

  const skeleton = useMemo(
    () => buildSkeleton(config.seed, d.lines),
    [config.seed, d.lines],
  );

  // Lines that never change are drawn once and blitted; only the live lines
  // are re-rendered per frame.
  const chrome = useMemo(() => {
    const canvas = makeCanvas(width, height);
    const ctx = ctxOf(canvas);
    ctx.font = monoFont(fontSize);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    skeleton.forEach((skel, i) => {
      if (skel.period !== 0 || skel.kind === "blank") {
        return;
      }
      ctx.globalAlpha = skel.alpha;
      ctx.fillStyle = skel.alpha > 0.8 ? THEME.textWhite : THEME.textDim;
      ctx.fillText(lineText(skel, config.seed, i, 0, d.cols), 0, i * leading + fontSize);
    });
    return canvas;
  }, [skeleton, width, height, fontSize, leading, config.seed, d.cols]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;
    ctx.drawImage(chrome, 0, 0);

    ctx.font = monoFont(fontSize);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const base = dimmed ? 0.3 : 1;

    skeleton.forEach((skel, i) => {
      if (skel.period === 0 || skel.kind === "blank") {
        return;
      }
      const contentIndex = cycleIndex(frame, skel.period, skel.phase);
      ctx.globalAlpha = skel.alpha * base;
      ctx.fillStyle = skel.alpha > 0.8 ? THEME.textWhite : THEME.textDim;
      ctx.fillText(
        lineText(skel, config.seed, i, contentIndex, d.cols),
        0,
        i * leading + fontSize,
      );
    });

    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
