import { z } from "zod";

// Three colourways over identical choreography. Flares are bought on colour
// more than on motion, so these are three products, not one plus filler —
// the burst timing is byte-for-byte the same across all of them.

export const paletteSchema = z.object({
  /** Deep base the whole frame sits on. */
  base: z.string(),
  /** Three haze cloud colours: dominant mass, mid mass, secondary mass. */
  haze: z.tuple([z.string(), z.string(), z.string()]),
  /** The white-hot centre of the core. */
  hot: z.string(),
  /** Inner -> mid -> outer stops of the core's falloff. */
  falloff: z.tuple([z.string(), z.string(), z.string()]),
  /** Iris / secondary ring tint. */
  ring: z.string(),
  /** Ghosts alternate between these two tints along the axis. */
  ghostWarm: z.string(),
  ghostCool: z.string(),
  /** Anamorphic streak tint. */
  streak: z.string(),
});

export type Palette = z.infer<typeof paletteSchema>;

// V1 — warm gold. The reference match: amber/orange core over blue haze.
export const GOLD: Palette = {
  base: "#050a14",
  haze: ["#1f7fc4", "#0d2440", "#123a5e"],
  hot: "#fffdf5",
  falloff: ["#ffcf6b", "#e8721f", "#8c2f1a"],
  ring: "#dceaf7",
  ghostWarm: "#ffb27a",
  ghostCool: "#8fc6f0",
  streak: "#cfe2ff",
};

// V2 — cool white/blue. Clinical, tech-product feel: the core never goes
// warm, and the haze is pushed toward steel rather than cyan.
export const BLUE: Palette = {
  base: "#040912",
  haze: ["#2f93d6", "#102a45", "#1b4c78"],
  hot: "#ffffff",
  falloff: ["#e6f3ff", "#7bb7f5", "#1d4c8c"],
  ring: "#eaf4ff",
  ghostWarm: "#bcd9ff",
  ghostCool: "#6fa8e6",
  streak: "#dceeff",
};

// V3 — magenta/violet. Purple core against a teal counter-haze, which is
// what keeps the complementary contrast from going muddy.
export const MAGENTA: Palette = {
  base: "#08061a",
  haze: ["#12a4a2", "#231447", "#1c5f74"],
  hot: "#fff2ff",
  falloff: ["#ffb0f0", "#c33bd0", "#4a1060"],
  ring: "#f2e2fb",
  ghostWarm: "#ff9de8",
  ghostCool: "#63e0d2",
  streak: "#c8f0f4",
};
