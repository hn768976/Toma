import * as THREE from "three";
import { ATLAS_GRID } from "./dataAtlas";
import { mulberry32, pick, range } from "./random";

export type Box = {
  center: THREE.Vector3;
  size: THREE.Vector3;
};

// The camera flies down -Z through a long corridor of cubes. A clear tunnel is
// kept around the flight path so the bright void stays visible in the centre.
export const FIELD_NEAR_Z = 14;
export const FIELD_FAR_Z = -150;
const TUNNEL_X = 0.6;
const TUNNEL_Y = 0.45;
const LATTICE = 0.25;

const snap = (v: number) => Math.round(v / LATTICE) * LATTICE;

export const generateBoxes = (seed: number, count: number): Box[] => {
  const rng = mulberry32(seed);
  const boxes: Box[] = [];
  const sizes = [1.5, 1.8, 2.1, 2.5, 2.9, 3.4, 4.0];
  let guard = 0;
  while (boxes.length < count && guard < count * 50) {
    guard++;
    const base = pick(rng, sizes);
    const size = new THREE.Vector3(base, base, base);
    const shape = rng() + 1; // all true cubes (kept for easy tweaking)
    if (shape < 0.03) {
      // long horizontal slab
      size.x = base * range(rng, 2.2, 4);
      size.y = base * range(rng, 0.45, 0.8);
    } else if (shape < 0.06) {
      // tall column
      size.y = base * range(rng, 2, 3.5);
    } else if (shape < 0.1) {
      // deep box
      size.z = base * range(rng, 1.6, 3);
    }
    // Distribute with a bias towards the tunnel so the frame stays dense.
    const ang = rng() * Math.PI * 2;
    const rad = 1.2 + Math.pow(rng(), 0.9) * 8.5;
    const x = snap(Math.cos(ang) * rad * 1.35);
    const y = snap(Math.sin(ang) * rad * 0.85);
    const z = snap(range(rng, FIELD_FAR_Z, FIELD_NEAR_Z));
    // Keep the camera's flight tunnel clear.
    const overlapX = Math.abs(x) - size.x / 2 < TUNNEL_X;
    const overlapY = Math.abs(y) - size.y / 2 < TUNNEL_Y;
    if (overlapX && overlapY) {
      continue;
    }
    boxes.push({ center: new THREE.Vector3(x, y, z), size });
  }
  return boxes;
};

// Each box becomes 6 quads in one merged geometry. Per-vertex attributes:
//  uv      face-local 0..1 (drives the anti-aliased edge lines in the shader)
//  aCell   atlas cell (x, y) for printed data, or (-1, -1) for a blank face
//  aFlip   mirrors the panel so repeated atlas cells don't look identical
//  aShade  per-face opacity multiplier (glass thickness variation)
export const buildCubeGeometry = (boxes: Box[], seed: number) => {
  const rng = mulberry32(seed);
  const positions: number[] = [];
  const uvs: number[] = [];
  const cells: number[] = [];
  const flips: number[] = [];
  const shades: number[] = [];
  const indices: number[] = [];

  // Face definitions: normal axis, and the two tangent axes (u, v).
  const faces: { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 }[] = [
    { n: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
    { n: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
    { n: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0) },
    { n: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) },
    { n: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1) },
    { n: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
  ];

  const corner = new THREE.Vector3();
  let vi = 0;
  for (const box of boxes) {
    const half = box.size.clone().multiplyScalar(0.5);
    const boxShade = range(rng, 0.7, 1.35);
    for (const f of faces) {
      const nOff = new THREE.Vector3(f.n.x * half.x, f.n.y * half.y, f.n.z * half.z);
      const uOff = new THREE.Vector3(f.u.x * half.x, f.u.y * half.y, f.u.z * half.z);
      const vOff = new THREE.Vector3(f.v.x * half.x, f.v.y * half.y, f.v.z * half.z);
      const hasData = rng() < 0.62;
      const cx = hasData ? Math.floor(rng() * ATLAS_GRID) : -1;
      const cy = hasData ? Math.floor(rng() * ATLAS_GRID) : -1;
      const fx = rng() < 0.5 ? 1 : 0;
      const fy = rng() < 0.25 ? 1 : 0;
      const shade = boxShade * range(rng, 0.8, 1.2);
      const quad = [
        [-1, -1, 0, 0],
        [1, -1, 1, 0],
        [1, 1, 1, 1],
        [-1, 1, 0, 1],
      ];
      for (const [su, sv, u, v] of quad) {
        corner
          .copy(box.center)
          .add(nOff)
          .addScaledVector(uOff, su)
          .addScaledVector(vOff, sv);
        positions.push(corner.x, corner.y, corner.z);
        uvs.push(u, v);
        cells.push(cx, cy);
        flips.push(fx, fy);
        shades.push(shade);
      }
      indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("aCell", new THREE.Float32BufferAttribute(cells, 2));
  geo.setAttribute("aFlip", new THREE.Float32BufferAttribute(flips, 2));
  geo.setAttribute("aShade", new THREE.Float32BufferAttribute(shades, 1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
};

export const cubeVertexShader = /* glsl */ `
  attribute vec2 aCell;
  attribute vec2 aFlip;
  attribute float aShade;
  varying vec2 vUv;
  varying vec2 vCell;
  varying vec2 vFlip;
  varying float vShade;
  varying float vDepth;
  void main() {
    vUv = uv;
    vCell = aCell;
    vFlip = aFlip;
    vShade = aShade;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const cubeFragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uGrid;
  uniform vec3 uFace;
  uniform float uFaceAlpha;
  uniform vec3 uEdge;
  uniform float uEdgeAlpha;
  uniform vec3 uInk;
  uniform float uInkAlpha;
  uniform float uLineWidth;   // edge width in output pixels
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uAdditive;
  varying vec2 vUv;
  varying vec2 vCell;
  varying vec2 vFlip;
  varying float vShade;
  varying float vDepth;

  void main() {
    // Anti-aliased, constant-pixel-width edge lines (wireframe-by-derivatives).
    vec2 fw = max(fwidth(vUv), vec2(1e-6));
    vec2 distPx = min(vUv, 1.0 - vUv) / fw;
    float d = min(distPx.x, distPx.y);
    float edge = 1.0 - smoothstep(uLineWidth - 0.75, uLineWidth + 0.75, d);
    // Soft inner shadow along the frame makes the glass read as thick.
    float rim = 1.0 - smoothstep(0.0, 0.16, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));

    // Printed data from the atlas.
    float ink = 0.0;
    if (vCell.x >= 0.0) {
      vec2 p = mix(vUv, 1.0 - vUv, vFlip);
      vec2 auv = (vCell + clamp(p, 0.004, 0.996)) / uGrid;
      ink = texture2D(uAtlas, auv).a;
    }

    // Distance fade: geometry dissolves into the background haze far away and
    // is softened as it sweeps past the lens.
    float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
    float nearFade = smoothstep(0.35, 1.6, vDepth);
    float vis = fog * nearFade;

    float faceA = uFaceAlpha * vShade * (1.0 + rim * 1.4);
    float inkA = ink * uInkAlpha;
    float edgeA = edge * uEdgeAlpha;

    // Composite the three layers (face < ink < edge) into one premultiplied colour.
    vec3 col = uFace * faceA;
    float a = faceA;
    col = col * (1.0 - inkA) + uInk * inkA;
    a = a * (1.0 - inkA) + inkA;
    col = col * (1.0 - edgeA) + uEdge * edgeA;
    a = a * (1.0 - edgeA) + edgeA;

    a *= vis;
    col *= vis;
    if (a < 0.002) discard;
    if (uAdditive > 0.5) {
      gl_FragColor = vec4(col, 1.0);
    } else {
      gl_FragColor = vec4(col / max(a, 1e-4), a);
    }
  }
`;
