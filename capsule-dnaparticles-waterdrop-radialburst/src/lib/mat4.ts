// Minimal column-major 4x4 helpers for the PixiJS scenes.
export type M4 = Float32Array;

export const ident = (): M4 => {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
};

export const mul = (a: M4, b: M4): M4 => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
};

export const translate = (x: number, y: number, z: number): M4 => {
  const m = ident();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
};

export const rotX = (a: number): M4 => {
  const m = ident();
  const c = Math.cos(a), s = Math.sin(a);
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
};

export const rotY = (a: number): M4 => {
  const m = ident();
  const c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
};

export const rotZ = (a: number): M4 => {
  const m = ident();
  const c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
  return m;
};

// Transform a direction (w = 0) by the transpose of m's rotation part,
// i.e. by the inverse rotation for an orthonormal m.
export const invRotateDir = (m: M4, v: [number, number, number]): [number, number, number] => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[4] * v[0] + m[5] * v[1] + m[6] * v[2],
  m[8] * v[0] + m[9] * v[1] + m[10] * v[2],
];
