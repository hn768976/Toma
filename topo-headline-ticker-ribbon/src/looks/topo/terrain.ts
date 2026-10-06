import { GLSL_PNOISE, pnoise } from "../../lib/noise";

/** Terrain tiles along z with period T world units. */
export const TOPO_T = 96;
export const TOPO_F0 = 1 / 16; // lattice cells per world unit at octave 0
export const TOPO_P0 = TOPO_T * TOPO_F0; // = 6 lattice cells per period
export const TOPO_H = 2.0; // displacement amplitude (world units)

export function topoHeight(x: number, tz: number): number {
  const px = x * TOPO_F0, pz = tz * TOPO_F0;
  const wx = pnoise(px * 0.5 + 31.7, pz * 0.5, TOPO_P0 / 2, 11) * 1.1;
  const wz = pnoise(px * 0.5 - 17.3, pz * 0.5, TOPO_P0 / 2, 23) * 1.1;
  const qx = px + wx, qz = pz + wz;
  let h = 0, amp = 1, f = 1;
  for (let o = 0; o < 5; o++) {
    h += amp * pnoise(qx * f, qz * f, TOPO_P0 * f, o * 1013);
    amp *= 0.47;
    f *= 2;
  }
  return h * TOPO_H;
}

export const GLSL_TOPO_HEIGHT = /* glsl */ `
${GLSL_PNOISE}
float topoHeight(vec2 xz){
  vec2 p = xz * ${TOPO_F0.toFixed(10)};
  const int P0 = ${TOPO_P0};
  vec2 w = vec2(pnoise(p*0.5 + vec2(31.7,0.0), P0/2, 11), pnoise(p*0.5 + vec2(-17.3,0.0), P0/2, 23)) * 1.1;
  vec2 q = p + w;
  float h = 0.0, amp = 1.0, f = 1.0;
  int per = P0;
  for (int o = 0; o < 5; o++) {
    h += amp * pnoise(q*f, per, o*1013);
    amp *= 0.47; f *= 2.0; per *= 2;
  }
  return h * ${TOPO_H.toFixed(4)};
}
`;
