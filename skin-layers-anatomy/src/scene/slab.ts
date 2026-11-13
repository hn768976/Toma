import * as THREE from "three";
import { HALF } from "./layers";

type H = (x: number, z: number) => number;

/**
 * A square slab whose top and bottom follow height functions. Faces do not
 * share vertices, so edges stay crisp while each face shades smoothly.
 * UVs are in world units / 4 so textures keep the same scale on all faces.
 */
export const slabGeometry = (bottom: H, top: H, n = 72) => {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let base = 0;

  const grid = (
    rows: number,
    cols: number,
    f: (i: number, j: number) => [number, number, number, number, number],
    flip: boolean,
  ) => {
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= cols; j++) {
        const [x, y, z, u, v] = f(i / rows, j / cols);
        pos.push(x, y, z);
        uv.push(u, v);
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = base + i * (cols + 1) + j;
        const b = a + 1;
        const c = a + cols + 1;
        const d = c + 1;
        if (flip) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }
    base += (rows + 1) * (cols + 1);
  };

  const S = HALF * 2;
  // top (+y) and bottom (-y)
  grid(
    n,
    n,
    (i, j) => {
      const x = -HALF + i * S;
      const z = -HALF + j * S;
      return [x, top(x, z), z, x / 4, z / 4];
    },
    true,
  );
  grid(
    n,
    n,
    (i, j) => {
      const x = -HALF + i * S;
      const z = -HALF + j * S;
      return [x, bottom(x, z), z, x / 4, z / 4];
    },
    false,
  );
  // four sides: [fixed axis, value, flip]
  const sides: [("x" | "z"), number, boolean][] = [
    ["z", HALF, false],
    ["z", -HALF, true],
    ["x", HALF, true],
    ["x", -HALF, false],
  ];
  for (const [axis, value, flip] of sides) {
    grid(
      n,
      4,
      (i, j) => {
        const a = -HALF + i * S;
        const x = axis === "z" ? a : value;
        const z = axis === "z" ? value : a;
        const y0 = bottom(x, z);
        const y1 = top(x, z);
        const y = y0 + (y1 - y0) * j;
        return [x, y, z, a / 4 + (axis === "x" ? 0.37 : 0), y / 4];
      },
      flip,
    );
  }

  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
};
