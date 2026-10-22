import { z } from "zod";

export type Palette = {
  /** Screen-space background gradient (centre → edge). */
  bgCenter: string;
  bgMid: string;
  bgEdge: string;
  /** Main accent: rings, card borders, icons. */
  primary: string;
  /** Secondary accent: the violet/magenta half of the gradients. */
  secondary: string;
  /** Dashed data lines and arrows. */
  line: string;
  /** Floor labels. */
  text: string;
  textDim: string;
  /** Glass tiles. */
  glassFill: string;
  glassBorder: string;
  /** Floating specks. */
  specks: string[];
  /** Hot core of the processor chip. */
  core: string;
};

// Matches the reference: deep teal backdrop, cyan glass, violet accents.
export const TEAL_PALETTE: Palette = {
  bgCenter: "#003a48",
  bgMid: "#00222e",
  bgEdge: "#000a12",
  primary: "#4fe6ff",
  secondary: "#b45cff",
  line: "#52e8cf",
  text: "#7ff7e2",
  textDim: "#3f8f8a",
  glassFill: "rgba(110, 215, 235, 0.10)",
  glassBorder: "rgba(160, 240, 255, 0.75)",
  specks: ["#46e3ff", "#c6e85a", "#3fd6b8", "#2fa7d8"],
  core: "#eafffe",
};

// Alternate version: warm "solar" amber and rose on a plum-black backdrop.
export const SOLAR_PALETTE: Palette = {
  bgCenter: "#3a1a26",
  bgMid: "#22101a",
  bgEdge: "#0b0408",
  primary: "#ffb547",
  secondary: "#ff4f8b",
  line: "#ffcf73",
  text: "#ffd99a",
  textDim: "#a0705a",
  glassFill: "rgba(255, 190, 120, 0.09)",
  glassBorder: "rgba(255, 215, 160, 0.75)",
  specks: ["#ffc35a", "#ff7a9c", "#ffe7a8", "#ff9147"],
  core: "#fff6e6",
};

export const PALETTES = {
  teal: TEAL_PALETTE,
  solar: SOLAR_PALETTE,
} as const;

export const compSchema = z.object({
  palette: z.enum(["teal", "solar"]),
});

export type CompProps = z.infer<typeof compSchema>;
