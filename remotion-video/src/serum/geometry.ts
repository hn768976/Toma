/**
 * Shared geometry.
 *
 * three's IcosahedronGeometry is non-indexed and carries FLAT face normals.
 * Refraction is driven almost entirely by the surface normal, so flat normals
 * make a transmissive sphere break into a radial fan of facets rather than
 * bending light smoothly. For a unit sphere the correct smooth normal is just
 * the normalised position, so they are rewritten here.
 */
import * as THREE from 'three';

export const smoothIcosphere = (detail: number): THREE.IcosahedronGeometry => {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const position = geometry.getAttribute('position');
  const normals = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const inv = 1 / Math.hypot(x, y, z);
    normals[i * 3] = x * inv;
    normals[i * 3 + 1] = y * inv;
    normals[i * 3 + 2] = z * inv;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
};
