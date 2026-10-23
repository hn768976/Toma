import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// A sculpted keycap: rounded-square footprint, tapering towards the top,
// with the top face nudged slightly backwards like a real cylindrical-row cap.
export const KEY_BASE = 0.96;
export const KEY_TOP_SCALE = 0.75;
export const KEY_HEIGHT = 0.62;
const BEVEL = 0.09;

const roundedSquare = (size: number, radius: number) => {
  const s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s + radius, -s);
  shape.lineTo(s - radius, -s);
  shape.quadraticCurveTo(s, -s, s, -s + radius);
  shape.lineTo(s, s - radius);
  shape.quadraticCurveTo(s, s, s - radius, s);
  shape.lineTo(-s + radius, s);
  shape.quadraticCurveTo(-s, s, -s, s - radius);
  shape.lineTo(-s, -s + radius);
  shape.quadraticCurveTo(-s, -s, -s + radius, -s);
  return shape;
};

export const createKeycapGeometry = () => {
  const inner = KEY_BASE - BEVEL * 2;
  const geo = new THREE.ExtrudeGeometry(roundedSquare(inner, 0.1), {
    depth: KEY_HEIGHT - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 12,
    curveSegments: 16,
  });
  // Extrusion runs along +z from -BEVEL to depth+BEVEL. Taper with height.
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const zMin = -BEVEL;
  const zMax = KEY_HEIGHT - BEVEL;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp((v.z - zMin) / (zMax - zMin), 0, 1);
    const k = THREE.MathUtils.lerp(1, KEY_TOP_SCALE, Math.pow(t, 0.9));
    v.x *= k;
    v.y = v.y * k + t * 0.035;
    v.z -= zMin;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // Extrusion z -> world +y, shape +y -> world -z (towards the back).
  geo.rotateX(-Math.PI / 2);
  // Extrusions are unindexed; weld them so the rounded bevels shade smoothly
  // instead of showing flat facets.
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const smooth = mergeVertices(geo, 1e-4);
  smooth.computeVertexNormals();
  return smooth;
};

// World-space height of the flat top face and its centre offset (towards back).
export const KEY_TOP_Y = KEY_HEIGHT;
export const KEY_TOP_Z = -0.035;
export const KEY_TOP_SIZE = (KEY_BASE - BEVEL * 2) * KEY_TOP_SCALE;
