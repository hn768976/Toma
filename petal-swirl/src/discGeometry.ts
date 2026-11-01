import * as THREE from "three";

/**
 * Procedural fluted "swirl rosette" disc.
 *
 * The surface is a polar grid. Each radial flute follows a spiral
 * (phi = theta + twist * u^0.85), the rim is scalloped in sync with the
 * flutes and lifts slightly like a shallow bowl. Normals are computed
 * analytically with central differences so there is no seam at theta = 0.
 */
export type DiscShape = {
  flutes: number;
  twist: number; // radians the flute travels from centre to rim
  depth: number; // flute amplitude relative to radius
  bowl: number; // rim lift relative to radius
  scallop: number; // rim scallop amplitude relative to radius
};

export const DEFAULT_SHAPE: DiscShape = {
  flutes: 22,
  twist: 1.25,
  depth: 0.016,
  bowl: 0.08,
  scallop: 0.028,
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const HOLE = 0.032;

const surface = (
  u: number,
  theta: number,
  s: DiscShape,
  out: THREE.Vector3,
): THREE.Vector3 => {
  const phi = theta + s.twist * Math.pow(u, 0.85);
  const wave = Math.sin(s.flutes * phi);
  // Slightly sharpened crest profile so ridges read as folds.
  const crest = Math.sign(wave) * Math.pow(Math.abs(wave), 0.9);
  const rim = 1 + s.scallop * Math.pow(u, 5) * Math.sin(s.flutes * phi + 0.6);
  const rho = Math.max(u, HOLE) * rim;
  const amp = s.depth * smoothstep(HOLE, 0.38, u) * (0.55 + 0.45 * u);
  // Shallow bowl + soft dimple into the centre hole.
  const base = s.bowl * u * u - 0.05 * Math.exp(-Math.pow(u / 0.07, 2));
  // Rim undulates up and down with the flutes like a soft ruffle.
  const ruffle = 0.03 * Math.pow(u, 6) * Math.sin(s.flutes * phi + 1.2);
  const z = base + amp * crest + ruffle;
  return out.set(rho * Math.cos(theta), rho * Math.sin(theta), z);
};

export const buildDiscGeometry = (
  shape: DiscShape = DEFAULT_SHAPE,
  radialSegments = 64,
  angularSegments = 330,
): THREE.BufferGeometry => {
  const rows = radialSegments + 1;
  const cols = angularSegments + 1;
  const positions = new Float32Array(rows * cols * 3);
  const normals = new Float32Array(rows * cols * 3);
  const colors = new Float32Array(rows * cols * 3);
  const p = new THREE.Vector3();
  const pu0 = new THREE.Vector3();
  const pu1 = new THREE.Vector3();
  const pt0 = new THREE.Vector3();
  const pt1 = new THREE.Vector3();
  const du = new THREE.Vector3();
  const dt = new THREE.Vector3();
  const n = new THREE.Vector3();
  const eps = 1e-4;

  for (let i = 0; i < rows; i++) {
    // Denser sampling near the centre where flutes converge.
    const lin = i / radialSegments;
    const u = HOLE + (1 - HOLE) * Math.pow(lin, 0.9);
    for (let j = 0; j < cols; j++) {
      const theta = (j / angularSegments) * Math.PI * 2;
      const k = (i * cols + j) * 3;
      surface(u, theta, shape, p);
      surface(Math.max(0, u - eps), theta, shape, pu0);
      surface(u + eps, theta, shape, pu1);
      surface(u, theta - eps, shape, pt0);
      surface(u, theta + eps, shape, pt1);
      du.subVectors(pu1, pu0);
      dt.subVectors(pt1, pt0);
      n.crossVectors(du, dt).normalize();
      if (n.z < 0) n.negate();
      positions[k] = p.x;
      positions[k + 1] = p.y;
      positions[k + 2] = p.z;
      normals[k] = n.x;
      normals[k + 1] = n.y;
      normals[k + 2] = n.z;
      // The centre pin-hole reads darker.
      const c = u < HOLE + 0.012 ? 0.62 : 1;
      colors[k] = c;
      colors[k + 1] = c;
      colors[k + 2] = c;
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < radialSegments; i++) {
    for (let j = 0; j < angularSegments; j++) {
      const a = i * cols + j;
      const b = a + cols;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.setIndex(indices);
  return g;
};

/** Small cap that fills the centre pin-hole. */
export const buildHoleGeometry = (): THREE.BufferGeometry =>
  new THREE.CircleGeometry(HOLE * 1.05, 32);
