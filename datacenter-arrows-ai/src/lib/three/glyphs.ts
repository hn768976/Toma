/**
 * Extruded text geometry from a parsed OpenType font (Montserrat ExtraBold),
 * built with opentype.js outlines -> THREE.ShapePath -> ExtrudeGeometry.
 */
import type { Font } from "opentype.js";
import * as THREE from "three";

export const textShapes = (font: Font, text: string, size: number) => {
  const path = font.getPath(text, 0, 0, size);
  const sp = new THREE.ShapePath();
  // opentype is y-down; flip to y-up
  for (const c of path.commands) {
    switch (c.type) {
      case "M":
        sp.moveTo(c.x, -c.y);
        break;
      case "L":
        sp.lineTo(c.x, -c.y);
        break;
      case "Q":
        sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
        break;
      case "C":
        sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
        break;
      case "Z":
        if (sp.currentPath) sp.currentPath.autoClose = true;
        break;
    }
  }
  return sp.toShapes();
};

export const extrudedText = (
  font: Font,
  text: string,
  opts: { size: number; depth: number; bevel: number; curveSegments?: number },
) => {
  const shapes = textShapes(font, text, opts.size);
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: opts.depth,
    bevelEnabled: opts.bevel > 0,
    bevelThickness: opts.bevel,
    bevelSize: opts.bevel * 0.8,
    bevelSegments: 4,
    curveSegments: opts.curveSegments ?? 10,
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  // centre in x/y, base of the extrusion at z = 0
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -bb.min.z);
  geo.computeVertexNormals();
  return geo;
};
