import React, { useMemo } from "react";
import * as shape from "./shapes";
import type { ShapeArgs } from "./shapes";
import type { MarkOpts, MarkSpec, MarkType, Palette } from "./types";

/** Room around a sprite for stroke overhang. */
const PAD = 40;

/** Sizes are bucketed so marks of near-identical size share one sprite. */
const bracket = (v: number) => Math.max(2, Math.round(v / 10) * 10);

export type SpriteSpec = {
  key: string;
  type: MarkType;
  w: number;
  h: number;
  color: string;
  opts: MarkOpts;
};

export type SpriteRegistry = React.RefObject<Record<string, HTMLCanvasElement>>;

export const spriteFor = (
  spec: MarkSpec,
  palette: Palette,
  pitch: number,
): SpriteSpec => {
  const w = bracket(spec.wc * pitch);
  const h = bracket(spec.hc * pitch);
  const color = palette[spec.tone];
  const opts = spec.opts ?? {};
  const key = `${spec.type}|${w}x${h}|${color}|${JSON.stringify(opts)}`;
  return { key, type: spec.type, w, h, color, opts };
};

/**
 * One component, one switch — not fifteen components. It renders the shape
 * that matches its type name once, into an offscreen sprite canvas, and
 * publishes it to the field's registry. Nothing here depends on the frame.
 */
export const Mark: React.FC<{
  sprite: SpriteSpec;
  palette: Palette;
  stroke: number;
  registry: SpriteRegistry;
}> = ({ sprite, palette, stroke, registry }) => {
  useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = sprite.w + PAD * 2;
    canvas.height = sprite.h + PAD * 2;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.translate(PAD, PAD);
    ctx.strokeStyle = sprite.color;
    ctx.fillStyle = sprite.color;
    ctx.lineWidth = stroke;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    const args: ShapeArgs = {
      ctx,
      w: sprite.w,
      h: sprite.h,
      color: sprite.color,
      palette,
      stroke,
      opts: sprite.opts,
      seed: sprite.key,
    };

    switch (sprite.type) {
      case "cornerBracket":
        shape.cornerBracket(args);
        break;
      case "cropMark":
        shape.cropMark(args);
        break;
      case "dotColumn":
        shape.dotColumn(args);
        break;
      case "chevron":
        shape.chevron(args);
        break;
      case "diagonalPair":
        shape.diagonalPair(args);
        break;
      case "crossedX":
        shape.crossedX(args);
        break;
      case "arc":
        shape.arc(args);
        break;
      case "squarePanel":
        shape.squarePanel(args);
        break;
      case "tickRow":
        shape.tickRow(args);
        break;
      case "circleOutline":
        shape.circleOutline(args);
        break;
      case "dash":
        shape.dash(args);
        break;
      case "registrationTarget":
        shape.registrationTarget(args);
        break;
      case "colourBar":
        shape.colourBar(args);
        break;
    }

    // Children render before any parent effect runs, so the field is
    // guaranteed to find every sprite when it composites.
    registry.current[sprite.key] = canvas;
    return canvas;
  }, [sprite, palette, stroke, registry]);

  return null;
};
