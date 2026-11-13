import * as THREE from "three";

// CPU versions of the GLSL noise in glsl.ts. Shapes are displaced once at
// start-up ("baked") instead of per vertex per frame, which keeps software
// WebGL rendering fast. Only self-consistency matters here, not bit-equality
// with the GPU noise.

const fract = (x: number) => x - Math.floor(x);

const hash13 = (x: number, y: number, z: number) => {
  x = fract(x * 0.1031);
  y = fract(y * 0.1031);
  z = fract(z * 0.1031);
  const d = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);
  x += d;
  y += d;
  z += d;
  return fract((x + y) * z);
};

const hash33 = (x: number, y: number, z: number, out: number[]) => {
  x = fract(x * 0.1031);
  y = fract(y * 0.103);
  z = fract(z * 0.0973);
  const d = x * (y + 33.33) + y * (x + 33.33) + z * (z + 33.33);
  x += d;
  y += d;
  z += d;
  out[0] = fract((x + x) * z);
  out[1] = fract((x + y) * y);
  out[2] = fract((y + x) * x);
};

export const vnoise = (x: number, y: number, z: number) => {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  let fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(
      l(hash13(ix, iy, iz), hash13(ix + 1, iy, iz), fx),
      l(hash13(ix, iy + 1, iz), hash13(ix + 1, iy + 1, iz), fx),
      fy,
    ),
    l(
      l(hash13(ix, iy, iz + 1), hash13(ix + 1, iy, iz + 1), fx),
      l(hash13(ix, iy + 1, iz + 1), hash13(ix + 1, iy + 1, iz + 1), fx),
      fy,
    ),
    fz,
  );
};

const h3 = [0, 0, 0];
/** Cellular noise, returns [F1, F2] */
export const worley = (x: number, y: number, z: number): [number, number] => {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  let f1 = 9,
    f2 = 9;
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++)
      for (let c = -1; c <= 1; c++) {
        hash33(ix + a, iy + b, iz + c, h3);
        const ox = a + h3[0] - fx,
          oy = b + h3[1] - fy,
          oz = c + h3[2] - fz;
        const d = ox * ox + oy * oy + oz * oz;
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) {
          f2 = d;
        }
      }
  return [Math.sqrt(f1), Math.sqrt(f2)];
};

/**
 * Displace a unit sphere with `shape(direction) -> [x, y, z, extra1, extra2]`
 * and compute smooth normals by finite differences. The original direction
 * is kept as attribute `aObj`, the two extras as `aExtra`.
 */
export const bakeSphere = (
  base: THREE.BufferGeometry,
  shape: (x: number, y: number, z: number, out: number[]) => void,
  eps: number,
) => {
  const src = base.getAttribute("position");
  const n = src.count;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const obj = new Float32Array(n * 3);
  const extra = new Float32Array(n * 2);
  const d = new THREE.Vector3();
  const t1 = new THREE.Vector3();
  const t2 = new THREE.Vector3();
  const q = new THREE.Vector3();
  const p0 = [0, 0, 0, 0, 0];
  const p1 = [0, 0, 0, 0, 0];
  const p2 = [0, 0, 0, 0, 0];
  const Y = new THREE.Vector3(0, 1, 0);
  const X = new THREE.Vector3(1, 0, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(src, i).normalize();
    t1.crossVectors(d, Math.abs(d.y) < 0.9 ? Y : X).normalize();
    t2.crossVectors(d, t1);
    shape(d.x, d.y, d.z, p0);
    q.copy(d).addScaledVector(t1, eps).normalize();
    shape(q.x, q.y, q.z, p1);
    q.copy(d).addScaledVector(t2, eps).normalize();
    shape(q.x, q.y, q.z, p2);
    a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    a.cross(b).normalize();
    pos.set([p0[0], p0[1], p0[2]], i * 3);
    nrm.set([a.x, a.y, a.z], i * 3);
    obj.set([d.x, d.y, d.z], i * 3);
    extra.set([p0[3], p0[4]], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(base.getIndex());
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("aObj", new THREE.BufferAttribute(obj, 3));
  g.setAttribute("aExtra", new THREE.BufferAttribute(extra, 2));
  return g;
};
