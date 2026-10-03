// 2.5D camera. The screen is a flat plane, transformed with CSS 3D. The same
// matrix is evaluated here so depth-of-field can be computed per point.

export const VIEW_W = 3840;
export const VIEW_H = 2160;

export interface Camera {
  /** Plane rotations in degrees, applied as rotateZ · rotateX · rotateY. */
  rx: number;
  ry: number;
  rz: number;
  /** Point on the screen (logical units from its top-left) put at frame centre. */
  look: [number, number];
  /** Depth of the look point (towards viewer = positive). Bigger = closer. */
  zLook: number;
  perspective: number;
}

type M3 = number[][];
const rad = (d: number) => (d * Math.PI) / 180;
const mul = (a: M3, b: M3): M3 =>
  a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));

export interface Projection {
  R: M3;
  t: [number, number, number];
  W: number;
  H: number;
  P: number;
  css: string;
  /** Depth of a point on the screen (logical coords from top-left). */
  depth: (x: number, y: number) => number;
  /** Projected position in the 3840x2160 frame. */
  project: (x: number, y: number) => [number, number];
  /** Depth gradient: depth = a*x + b*y + c. */
  plane: { a: number; b: number; c: number };
  /** Output px per logical unit at (x, y). */
  mag: (x: number, y: number) => number;
  /** Screen point (logical) seen at frame pixel (X, Y), or null if none. */
  unproject: (X: number, Y: number) => [number, number] | null;
}

export const projection = (cam: Camera, W: number, H: number): Projection => {
  const cx = Math.cos(rad(cam.rx));
  const sx = Math.sin(rad(cam.rx));
  const cy = Math.cos(rad(cam.ry));
  const sy = Math.sin(rad(cam.ry));
  const cz = Math.cos(rad(cam.rz));
  const sz = Math.sin(rad(cam.rz));
  const Rx: M3 = [
    [1, 0, 0],
    [0, cx, -sx],
    [0, sx, cx],
  ];
  const Ry: M3 = [
    [cy, 0, sy],
    [0, 1, 0],
    [-sy, 0, cy],
  ];
  const Rz: M3 = [
    [cz, -sz, 0],
    [sz, cz, 0],
    [0, 0, 1],
  ];
  const R = mul(Rz, mul(Rx, Ry));
  const rot = (x: number, y: number) => {
    const px = x - W / 2;
    const py = y - H / 2;
    return [
      R[0][0] * px + R[0][1] * py,
      R[1][0] * px + R[1][1] * py,
      R[2][0] * px + R[2][1] * py,
    ];
  };
  const L = rot(cam.look[0], cam.look[1]);
  const t: [number, number, number] = [-L[0], -L[1], cam.zLook - L[2]];
  const P = cam.perspective;
  const depth = (x: number, y: number) => rot(x, y)[2] + t[2];
  const project = (x: number, y: number): [number, number] => {
    const q = rot(x, y);
    const z = q[2] + t[2];
    const k = P / (P - z);
    return [VIEW_W / 2 + (q[0] + t[0]) * k, VIEW_H / 2 + (q[1] + t[1]) * k];
  };
  const a = R[2][0];
  const b = R[2][1];
  const c = t[2] - a * (W / 2) - b * (H / 2);
  const css = `translate3d(${t[0].toFixed(3)}px, ${t[1].toFixed(3)}px, ${t[2].toFixed(3)}px) rotateZ(${cam.rz}deg) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg)`;
  const n = [R[0][2], R[1][2], R[2][2]];
  const unproject = (X: number, Y: number): [number, number] | null => {
    const D = [X - VIEW_W / 2, Y - VIEW_H / 2, -P];
    const nd = n[0] * D[0] + n[1] * D[1] + n[2] * D[2];
    if (Math.abs(nd) < 1e-9) return null;
    const s = (n[0] * t[0] + n[1] * t[1] + n[2] * (t[2] - P)) / nd;
    if (s <= 0) return null;
    const Q = [s * D[0] - t[0], s * D[1] - t[1], P + s * D[2] - t[2]];
    // R is orthonormal: inverse = transpose.
    const x = R[0][0] * Q[0] + R[1][0] * Q[1] + R[2][0] * Q[2];
    const y = R[0][1] * Q[0] + R[1][1] * Q[1] + R[2][1] * Q[2];
    return [x + W / 2, y + H / 2];
  };
  return {
    unproject,
    R,
    t,
    W,
    H,
    P,
    css,
    depth,
    project,
    plane: { a, b, c },
    mag: (x, y) => P / (P - depth(x, y)),
  };
};

/** True if every frame corner hits the screen plane inside its bounds. */
export const coversFrame = (pr: Projection, margin = 0) => {
  // Invert by sampling: march along edges of the plane is costly; instead
  // check that the projected plane polygon contains all four frame corners.
  const poly = [
    pr.project(margin, margin),
    pr.project(pr.W - margin, margin),
    pr.project(pr.W - margin, pr.H - margin),
    pr.project(margin, pr.H - margin),
  ];
  const inside = (px: number, py: number) => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % 4];
      const cr = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
      const s = Math.sign(cr);
      if (s === 0) continue;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  };
  return [
    [0, 0],
    [VIEW_W, 0],
    [VIEW_W, VIEW_H],
    [0, VIEW_H],
  ].every(([x, y]) => inside(x, y));
};
