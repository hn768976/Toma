export type Palette = {
  /** Core -> outer ramp. c0 is the near-white centre, c3 the deep outer reach. */
  c0: string;
  c1: string;
  c2: string;
  c3: string;
  /** Ghosts alternate between these two tints down the axis. */
  ghostA: string;
  ghostB: string;
  /** Tint of the iris ring. */
  ring: string;
};

export const WARM: Palette = {
  c0: "#fffaf0",
  c1: "#ffdca8",
  c2: "#c4682a",
  c3: "#5a2010",
  ghostA: "#ffc981", // warm amber
  ghostB: "#8fa896", // cool green-grey
  ring: "#ffe6bf",
};

export const COOL: Palette = {
  c0: "#f4f8ff",
  c1: "#b8d8f0",
  c2: "#2f6c9c",
  c3: "#0a2038",
  ghostA: "#9ccdf2", // cool blue
  ghostB: "#d8b18a", // warm counter-tint
  ring: "#dceaff",
};

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/**
 * Hex (sRGB) -> linear-light RGB triple. All of the compositing happens in
 * linear light, which is what makes the falloffs read as light rather than as
 * a paint gradient; the shader encodes back to sRGB as its last step.
 */
export const hexToLinear = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
};
