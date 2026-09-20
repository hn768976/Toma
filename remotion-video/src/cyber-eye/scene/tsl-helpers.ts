import { Color } from "three/webgpu";
import { uniform, vec3 } from "three/tsl";

// Thin typing helpers around TSL so the scene modules stay readable.

export const floatUniform = (value: number) => uniform(value);
export type FloatUniform = ReturnType<typeof floatUniform>;

/** Constant linear-space vec3 from a CSS colour string. */
export const colorVec3 = (hex: string) => {
  const c = new Color(hex);
  return vec3(c.r, c.g, c.b);
};
