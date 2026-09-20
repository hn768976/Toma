import {
  BufferGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { CycloramaSpec, PodiumSpec } from "./spec";

/**
 * The seamless cyclorama: floor -> fillet -> back wall, swept along X.
 *
 * Built by hand rather than from a bent plane so the fillet carries exact
 * analytic normals. Those normals are the whole reason the wall/floor
 * transition reads as one continuous sweep instead of two planes meeting.
 */
export const createCycloramaGeometry = (
  cyc: CycloramaSpec,
): BufferGeometry => {
  const { frontZ, curveStartZ, radius, wallHeight, arcSegments, halfWidth } =
    cyc;

  // Profile in the YZ plane: {y, z} with its outward normal {ny, nz}.
  const profile: { y: number; z: number; ny: number; nz: number }[] = [];

  // Floor, running from the front of the set back to where the fillet starts.
  const floorSegments = 16;
  for (let i = 0; i <= floorSegments; i++) {
    const t = i / floorSegments;
    profile.push({
      y: 0,
      z: frontZ + (curveStartZ - frontZ) * t,
      ny: 1,
      nz: 0,
    });
  }

  // Fillet: a quarter circle centred at (radius, curveStartZ). At theta = 0 it
  // leaves the floor pointing up; at theta = PI/2 it meets the wall facing +Z.
  for (let i = 1; i <= arcSegments; i++) {
    const theta = (i / arcSegments) * (Math.PI / 2);
    profile.push({
      y: radius - radius * Math.cos(theta),
      z: curveStartZ - radius * Math.sin(theta),
      ny: Math.cos(theta),
      nz: Math.sin(theta),
    });
  }

  // Back wall.
  const wallSegments = 12;
  const wallZ = curveStartZ - radius;
  for (let i = 1; i <= wallSegments; i++) {
    const t = i / wallSegments;
    profile.push({
      y: radius + (wallHeight - radius) * t,
      z: wallZ,
      ny: 0,
      nz: 1,
    });
  }

  // Sweep the profile along X. Nothing varies across X, so two spans is plenty
  // - all the shading detail comes from world position in the fragment stage.
  const xSegments = 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < profile.length; i++) {
    const p = profile[i];
    for (let j = 0; j <= xSegments; j++) {
      const x = -halfWidth + (2 * halfWidth * j) / xSegments;
      positions.push(x, p.y, p.z);
      normals.push(0, p.ny, p.nz);
      uvs.push(j / xSegments, i / (profile.length - 1));
    }
  }

  const stride = xSegments + 1;
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < xSegments; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // Counter-clockwise seen from the lit side, so the sweep is front-facing
      // to the camera rather than back-face culled.
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};

/**
 * Disc and cylinder props: a lathed profile with a filleted top edge.
 *
 * The fillet is what produces the soft bright line along the top rim in the
 * references - a hard chamfer or a plain CylinderGeometry loses it.
 */
const createLatheProp = (spec: PodiumSpec): BufferGeometry => {
  const { radius, height, fillet } = spec;
  const r = Math.max(0.0001, Math.min(fillet, height / 2, radius / 2));
  // Ordered from the base upward: LatheGeometry derives its winding from the
  // point order, and bottom-to-top is what puts the normals on the outside.
  const points: Vector2[] = [];
  const steps = 12;
  const base = Math.min(r * 0.35, height * 0.1);

  points.push(new Vector2(0, 0));
  points.push(new Vector2(radius - base, 0));
  points.push(new Vector2(radius, base));
  // Straight side up to the top fillet.
  for (let i = steps; i >= 1; i--) {
    const theta = (i / steps) * (Math.PI / 2);
    points.push(
      new Vector2(
        radius - r + r * Math.sin(theta),
        height - r + r * Math.cos(theta),
      ),
    );
  }
  points.push(new Vector2(radius - r, height));
  points.push(new Vector2(0, height));

  // LatheGeometry derives normals analytically from the profile tangents,
  // which keeps the fillet's highlight smooth; don't overwrite them.
  return new LatheGeometry(points, 256);
};

/** Slab prop: a rounded box, rotated so its near vertical corner is on-axis. */
const createSlabProp = (spec: PodiumSpec): BufferGeometry => {
  const { width, height, depth, fillet } = spec;
  const geometry = new RoundedBoxGeometry(
    width,
    height,
    depth,
    4,
    Math.max(0.001, fillet),
  );
  // RoundedBoxGeometry is centred on the origin; drop it onto the floor.
  geometry.translate(0, height / 2, 0);
  geometry.rotateY((spec.rotationDeg * Math.PI) / 180);
  return geometry;
};

export const createPodiumGeometry = (spec: PodiumSpec): BufferGeometry =>
  spec.kind === "slab" ? createSlabProp(spec) : createLatheProp(spec);
