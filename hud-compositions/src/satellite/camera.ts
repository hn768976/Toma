/**
 * Perspective ground-plane camera shared by the terrain shader and the HUD,
 * so HUD markers stay locked to points on the terrain.
 *
 * World units: roughly 100 m. Ground is the z = 0 plane, z is up.
 */
export type Camera = {
  /** World point under the screen centre. */
  cx: number;
  cy: number;
  /** Visible ground extent (world units) along the screen height at centre. */
  span: number;
  /** Heading: rotation of the view around the vertical axis (radians). */
  rot: number;
  /** Pitch away from straight-down (radians). */
  tilt: number;
};

/** 2·tan(fov/2) for a 30° vertical field of view. Mirrors K in the shader. */
export const K = 2 * Math.tan((30 * Math.PI) / 360);

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const basis = (c: Camera) => {
  const st = Math.sin(c.tilt);
  const ct = Math.cos(c.tilt);
  const h: [number, number] = [-Math.sin(c.rot), Math.cos(c.rot)];
  const f: V3 = [h[0] * st, h[1] * st, -ct];
  const r: V3 = [Math.cos(c.rot), Math.sin(c.rot), 0];
  // u = r × f
  const u: V3 = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];
  const d = c.span / K;
  const p: V3 = [c.cx - f[0] * d, c.cy - f[1] * d, -f[2] * d];
  return { f, r, u, p };
};

/**
 * Projects a ground point to design-space pixels (origin top-left) for a
 * viewport of `w`×`h`. Returns null when the point is behind the camera.
 */
export const project = (
  c: Camera,
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number; scale: number } | null => {
  const { f, r, u, p } = basis(c);
  const v: V3 = [x - p[0], y - p[1], -p[2]];
  const zc = dot(v, f);
  if (zc <= 0) return null;
  const ux = dot(v, r) / zc / K;
  const uy = dot(v, u) / zc / K;
  // scale: design pixels per world unit at this depth.
  return { x: w / 2 + ux * h, y: h / 2 - uy * h, scale: h / (zc * K) };
};

export const cameraUniforms = (c: Camera) => {
  const { f, r, u, p } = basis(c);
  return { uCamP: p, uCamF: f, uCamR: r, uCamU: u };
};
