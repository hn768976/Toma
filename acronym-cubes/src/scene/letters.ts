import type { Font } from "opentype.js";
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLATE_D, PLATE_W } from "./layout";

export const LETTER_DEPTH = 0.35; // visible extrusion above the plate (incl. top bevel)
const BEVEL_T = 0.07;
const BEVEL_S = 0.05;
const LETTER_HEIGHT_SHARE = 0.45; // cap height as share of the plate depth
const FIT_WIDTH_SHARE = 0.85; // long words are scaled to 85% of the plate width

/** opentype path → THREE shapes (y flipped to y-up). */
function pathToShapes(path: opentype.Path): THREE.Shape[] {
  const sp = new THREE.ShapePath();
  for (const c of path.commands) {
    if (c.type === "M") sp.moveTo(c.x, -c.y);
    else if (c.type === "L") sp.lineTo(c.x, -c.y);
    else if (c.type === "Q") sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === "C") sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  // TrueType outer contours are clockwise in y-down → counter-clockwise once flipped.
  return sp.toShapes(false);
}

function roundedBar(cx: number, y0: number, w: number, h: number): THREE.Shape {
  const r = w * 0.45;
  const x0 = cx - w / 2;
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h);
  s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

export type LetterGeometry = {
  geometry: THREE.BufferGeometry; // groups: 0 = front/back caps, 1 = sides & bevel
  capHeight: number;
  width: number;
};

/**
 * Builds the hero word, lying flat on the plate (front faces point up, +Y),
 * reading left-to-right for a camera on +Z looking toward −Z.
 * Local origin: centre of the word's cap box, y = 0 at the letters' base.
 */
export function buildLetters(font: Font, word: string, coinNotches: boolean): LetterGeometry {
  const unitsPerEm = font.unitsPerEm;
  const os2 = (font.tables as Record<string, { sCapHeight?: number }>).os2;
  const capUnits = os2?.sCapHeight || unitsPerEm * 0.7;
  let capHeight = PLATE_D * LETTER_HEIGHT_SHARE;
  let fontSize = (capHeight * unitsPerEm) / capUnits;

  const measure = () => {
    const p = font.getPath(word, 0, 0, fontSize);
    const bb = p.getBoundingBox();
    return { p, bb };
  };
  let { bb } = measure();
  const maxW = PLATE_W * FIT_WIDTH_SHARE;
  if (bb.x2 - bb.x1 > maxW) {
    const k = maxW / (bb.x2 - bb.x1);
    fontSize *= k;
    capHeight *= k;
    ({ bb } = measure());
  }

  const extrude: THREE.ExtrudeGeometryOptions = {
    depth: LETTER_DEPTH - BEVEL_T,
    bevelEnabled: true,
    bevelThickness: BEVEL_T,
    bevelSize: BEVEL_S,
    bevelSegments: 5,
    curveSegments: 14,
  };

  const parts: THREE.BufferGeometry[] = [];
  const glyphs = font.stringToGlyphs(word);
  let x = 0;
  const notchW = capHeight * 0.11;
  const notchH = capHeight * 0.2;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const gp = g.getPath(x, 0, fontSize);
    const shapes = pathToShapes(gp);
    if (shapes.length) parts.push(new THREE.ExtrudeGeometry(shapes, extrude));
    if (coinNotches) {
      // Currency-style strokes: short bars above and below the letter, a touch
      // lower than the letter so the overlapping caps never z-fight.
      const gb = gp.getBoundingBox();
      const cx = (gb.x1 + gb.x2) / 2;
      const top = -gb.y1; // y-up
      const bottom = -gb.y2;
      const bars = [
        roundedBar(cx, top - notchH * 0.35, notchW, notchH),
        roundedBar(cx, bottom - notchH * 0.65, notchW, notchH),
      ];
      parts.push(
        new THREE.ExtrudeGeometry(bars, { ...extrude, depth: (LETTER_DEPTH - BEVEL_T) * 0.82 }),
      );
    }
    const next = glyphs[i + 1];
    const kern = next ? font.getKerningValue(g, next) : 0;
    x += ((g.advanceWidth ?? 0) + kern) * (fontSize / unitsPerEm);
  }

  const merged = concatByMaterial(parts);
  // centre horizontally, centre the cap box vertically (glyph y-up coordinates)
  const cx = (bb.x1 + bb.x2) / 2;
  merged.translate(-cx, -capHeight / 2, 0);
  // lay flat: glyph +Y → world −Z, extrusion +Z → world +Y
  merged.rotateX(-Math.PI / 2);
  // sink the back bevel into the plate
  merged.translate(0, -BEVEL_T, 0);
  const smooth = toCreasedNormals(merged, Math.PI / 4);
  parts.forEach((p) => p.dispose());
  return { geometry: smooth, capHeight, width: bb.x2 - bb.x1 };
}

/**
 * Concatenates ExtrudeGeometries (non-indexed) into one geometry with exactly
 * two groups: 0 = all front/back caps, 1 = all sides and bevels.
 */
function concatByMaterial(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const caps: number[] = [];
  const sides: number[] = [];
  for (const g of parts) {
    const pos = g.getAttribute("position");
    for (const grp of g.groups) {
      const list = grp.materialIndex === 0 ? caps : sides;
      for (let v = grp.start; v < grp.start + grp.count; v++) {
        list.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...caps, ...sides]), 3));
  out.addGroup(0, caps.length / 3, 0);
  out.addGroup(caps.length / 3, sides.length / 3, 1);
  return out;
}
