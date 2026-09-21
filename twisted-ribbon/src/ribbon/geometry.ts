/**
 * Ribbon geometry: a flat rectangular cross-section swept along a closed saddle
 * curve, twisted by K half-turns, on a parallel-transported (rotation-minimising)
 * frame.
 *
 * Pure math — no three.js, no React, no global state. Given the same params it
 * returns bit-identical buffers, which is what the determinism guarantee rests on.
 */

export type RibbonParams = {
  R: number;
  aRatio: number;
  h3Ratio: number;
  k: number;
  widthRatio: number;
  thicknessRatio: number;
  segments: number;
  /** Constant roll of the cross-section, radians. Chooses which part of the
   *  loop presents its wide face to the camera. A constant offset cannot break
   *  closure or the two-fold symmetry. */
  twistPhase: number;
};

export type RibbonBuffers = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Diagnostics, surfaced by the geometry self-test. */
  diagnostics: {
    /** Parallel-transport holonomy over the full loop, radians. */
    residual: number;
    /**
     * Max distance between the directly-transported second half and the
     * second half implied by the exact two-fold Y symmetry. Should be ~1e-12.
     * A large value means the symmetry argument does not hold for these params.
     */
    symmetryError: number;
    /** Max gap between the last ring and the first. Must be exactly 0. */
    closureError: number;
    vertexCount: number;
    triangleCount: number;
  };
};

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** Ry(pi): the two-fold rotation the whole loop is symmetric under. */
const mirrorY = (a: V3): V3 => [-a[0], a[1], -a[2]];

/** Rodrigues rotation of v about unit axis n by angle t. */
const rotateAbout = (v: V3, n: V3, t: number): V3 => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return add(
    add(scale(v, c), scale(cross(n, v), s)),
    scale(n, dot(n, v) * (1 - c)),
  );
};

export const curvePoint = (u: number, p: RibbonParams): V3 => {
  const { R, aRatio, h3Ratio } = p;
  return [
    R * Math.cos(u) + h3Ratio * R * Math.cos(3 * u),
    aRatio * R * Math.sin(2 * u),
    R * Math.sin(u) + h3Ratio * R * Math.sin(3 * u),
  ];
};

const curveTangent = (u: number, p: RibbonParams): V3 => {
  const { R, aRatio, h3Ratio } = p;
  return norm([
    -R * Math.sin(u) - 3 * h3Ratio * R * Math.sin(3 * u),
    2 * aRatio * R * Math.cos(2 * u),
    R * Math.cos(u) + 3 * h3Ratio * R * Math.cos(3 * u),
  ]);
};

/**
 * Double-reflection rotation-minimising frame (Wang et al. 2008).
 *
 * Deliberately NOT a Frenet frame: Frenet normals flip at inflection points and
 * this curve has several, which would put a hard 180-degree crease in the band.
 */
const transport = (p0: V3, t0: V3, w0: V3, p1: V3, t1: V3): V3 => {
  const v1 = sub(p1, p0);
  const c1 = dot(v1, v1);
  if (c1 === 0) return w0;
  const wL = sub(w0, scale(v1, (2 / c1) * dot(v1, w0)));
  const tL = sub(t0, scale(v1, (2 / c1) * dot(v1, t0)));
  const v2 = sub(t1, tL);
  const c2 = dot(v2, v2);
  const w1 = c2 === 0 ? wL : sub(wL, scale(v2, (2 / c2) * dot(v2, wL)));
  // Re-orthonormalise against the new tangent to stop drift over 1800 steps.
  return norm(sub(w1, scale(t1, dot(w1, t1))));
};

/** Signed angle from a to b measured about unit axis n. */
const signedAngle = (a: V3, b: V3, n: V3) =>
  Math.atan2(dot(cross(a, b), n), dot(a, b));

type Ring = { corners: [V3, V3, V3, V3]; faceNormals: [V3, V3, V3, V3] };

export const buildRibbon = (p: RibbonParams): RibbonBuffers => {
  const N = p.segments;
  if (N % 2 !== 0) throw new Error('segments must be even');
  if (!Number.isInteger(p.k)) throw new Error('k must be an integer');
  const half = N / 2;
  const halfWidth = (p.widthRatio * p.R) / 2;
  const halfThickness = (p.thicknessRatio * p.widthRatio * p.R) / 2;

  // --- sample curve ---------------------------------------------------------
  const P: V3[] = [];
  const T: V3[] = [];
  for (let i = 0; i <= N; i++) {
    const u = (2 * Math.PI * i) / N;
    P.push(curvePoint(u, p));
    T.push(curveTangent(u, p));
  }

  // --- parallel transport all the way round, to measure the holonomy --------
  const seed: V3 = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const W: V3[] = [norm(sub(seed, scale(T[0], dot(seed, T[0]))))];
  for (let i = 1; i <= N; i++) {
    W.push(transport(P[i - 1], T[i - 1], W[i - 1], P[i], T[i]));
  }
  const residual = signedAngle(W[0], W[N], T[0]);

  // Frame angle: the K half-turns, plus the closure residual spread evenly over
  // the whole loop so the frame closes on itself.
  const frameAngle = (u: number) =>
    (p.k * u) / 2 - (residual * u) / (2 * Math.PI) + p.twistPhase;

  const makeRing = (i: number): Ring => {
    const u = (2 * Math.PI * i) / N;
    const wAxis = rotateAbout(W[i], T[i], frameAngle(u));
    const tAxis = norm(cross(T[i], wAxis));
    const a = scale(wAxis, halfWidth);
    const b = scale(tAxis, halfThickness);
    const c0 = add(P[i], add(a, b));
    const c1 = add(P[i], add(scale(a, -1), b));
    const c2 = add(P[i], add(scale(a, -1), scale(b, -1)));
    const c3 = add(P[i], add(a, scale(b, -1)));
    return {
      corners: [c0, c1, c2, c3],
      // Wide faces take the thickness axis; thin edge faces take the width axis.
      // Computed from the frame, never averaged from neighbouring geometry —
      // averaging rounds the corners off and kills the edge highlight.
      faceNormals: [tAxis, scale(wAxis, -1), scale(tAxis, -1), wAxis],
    };
  };

  // --- first half computed directly, second half mirrored exactly -----------
  //
  // The curve satisfies p(u + pi) = Ry(pi) . p(u), and with an even k the whole
  // swept surface inherits that symmetry: section(u + pi) is section(u) mirrored
  // and rolled by exactly pi about the tangent, which a rectangle maps onto
  // itself under (corner j -> corner j+2).
  //
  // We build the second half by that identity rather than by re-evaluating the
  // transcendental functions, so the symmetry is exact in floating point. That is
  // what makes the 180-degree rotation return a *pixel-identical* frame instead
  // of an almost-identical one.
  const rings: Ring[] = [];
  for (let i = 0; i < half; i++) rings.push(makeRing(i));

  let symmetryError = 0;
  for (let i = 0; i < half; i++) {
    const src = rings[i];
    const mirrored: Ring = {
      corners: [0, 1, 2, 3].map((j) =>
        mirrorY(src.corners[(j + 2) % 4]),
      ) as Ring['corners'],
      faceNormals: [0, 1, 2, 3].map((f) =>
        mirrorY(src.faceNormals[(f + 2) % 4]),
      ) as Ring['faceNormals'],
    };
    // Cross-check against the direct computation before trusting the shortcut.
    const direct = makeRing(i + half);
    for (let j = 0; j < 4; j++) {
      const d = sub(mirrored.corners[j], direct.corners[j]);
      symmetryError = Math.max(symmetryError, Math.hypot(d[0], d[1], d[2]));
    }
    rings.push(mirrored);
  }

  // --- emit buffers ---------------------------------------------------------
  // One strip per face, N+1 rings x 2 corners, flat normals per face.
  const perFace = (N + 1) * 2;
  const vertexCount = perFace * 4;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(N * 4 * 6);

  let ii = 0;
  for (let f = 0; f < 4; f++) {
    const base = f * perFace;
    for (let i = 0; i <= N; i++) {
      const ring = rings[i % N];
      const n = ring.faceNormals[f];
      const pair = [ring.corners[f], ring.corners[(f + 1) % 4]];
      for (let s = 0; s < 2; s++) {
        const o = (base + i * 2 + s) * 3;
        positions[o] = pair[s][0];
        positions[o + 1] = pair[s][1];
        positions[o + 2] = pair[s][2];
        normals[o] = n[0];
        normals[o + 1] = n[1];
        normals[o + 2] = n[2];
      }
    }
    for (let i = 0; i < N; i++) {
      const a = base + i * 2;
      // CCW when seen from outside: (a, a+1, a+3) / (a, a+3, a+2).
      indices[ii++] = a;
      indices[ii++] = a + 1;
      indices[ii++] = a + 3;
      indices[ii++] = a;
      indices[ii++] = a + 3;
      indices[ii++] = a + 2;
    }
  }

  // Closure: the ring at index N must be bit-identical to the ring at index 0.
  let closureError = 0;
  for (let f = 0; f < 4; f++) {
    const base = f * perFace;
    for (let s = 0; s < 2; s++) {
      const aO = (base + N * 2 + s) * 3;
      const bO = (base + s) * 3;
      for (let c = 0; c < 3; c++) {
        closureError = Math.max(
          closureError,
          Math.abs(positions[aO + c] - positions[bO + c]),
          Math.abs(normals[aO + c] - normals[bO + c]),
        );
      }
    }
  }

  return {
    positions,
    normals,
    indices,
    diagnostics: {
      residual,
      symmetryError,
      closureError,
      vertexCount,
      triangleCount: indices.length / 3,
    },
  };
};
