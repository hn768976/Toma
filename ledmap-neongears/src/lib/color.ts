import * as THREE from "three";

// Palette hex values are sRGB; all shading happens in linear light and the final pass
// encodes back to sRGB.
export const lin = (hex: string): THREE.Vector3 => {
  const c = new THREE.Color(hex); // ColorManagement converts sRGB hex -> linear
  return new THREE.Vector3(c.r, c.g, c.b);
};

export type Stop = readonly [number, string]; // [position 0..1 (top -> bottom), hex]

// Packs up to 4 gradient stops as vec4(rgbLinear, pos). Missing stops repeat the last.
export const packStops = (stops: readonly Stop[]): THREE.Vector4[] => {
  const out: THREE.Vector4[] = [];
  for (let i = 0; i < 4; i++) {
    const [p, hex] = stops[Math.min(i, stops.length - 1)];
    const c = lin(hex);
    out.push(new THREE.Vector4(c.x, c.y, c.z, i < stops.length ? p : 2 + i));
  }
  return out;
};
