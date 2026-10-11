import * as THREE from "three";
import { FONT_FAMILY } from "./fonts";

/** A white glyph (N, S, +, U+2212) centred on a square transparent canvas texture. */
export const glyphTexture = (ch: string, sizePx = 512, color = "#ffffff") => {
  const c = document.createElement("canvas");
  c.width = c.height = sizePx;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.font = `600 ${Math.round(sizePx * 0.8)}px "${FONT_FAMILY}"`;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  const m = g.measureText(ch);
  const w = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const x = (sizePx - w) / 2 + m.actualBoundingBoxLeft;
  const y = (sizePx - h) / 2 + m.actualBoundingBoxAscent;
  g.fillText(ch, x, y);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
};
