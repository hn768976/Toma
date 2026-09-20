import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A centred rounded rectangle. Corners are true circular arcs — at the corner
 * radii these pieces use (a third of the short side and up) the difference
 * against a squircle is well under a pixel once the bevel highlight lands on
 * top of it.
 */
export const roundedRectShape = (
  width: number,
  height: number,
  radius: number,
): THREE.Shape => {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();

  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(w, h - r);
  shape.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-w + r, h);
  shape.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w, -h + r);
  shape.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false);

  return shape;
};

/**
 * A thick slab with fully rounded edges — the V2 "card".
 *
 * The bevel is deliberately half the slab depth, which turns the rim into a
 * continuous quarter-round. After merging coincident vertices and recomputing
 * normals, that rim reads as a smooth cylindrical edge and produces the long
 * moving specular streak the reference leans on.
 */
export const createSlabGeometry = (opts: {
  width: number;
  height: number;
  depth: number;
  radius: number;
  curveSegments?: number;
  bevelSegments?: number;
}): THREE.BufferGeometry => {
  const bevel = opts.depth / 2;
  const shape = roundedRectShape(
    opts.width - bevel * 2,
    opts.height - bevel * 2,
    Math.max(0.001, opts.radius - bevel),
  );

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0001,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: opts.bevelSegments ?? 10,
    curveSegments: opts.curveSegments ?? 28,
  });

  geometry.center();
  const merged = mergeVertices(geometry, 1e-4);
  merged.computeVertexNormals();
  geometry.dispose();
  return merged;
};

/**
 * A thin pane with a tiny chamfer — the V1 "sheet of glass".
 *
 * Unlike the slab this keeps its extrude groups intact (0 = the two faces,
 * 1 = the rim), so the caller can hand it two materials and light the edge
 * separately. That edge treatment is what produces the thin saturated line
 * running down every pane in the reference.
 */
export const createPaneGeometry = (opts: {
  width: number;
  height: number;
  depth: number;
  radius: number;
  curveSegments?: number;
}): THREE.BufferGeometry => {
  const bevel = Math.min(opts.depth * 0.3, 0.01);
  const shape = roundedRectShape(
    opts.width - bevel * 2,
    opts.height - bevel * 2,
    Math.max(0.001, opts.radius - bevel),
  );

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: opts.depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: opts.curveSegments ?? 24,
  });

  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * Bends a geometry around the Y axis, as if the slab were wrapped onto a
 * cylinder of radius `1 / curvature`.
 *
 * This is the single biggest contributor to the reference look. A dead-flat
 * metal face reflects a narrow cone of the environment and reads as one flat
 * tone; a gently curved one sweeps through the whole environment gradient
 * across its width, which is where those long bright-to-black bands on each
 * panel come from.
 */
export const bendGeometry = (
  geometry: THREE.BufferGeometry,
  curvature: number,
): THREE.BufferGeometry => {
  if (curvature === 0) {
    return geometry;
  }
  const radius = 1 / curvature;
  const position = geometry.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const theta = x * curvature;
    const r = radius + z;
    position.setX(i, r * Math.sin(theta));
    position.setZ(i, r * Math.cos(theta) - radius);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};
