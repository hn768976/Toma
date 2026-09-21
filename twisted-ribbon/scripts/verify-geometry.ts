/**
 * Geometry self-test. Run: npm run verify:geometry
 *
 * Checks the things that go wrong silently and only show up as a visible crease
 * or a failed loop test 20 minutes into a render.
 */
import { buildRibbon } from '../src/ribbon/geometry';
import {
  A_RATIO,
  H3_RATIO,
  K,
  R,
  SEGMENTS,
  THICKNESS_RATIO,
  TWIST_PHASE_DEG,
  WIDTH_RATIO,
} from '../src/ribbon/params';

const p = {
  R,
  aRatio: A_RATIO,
  h3Ratio: H3_RATIO,
  k: K,
  widthRatio: WIDTH_RATIO,
  thicknessRatio: THICKNESS_RATIO,
  segments: SEGMENTS,
  twistPhase: (TWIST_PHASE_DEG * Math.PI) / 180,
};

const { positions, normals, indices, diagnostics } = buildRibbon(p);
const N = SEGMENTS;
const half = N / 2;
const perFace = (N + 1) * 2;

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(34)} ${detail}`);
};

console.log(
  `params R=${R} A=${A_RATIO}R h3=${H3_RATIO}R k=${K} width=${WIDTH_RATIO}R thickness=${THICKNESS_RATIO}*width segments=${SEGMENTS}`,
);
console.log(
  `verts=${diagnostics.vertexCount} tris=${diagnostics.triangleCount} PT-holonomy=${diagnostics.residual.toFixed(9)} rad\n`,
);

check(
  'symmetry shortcut matches direct',
  diagnostics.symmetryError < 1e-9,
  `max deviation ${diagnostics.symmetryError.toExponential(3)}`,
);
check(
  'seam closes exactly',
  diagnostics.closureError === 0,
  `max gap ${diagnostics.closureError}`,
);

// Bit-exact two-fold symmetry about Y. This is what makes frame 300 == frame 0.
// mirrorY(vertex(f, i, s)) must BE vertex((f+2)%4, i+half, s).
let symMax = 0;
for (let f = 0; f < 4; f++) {
  for (let i = 0; i < N; i++) {
    for (let s = 0; s < 2; s++) {
      const a = (f * perFace + i * 2 + s) * 3;
      const b = (((f + 2) % 4) * perFace + ((i + half) % N) * 2 + s) * 3;
      for (const buf of [positions, normals]) {
        symMax = Math.max(
          symMax,
          Math.abs(-buf[a] - buf[b]),
          Math.abs(buf[a + 1] - buf[b + 1]),
          Math.abs(-buf[a + 2] - buf[b + 2]),
        );
      }
    }
  }
}
check(
  'Ry(pi) invariance is bit-exact',
  symMax === 0,
  `max |delta| ${symMax}`,
);

// Normal continuity along each face strip — a crease shows up as a large jump.
let maxNormalJump = 0;
let jumpAt = -1;
for (let f = 0; f < 4; f++) {
  for (let i = 0; i < N; i++) {
    const a = (f * perFace + i * 2) * 3;
    const b = (f * perFace + ((i + 1) % N) * 2) * 3;
    const d = Math.acos(
      Math.min(
        1,
        Math.max(
          -1,
          normals[a] * normals[b] +
            normals[a + 1] * normals[b + 1] +
            normals[a + 2] * normals[b + 2],
        ),
      ),
    );
    if (d > maxNormalJump) {
      maxNormalJump = d;
      jumpAt = i;
    }
  }
}
const expectedTwistStep = ((Math.PI * K) / 2 / N) * 4; // generous allowance
check(
  'no normal discontinuity',
  maxNormalJump < Math.max(expectedTwistStep, 0.02),
  `max ring-to-ring turn ${((maxNormalJump * 180) / Math.PI).toFixed(4)} deg at i=${jumpAt}`,
);

// Silhouette smoothness: the largest angle between consecutive curve steps sets
// how much faceting is visible on the outer edge.
let maxSegTurn = 0;
for (let i = 0; i < N; i++) {
  const a = (i * 2) * 3;
  const b = (((i + 1) % N) * 2) * 3;
  const c = (((i + 2) % N) * 2) * 3;
  const v1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
  const v2 = [positions[c] - positions[b], positions[c + 1] - positions[b + 1], positions[c + 2] - positions[b + 2]];
  const l1 = Math.hypot(...v1);
  const l2 = Math.hypot(...v2);
  const cs = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (l1 * l2);
  maxSegTurn = Math.max(maxSegTurn, Math.acos(Math.min(1, Math.max(-1, cs))));
}
check(
  'silhouette tessellation',
  (maxSegTurn * 180) / Math.PI < 0.5,
  `max turn per segment ${((maxSegTurn * 180) / Math.PI).toFixed(4)} deg`,
);

// No degenerate triangles.
let degenerate = 0;
for (let t = 0; t < indices.length; t += 3) {
  const [i0, i1, i2] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
  const e1 = [positions[i1] - positions[i0], positions[i1 + 1] - positions[i0 + 1], positions[i1 + 2] - positions[i0 + 2]];
  const e2 = [positions[i2] - positions[i0], positions[i2 + 1] - positions[i0 + 1], positions[i2 + 2] - positions[i0 + 2]];
  const cx = e1[1] * e2[2] - e1[2] * e2[1];
  const cy = e1[2] * e2[0] - e1[0] * e2[2];
  const cz = e1[0] * e2[1] - e1[1] * e2[0];
  if (Math.hypot(cx, cy, cz) < 1e-14) degenerate++;
}
check('no degenerate triangles', degenerate === 0, `${degenerate} found`);

// Winding: face normals must agree with the triangle winding (outward).
let flipped = 0;
for (let t = 0; t < indices.length; t += 3) {
  const [i0, i1, i2] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
  const e1 = [positions[i1] - positions[i0], positions[i1 + 1] - positions[i0 + 1], positions[i1 + 2] - positions[i0 + 2]];
  const e2 = [positions[i2] - positions[i0], positions[i2 + 1] - positions[i0 + 1], positions[i2 + 2] - positions[i0 + 2]];
  const cx = e1[1] * e2[2] - e1[2] * e2[1];
  const cy = e1[2] * e2[0] - e1[0] * e2[2];
  const cz = e1[0] * e2[1] - e1[1] * e2[0];
  if (cx * normals[i0] + cy * normals[i0 + 1] + cz * normals[i0 + 2] <= 0) flipped++;
}
check('winding matches normals', flipped === 0, `${flipped} back-facing tris`);

// Bounding box — feeds the camera framing.
const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
for (let i = 0; i < positions.length; i += 3) {
  for (let c = 0; c < 3; c++) {
    bb[c] = Math.min(bb[c], positions[i + c]);
    bb[c + 3] = Math.max(bb[c + 3], positions[i + c]);
  }
}
console.log(
  `\nbounds x[${bb[0].toFixed(3)},${bb[3].toFixed(3)}] y[${bb[1].toFixed(3)},${bb[4].toFixed(3)}] z[${bb[2].toFixed(3)},${bb[5].toFixed(3)}]`,
);
console.log(
  `band width ${(WIDTH_RATIO * R).toFixed(3)}  thickness ${(THICKNESS_RATIO * WIDTH_RATIO * R).toFixed(5)}`,
);

console.log(failures === 0 ? '\nALL GEOMETRY CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
