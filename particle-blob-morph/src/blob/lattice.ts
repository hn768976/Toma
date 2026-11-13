/**
 * Dots laid out on a "spherified cube": each cube face carries a regular n x n
 * grid that is projected onto the unit sphere. Compared to a Fibonacci lattice
 * this keeps the dots in tidy rows, which is what makes the folded ridges of the
 * reference read as parallel lines of beads.
 */
export const cubeSphereLattice = (perEdge: number): Float32Array => {
  const out: number[] = [];
  const faces: Array<(a: number, b: number) => [number, number, number]> = [
    (a, b) => [1, b, -a],
    (a, b) => [-1, b, a],
    (a, b) => [a, 1, -b],
    (a, b) => [a, -1, b],
    (a, b) => [a, b, 1],
    (a, b) => [-a, b, -1],
  ];
  for (const face of faces) {
    for (let i = 0; i < perEdge; i++) {
      for (let j = 0; j < perEdge; j++) {
        // tan-warp makes the cells close to equal-area on the sphere
        const a = Math.tan((((i + 0.5) / perEdge) * 2 - 1) * (Math.PI / 4));
        const b = Math.tan((((j + 0.5) / perEdge) * 2 - 1) * (Math.PI / 4));
        const [x, y, z] = face(a, b);
        const len = Math.hypot(x, y, z);
        out.push(x / len, y / len, z / len);
      }
    }
  }
  return new Float32Array(out);
};
