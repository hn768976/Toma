import * as THREE from "three";

// A procedural wide-body airliner, built from primitives and merged into a
// single position-only BufferGeometry.
//
// Both references render the aircraft as a flat white silhouette with no
// visible shading, so the mesh only ever needs to be correct in outline —
// hence no normals, no UVs, and an unlit double-sided material.
//
// Local frame: nose along +Z, right wing along +X, cabin roof along +Y.
// Wingspan 30 units, length 22 units.

// Concatenates the position streams of several geometries. Cheaper and
// less fragile than BufferGeometryUtils.mergeGeometries when normals and
// UVs are not wanted in the first place.
const mergePositions = (parts: THREE.BufferGeometry[]) => {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let total = 0;
  for (const p of flat) total += p.getAttribute("position").array.length;

  const merged = new Float32Array(total);
  let offset = 0;
  for (let i = 0; i < flat.length; i++) {
    const arr = flat[i].getAttribute("position").array as Float32Array;
    merged.set(arr, offset);
    offset += arr.length;
    if (flat[i] !== parts[i]) flat[i].dispose();
    parts[i].dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(merged, 3));
  return geo;
};

// Where a flat extruded shape's own axes land in world space. The shape is
// drawn in (u, v) and extruded through its thickness (w); makeBasis takes
// the columns, so each argument is the world direction of local X, Y, Z.
//
// A planform is drawn in span/chord, so its thickness becomes world Y and
// its chord becomes world Z.
const PLANFORM = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 1, 0),
);

// A profile is drawn in length/height, so its length becomes world Z and
// its thickness becomes world X.
const PROFILE = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(1, 0, 0),
);

const flatPanel = (
  outline: [number, number][],
  thickness: number,
  transform: THREE.Matrix4,
  offset: THREE.Vector3,
) => {
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    shape.lineTo(outline[i][0], outline[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.applyMatrix4(transform);
  geo.translate(offset.x, offset.y, offset.z);
  return geo;
};

// Right-hand wing planform, in (span, chord). +chord is toward the nose,
// so the leading edge sweeping to lower values is sweep-back.
const WING: [number, number][] = [
  [1.1, 3.2],
  [4.5, 1.9],
  [15.0, -4.2],
  [15.0, -5.6],
  [5.0, -3.4],
  [1.1, -3.6],
];

const STABILISER: [number, number][] = [
  [0.5, -6.2],
  [5.6, -8.7],
  [5.6, -9.7],
  [0.5, -9.4],
];

// Fin profile in (length, height).
const FIN: [number, number][] = [
  [-6.3, 0.8],
  [-8.9, 5.7],
  [-10.3, 5.7],
  [-10.4, 0.8],
];

// Fuselage lathe profile: (radius, z). Blunt nose at +Z, tapered tail at -Z.
const FUSELAGE: [number, number][] = [
  [0.06, -11.0],
  [0.55, -9.2],
  [0.92, -7.0],
  [1.12, -4.0],
  [1.15, 0.0],
  [1.15, 4.5],
  [1.05, 7.6],
  [0.72, 9.8],
  [0.3, 10.7],
  [0.03, 11.0],
];

const mirrorX = (geo: THREE.BufferGeometry) => {
  const clone = geo.clone();
  clone.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  return clone;
};

const nacelle = (x: number) => {
  const pod = new THREE.CylinderGeometry(0.86, 0.72, 3.9, 12);
  pod.rotateX(Math.PI / 2);
  pod.translate(x, -1.55, 1.3);
  const pylon = new THREE.BoxGeometry(0.34, 1.3, 2.1);
  pylon.translate(x, -0.85, 0.4);
  return [pod, pylon];
};

export const buildAirlinerGeometry = (): THREE.BufferGeometry => {
  const fuselage = new THREE.LatheGeometry(
    FUSELAGE.map(([r, z]) => new THREE.Vector2(r, z)),
    14,
  );
  // Lathe spins around +Y; swing it so the profile's height axis becomes
  // the aircraft's longitudinal axis.
  fuselage.rotateX(Math.PI / 2);

  const rightWing = flatPanel(
    WING,
    0.34,
    PLANFORM,
    new THREE.Vector3(0, -0.35, 0),
  );
  const rightStab = flatPanel(
    STABILISER,
    0.26,
    PLANFORM,
    new THREE.Vector3(0, 0.15, 0),
  );
  const fin = flatPanel(FIN, 0.3, PROFILE, new THREE.Vector3(0, 0, 0));

  return mergePositions([
    fuselage,
    rightWing,
    mirrorX(rightWing),
    rightStab,
    mirrorX(rightStab),
    fin,
    ...nacelle(6.4),
    ...nacelle(-6.4),
  ]);
};
