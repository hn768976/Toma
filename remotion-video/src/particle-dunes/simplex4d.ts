// Literal JS transcription of the GLSL in simplex4d.glsl.ts. Both are the
// same Ashima/Gustavson 4D simplex noise with a procedural permutation, so
// they agree numerically. Only this copy runs on the CPU, and only at module
// load time, to build the mesh that MeshSurfaceSampler scatters particles
// over; the shader copy does the per-frame work.

const mod289 = (x: number) => x - Math.floor(x * (1 / 289)) * 289;
const permute = (x: number) => mod289((x * 34 + 1) * x);
const taylorInvSqrt = (r: number) => 1.79284291400159 - 0.85373472095314 * r;
const fract = (x: number) => x - Math.floor(x);

const IP_X = 1 / 294;
const IP_Y = 1 / 49;
const IP_Z = 1 / 7;

// Scratch vectors, reused across calls: this runs a few hundred thousand
// times at startup and allocating five vec4s per call is the whole cost.
const g = [
  new Float64Array(4),
  new Float64Array(4),
  new Float64Array(4),
  new Float64Array(4),
  new Float64Array(4),
];

const grad4 = (j: number, out: Float64Array) => {
  let px = Math.floor(fract(j * IP_X) * 7) * IP_Z - 1;
  let py = Math.floor(fract(j * IP_Y) * 7) * IP_Z - 1;
  let pz = Math.floor(fract(j * IP_Z) * 7) * IP_Z - 1;
  const pw = 1.5 - (Math.abs(px) + Math.abs(py) + Math.abs(pz));
  const sw = pw < 0 ? 1 : 0;
  px += ((px < 0 ? 1 : 0) * 2 - 1) * sw;
  py += ((py < 0 ? 1 : 0) * 2 - 1) * sw;
  pz += ((pz < 0 ? 1 : 0) * 2 - 1) * sw;
  out[0] = px;
  out[1] = py;
  out[2] = pz;
  out[3] = pw;
};

const C0 = 0.138196601125011;
const C1 = 0.276393202250021;
const C2 = 0.414589803375032;
const C3 = -0.447213595499958;
const F4 = 0.309016994374947451;

const dot4 = (
  a: Float64Array,
  bx: number,
  by: number,
  bz: number,
  bw: number,
) => a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;

export const snoise4 = (
  vx: number,
  vy: number,
  vz: number,
  vw: number,
): number => {
  const s = (vx + vy + vz + vw) * F4;
  const ix = Math.floor(vx + s);
  const iy = Math.floor(vy + s);
  const iz = Math.floor(vz + s);
  const iw = Math.floor(vw + s);
  const t = (ix + iy + iz + iw) * C0;

  const x0x = vx - ix + t;
  const x0y = vy - iy + t;
  const x0z = vz - iz + t;
  const x0w = vw - iw + t;

  // Rank the four components to find which simplex corner order applies.
  const isX0 = x0x >= x0y ? 1 : 0;
  const isX1 = x0x >= x0z ? 1 : 0;
  const isX2 = x0x >= x0w ? 1 : 0;
  const isYZ0 = x0y >= x0z ? 1 : 0;
  const isYZ1 = x0y >= x0w ? 1 : 0;
  const isYZ2 = x0z >= x0w ? 1 : 0;

  const i0x = isX0 + isX1 + isX2;
  const i0y = 1 - isX0 + isYZ0 + isYZ1;
  const i0z = 1 - isX1 + (1 - isYZ0) + isYZ2;
  const i0w = 1 - isX2 + (1 - isYZ1) + (1 - isYZ2);

  const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const i3x = cl(i0x),
    i3y = cl(i0y),
    i3z = cl(i0z),
    i3w = cl(i0w);
  const i2x = cl(i0x - 1),
    i2y = cl(i0y - 1),
    i2z = cl(i0z - 1),
    i2w = cl(i0w - 1);
  const i1x = cl(i0x - 2),
    i1y = cl(i0y - 2),
    i1z = cl(i0z - 2),
    i1w = cl(i0w - 2);

  const x1x = x0x - i1x + C0,
    x1y = x0y - i1y + C0,
    x1z = x0z - i1z + C0,
    x1w = x0w - i1w + C0;
  const x2x = x0x - i2x + C1,
    x2y = x0y - i2y + C1,
    x2z = x0z - i2z + C1,
    x2w = x0w - i2w + C1;
  const x3x = x0x - i3x + C2,
    x3y = x0y - i3y + C2,
    x3z = x0z - i3z + C2,
    x3w = x0w - i3w + C2;
  const x4x = x0x + C3,
    x4y = x0y + C3,
    x4z = x0z + C3,
    x4w = x0w + C3;

  const mx = mod289(ix);
  const my = mod289(iy);
  const mz = mod289(iz);
  const mw = mod289(iw);

  const j0 = permute(permute(permute(permute(mw) + mz) + my) + mx);
  const b0 = permute(
    permute(permute(permute(mw + i1w) + mz + i1z) + my + i1y) + mx + i1x,
  );
  const b1 = permute(
    permute(permute(permute(mw + i2w) + mz + i2z) + my + i2y) + mx + i2x,
  );
  const b2 = permute(
    permute(permute(permute(mw + i3w) + mz + i3z) + my + i3y) + mx + i3x,
  );
  const b3 = permute(
    permute(permute(permute(mw + 1) + mz + 1) + my + 1) + mx + 1,
  );

  grad4(j0, g[0]);
  grad4(b0, g[1]);
  grad4(b1, g[2]);
  grad4(b2, g[3]);
  grad4(b3, g[4]);

  for (let k = 0; k < 5; k++) {
    const p = g[k];
    const n = taylorInvSqrt(
      p[0] * p[0] + p[1] * p[1] + p[2] * p[2] + p[3] * p[3],
    );
    p[0] *= n;
    p[1] *= n;
    p[2] *= n;
    p[3] *= n;
  }

  let m0 = 0.6 - (x0x * x0x + x0y * x0y + x0z * x0z + x0w * x0w);
  let m1 = 0.6 - (x1x * x1x + x1y * x1y + x1z * x1z + x1w * x1w);
  let m2 = 0.6 - (x2x * x2x + x2y * x2y + x2z * x2z + x2w * x2w);
  let m3 = 0.6 - (x3x * x3x + x3y * x3y + x3z * x3z + x3w * x3w);
  let m4 = 0.6 - (x4x * x4x + x4y * x4y + x4z * x4z + x4w * x4w);
  m0 = m0 < 0 ? 0 : m0 * m0;
  m1 = m1 < 0 ? 0 : m1 * m1;
  m2 = m2 < 0 ? 0 : m2 * m2;
  m3 = m3 < 0 ? 0 : m3 * m3;
  m4 = m4 < 0 ? 0 : m4 * m4;

  return (
    49 *
    (m0 * m0 * dot4(g[0], x0x, x0y, x0z, x0w) +
      m1 * m1 * dot4(g[1], x1x, x1y, x1z, x1w) +
      m2 * m2 * dot4(g[2], x2x, x2y, x2z, x2w) +
      m3 * m3 * dot4(g[3], x3x, x3y, x3z, x3w) +
      m4 * m4 * dot4(g[4], x4x, x4y, x4z, x4w))
  );
};
