import { Color } from "three";

/** sRGB hex → linear-light [r,g,b] (three's ColorManagement does the conversion). */
export const lin = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

export const linColor = (hex: string) => new Color(hex);
