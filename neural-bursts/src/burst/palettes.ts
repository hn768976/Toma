import { hex, RGB } from "../lib/math";

export type BurstPalette = {
  sphereRim: RGB;
  sphereAccent: RGB;
  rays: [RGB, number][];
  beads: [RGB, number][];
  particles: [RGB, number][];
  node: RGB;
  star: RGB;
  core: RGB;
  background: RGB;
  bgGlow: RGB;
  /** Exposure trim: warm palettes read brighter at equal energy. */
  exposure: number;
};

// Version 1 — the reference look: electric blue / cyan network with sparse
// magenta and orange specks, violet-rimmed glass sphere.
export const BLUE: BurstPalette = {
  sphereRim: hex("#3f62ff"),
  sphereAccent: hex("#a03cff"),
  rays: [
    [hex("#8fd6ff"), 5],
    [hex("#4aa8ff"), 5],
    [hex("#3c64ff"), 3],
    [hex("#d9f2ff"), 2],
    [hex("#ff5fa8"), 0.5],
    [hex("#ffa255"), 0.4],
  ],
  beads: [
    [hex("#2f6bff"), 5],
    [hex("#41c2ff"), 4],
    [hex("#9fd2ff"), 3],
    [hex("#2333d8"), 2],
    [hex("#ff9a4a"), 0.6],
    [hex("#d7c0ff"), 0.6],
  ],
  particles: [
    [hex("#2f5bff"), 40],
    [hex("#2230d6"), 18],
    [hex("#3fb4ff"), 16],
    [hex("#9fd0ff"), 10],
    [hex("#7a52ff"), 7],
    [hex("#ff3f9e"), 1.2],
    [hex("#ff9440"), 0.8],
    [hex("#3dffd6"), 0.6],
  ],
  node: hex("#7fd0ff"),
  star: hex("#4b55ff"),
  core: hex("#56c8ff"),
  background: hex("#010106"),
  bgGlow: hex("#04103a"),
  exposure: 1,
};

// Version 2 — "solar" re-grade: gold / amber filaments with crimson and teal
// accents and a copper-rimmed sphere. Same structure and motion as V1.
export const SOLAR: BurstPalette = {
  sphereRim: hex("#ff8a2a"),
  sphereAccent: hex("#ff2f6d"),
  rays: [
    [hex("#ffd48a"), 5],
    [hex("#ffae45"), 5],
    [hex("#ff7a1f"), 3],
    [hex("#fff3dc"), 2],
    [hex("#ff3f6a"), 0.6],
    [hex("#46f0d2"), 0.4],
  ],
  beads: [
    [hex("#ff8c1a"), 5],
    [hex("#ffc04a"), 4],
    [hex("#ffe0a6"), 3],
    [hex("#d4410f"), 2],
    [hex("#3fe0d0"), 0.6],
    [hex("#ff6f9a"), 0.6],
  ],
  particles: [
    [hex("#ff8a1f"), 40],
    [hex("#d8450c"), 18],
    [hex("#ffc246"), 16],
    [hex("#ffe2a8"), 10],
    [hex("#ff4f5e"), 7],
    [hex("#ff2f8e"), 1.2],
    [hex("#3fe8d0"), 0.8],
    [hex("#fff6e0"), 0.6],
  ],
  node: hex("#ffd27f"),
  star: hex("#ff7a2a"),
  core: hex("#ffc45a"),
  background: hex("#060201"),
  bgGlow: hex("#2a0c02"),
  exposure: 0.8,
};
