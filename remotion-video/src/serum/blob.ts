/**
 * Fused blob meshes for look 3.
 *
 * Where spheres merge, the contact has to be a smooth fused surface rather
 * than two intersecting balls with a seam down the join. These are built as a
 * marching-cubes mesh over a smooth-minimum field of the member spheres,
 * generated ONCE at module-evaluation time and afterwards animated as a rigid
 * body. Regenerating per frame would be slow and -- because Remotion renders
 * frames out of order on separate threads -- would drift between threads.
 */
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import type { Member } from './build';

const RESOLUTION = 48;
const ISOLATION = 80;
const SUBTRACT = 12;
const MAX_POLY = 90000;

/**
 * three's metaball field is `strength / d^2 - subtract`, so the isosurface for
 * a single ball sits at `d = sqrt(strength / (isolation + subtract))`. Solving
 * that backwards gives the strength needed for a requested radius, which is
 * what keeps the fused mesh the same size as the spheres it replaces.
 */
const strengthForRadius = (normalisedRadius: number) =>
  normalisedRadius * normalisedRadius * (ISOLATION + SUBTRACT);

export const buildBlobGeometry = (members: Member[]): THREE.BufferGeometry => {
  // Fit the members into the marching-cubes unit cube with margin to spare,
  // then scale the extracted mesh back up. The field lives in 0..1 while the
  // object spans -1..1, so world = local * scale with scale defined here.
  const extent = Math.max(
    ...members.map((m) => Math.hypot(m.offset[0], m.offset[1], m.offset[2]) + m.radius),
  );
  const scale = extent * 1.3;

  const marching = new MarchingCubes(RESOLUTION, new THREE.MeshBasicMaterial(), false, false, MAX_POLY);
  marching.isolation = ISOLATION;
  marching.reset();

  members.forEach((m) => {
    const normalisedRadius = m.radius / (2 * scale);
    marching.addBall(
      0.5 + m.offset[0] / (2 * scale),
      0.5 + m.offset[1] / (2 * scale),
      0.5 + m.offset[2] / (2 * scale),
      strengthForRadius(normalisedRadius),
      SUBTRACT,
    );
  });

  marching.update();

  const vertexCount = marching.count;
  const source = marching.geometry as THREE.BufferGeometry;
  const positions = (source.getAttribute('position').array as Float32Array).slice(0, vertexCount * 3);
  const normals = (source.getAttribute('normal').array as Float32Array).slice(0, vertexCount * 3);

  // Local space is -1..1; multiply back out to world units.
  for (let i = 0; i < positions.length; i++) positions[i] *= scale;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.normalizeNormals();
  geometry.computeBoundingSphere();

  marching.geometry.dispose();
  (marching.material as THREE.Material).dispose();

  return geometry;
};
