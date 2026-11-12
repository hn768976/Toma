import * as THREE from "three";

/** World-space height of a pin at scale 1 (tip on the ground → top of head). */
export const PIN_HEIGHT = 0.7;

/**
 * Classic map-marker silhouette (round head tapering to a point) with a
 * round hole, extruded and bevelled so it reads as a glossy 3D object.
 * Origin = tip of the pin, +Y up, centred in depth.
 */
export const createPinGeometry = () => {
  const R = 0.46; // head radius
  const cy = 1.42; // head centre height above the tip (tall teardrop)
  const phi = Math.asin(R / cy); // tangent angle
  const shape = new THREE.Shape();
  const tipRound = 0.06;
  shape.moveTo(-tipRound * 0.6, tipRound);
  shape.quadraticCurveTo(0, -0.01, tipRound * 0.6, tipRound);
  // right tangent point
  shape.lineTo(R * Math.cos(-phi), cy + R * Math.sin(-phi));
  shape.absarc(0, cy, R, -phi, Math.PI + phi, false);
  shape.lineTo(-tipRound * 0.6, tipRound);

  const hole = new THREE.Path();
  hole.absarc(0, cy, 0.2, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const depth = 0.12;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.045,
    bevelSegments: 6,
    curveSegments: 40,
  });
  geo.translate(0, 0.07, -depth / 2);
  const s = PIN_HEIGHT / (cy + R + 0.07);
  geo.scale(s, s, s);
  geo.computeVertexNormals();
  return geo;
};

/** Glossy white inlay that fills the pin's hole (reads as the marker "dot"). */
export const createPinDotGeometry = () => {
  const R = 0.46;
  const cy = 1.42;
  const s = PIN_HEIGHT / (cy + R + 0.07);
  // thinner than the pin body so it reads as a recessed dimple
  const geo = new THREE.CylinderGeometry(0.17, 0.17, 0.1, 40);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, cy + 0.07, 0);
  geo.scale(s, s, s);
  return geo;
};
