import * as THREE from "three/webgpu";

/**
 * A square with rounded corners, centred on the origin.
 *
 * The neon highlight traces this outline, so the corner arcs are tessellated
 * finely: `ExtrudeGeometry` emits a non-indexed mesh and three then gives every
 * triangle a flat face normal, which would otherwise band the highlight into
 * visible facets as it sweeps around a corner.
 */
const roundedSquare = (half: number, radius: number): THREE.Shape => {
  const r = Math.min(radius, half);
  const shape = new THREE.Shape();
  shape.moveTo(-half + r, -half);
  shape.lineTo(half - r, -half);
  shape.absarc(half - r, -half + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(half, half - r);
  shape.absarc(half - r, half - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-half + r, half);
  shape.absarc(-half + r, half - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-half, -half + r);
  shape.absarc(-half + r, -half + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
};

export type PlateGeometryOptions = {
  /** Half the edge length of the square. */
  half: number;
  cornerRadius: number;
  /** Thickness of the slab, which becomes the visible wall between layers. */
  depth: number;
  /** Width of the chamfer that catches the neon highlight. */
  bevel: number;
  curveSegments?: number;
  bevelSegments?: number;
};

export const createPlateGeometry = ({
  half,
  cornerRadius,
  depth,
  bevel,
  curveSegments = 64,
  bevelSegments = 3,
}: PlateGeometryOptions): THREE.ExtrudeGeometry => {
  const geometry = new THREE.ExtrudeGeometry(
    roundedSquare(half, cornerRadius),
    {
      depth,
      curveSegments,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: 0,
      bevelSegments,
      steps: 1,
    },
  );
  // Extrusion runs 0..depth along +Z; centre it so the stack spacing is exact.
  geometry.translate(0, 0, -depth / 2);
  return geometry;
};
