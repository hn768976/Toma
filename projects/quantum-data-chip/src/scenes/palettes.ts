import * as THREE from "three";

export type ChipPalette = {
  bgA: string;
  bgB: string;
  bgGlow: string;
  tick: string;
  tickBright: string;
  rail: string;
  chip: string;
  chipGlow: string;
  spark: string;
  dust: string;
  vignette: string;
};

/** Version 1 – matches the reference: deep navy, cyan-blue data, amber sparks. */
export const BLUE: ChipPalette = {
  bgA: "#010307",
  bgB: "#071d2b",
  bgGlow: "#0a3349",
  tick: "#20a8d4",
  tickBright: "#8ce2f6",
  rail: "#1a7da6",
  chip: "#c6f1ff",
  chipGlow: "#8fdcf2",
  spark: "#ff8a33",
  dust: "#5fb8ff",
  vignette: "#000000",
};

/** Version 2 – alternative palette: molten amber/gold data on warm black,
 *  with cyan sparks as the complementary accent. */
export const EMBER: ChipPalette = {
  bgA: "#040201",
  bgB: "#1c0b03",
  bgGlow: "#432006",
  tick: "#d8741c",
  tickBright: "#ffd08a",
  rail: "#b55a12",
  chip: "#fff3df",
  chipGlow: "#ffc27a",
  spark: "#2fd4ff",
  dust: "#ffb066",
  vignette: "#000000",
};

export const col = (hex: string) => new THREE.Color(hex);
