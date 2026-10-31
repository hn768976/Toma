import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import type { Pt } from "./math";

const gen = rough.generator();

// Rough.js drawable -> one Path2D (stroked paths) + one Path2D (fills).
export const roughToPath2D = (drawable: ReturnType<typeof gen.curve>) => {
  const stroke = new Path2D();
  const fill = new Path2D();
  for (const info of gen.toPaths(drawable)) {
    if (info.fill && info.fill !== "none") fill.addPath(new Path2D(info.d));
    else stroke.addPath(new Path2D(info.d));
  }
  return { stroke, fill };
};

export const roughCurve = (pts: Pt[], o: Options) =>
  roughToPath2D(gen.curve(pts, { stroke: "#fff", ...o })).stroke;

export const roughLinear = (pts: Pt[], o: Options) =>
  roughToPath2D(gen.linearPath(pts, { stroke: "#fff", ...o })).stroke;

// Rough.js fill only (hachure / zigzag lines come back as stroked paths).
export const roughFill = (pts: Pt[], o: Options) =>
  roughToPath2D(gen.polygon(pts, { stroke: "none", fill: "#fff", ...o })).stroke;

export { gen as roughGenerator };
