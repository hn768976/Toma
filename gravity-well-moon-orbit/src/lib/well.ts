/** CPU twin of the GLSL `wellHeight`, used to sit bodies on the grid. */
export type Dip = { x: number; z: number; depth: number; width: number };

export const wellHeight = (
  x: number,
  z: number,
  depth: number,
  width: number,
  dip?: Dip,
) => {
  let y = -depth / Math.sqrt(x * x + z * z + width * width);
  if (dip && dip.depth > 0) {
    const dx = x - dip.x;
    const dz = z - dip.z;
    y -= dip.depth / Math.sqrt(dx * dx + dz * dz + dip.width * dip.width);
  }
  return y;
};
