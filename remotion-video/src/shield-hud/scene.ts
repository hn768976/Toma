import { createContext, useContext } from "react";
import { HEIGHT, WIDTH } from "./constants";
import type { Buffers, Layer } from "./buffers";
import { planeMatrix, type Matrix, type Point } from "./geometry";
import type { GlyphGeometry } from "./paths";
import type { ReadoutModel } from "./readout-model";
import type { Sweep } from "./sweep";
import type { Palette, Variant } from "./variants";

export type Bracket = { x: number; y: number; flipX: number; flipY: number; size: number };

export type Layout = {
  glyphCentre: Point;
  glyphHeight: number;
  columnTop: number;
  accentBars: { x: number; y: number; width: number; height: number; label: string }[];
  brackets: Bracket[];
  logStrip: { x: number; y: number; width: number; height: number; rowHeight: number };
};

export const buildLayout = (variant: Variant): Layout => {
  const glyphCentre = { x: WIDTH * 0.43, y: HEIGHT * 0.5 };
  const glyphHeight = HEIGHT * variant.glyph.heightRatio;
  const rows = variant.panelDensity.rows;
  const gap = variant.panelDensity.rowGap;
  const bracketX = glyphHeight * 0.62;
  const bracketY = glyphHeight * 0.62;

  return {
    glyphCentre,
    glyphHeight,
    columnTop: HEIGHT * 0.5 - ((rows - 1) * gap) / 2,
    accentBars: [
      {
        x: glyphCentre.x - 640,
        y: glyphCentre.y - glyphHeight * 0.78 - 60,
        width: 1290,
        height: 52,
        label: "SEC LAYER SYNC  //  NODE 0x4C  //  CHANNEL STABLE",
      },
      {
        x: glyphCentre.x - 560,
        y: glyphCentre.y + glyphHeight * 0.78 + 30,
        width: 1400,
        height: 46,
        label: "INTEGRITY TRACE  //  BUS 12  //  HANDSHAKE OK",
      },
    ],
    brackets: [
      { x: glyphCentre.x - bracketX, y: glyphCentre.y - bracketY, flipX: 1, flipY: 1, size: 130 },
      { x: glyphCentre.x + bracketX, y: glyphCentre.y - bracketY, flipX: -1, flipY: 1, size: 130 },
      { x: glyphCentre.x - bracketX, y: glyphCentre.y + bracketY, flipX: 1, flipY: -1, size: 130 },
      { x: glyphCentre.x + bracketX, y: glyphCentre.y + bracketY, flipX: -1, flipY: -1, size: 130 },
      { x: glyphCentre.x - bracketX * 1.5, y: glyphCentre.y, flipX: 1, flipY: 1, size: 74 },
      { x: glyphCentre.x + bracketX * 1.42, y: glyphCentre.y - 90, flipX: -1, flipY: 1, size: 74 },
    ],
    // Sits low and left, where the tilt pushes the plane down — any lower
    // and the strip walks off the bottom of the frame.
    logStrip: { x: 700, y: 1500, width: 1500, height: 220, rowHeight: 44 },
  };
};

export type Scene = {
  frame: number;
  variant: Variant;
  palette: Palette;
  buffers: Buffers;
  drift: Point;
  geometry: GlyphGeometry;
  sweep: Sweep;
  readouts: ReadoutModel;
  layout: Layout;
  seed: string;
  /** Glow breathing multiplier, +/-10% on a sine. */
  breath: number;
};

export const SceneContext = createContext<Scene | null>(null);

export const useScene = (): Scene => {
  const scene = useContext(SceneContext);
  if (!scene) throw new Error("A HUD element was rendered outside <ShieldHud>");
  return scene;
};

/**
 * Runs `draw` with the layer's context already sitting on the tilted plane.
 * Every element in the piece goes through here, which is what keeps them all
 * on the same surface.
 */
export const onPlaneCtx = (
  ctx: CanvasRenderingContext2D,
  drift: Point,
  scale: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) => {
  ctx.save();
  const m: Matrix = planeMatrix(drift, scale);
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.globalCompositeOperation = "lighter";
  draw(ctx);
  ctx.restore();
};

export const onPlane = (
  layer: Layer,
  drift: Point,
  draw: (ctx: CanvasRenderingContext2D) => void,
) => onPlaneCtx(layer.ctx, drift, layer.scale, draw);

export const rgba = (hex: string, alpha: number) => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
