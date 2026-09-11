import type { FieldSpec } from "./field";
import type { ColourwayId } from "./types";

export type Colourway = {
  id: ColourwayId;
  /** Background field, fitted to the reference (see field.ts). */
  field: FieldSpec;
  // Subject treatment.
  outline: string; // crisp near-white edge
  glow: string; // outer glow around the outline
  fill: string; // translucent interior
  rim: string; // inner rim brightening
  // HUD ring assembly.
  arcLeft: string;
  arcRight: string;
  ring: string;
  // Central burst / streak / sparkles / mesh.
  burst: string;
  streak: string;
  sparkle: string;
  mesh: string;
};

// Geometry of the two casts and the halo is identical between colourways —
// only the base tint and the cast colours change, so the pair reads as a set.
const GEOMETRY = {
  ramp: [42.6, 119, 115.6] as [number, number, number],
  bottomShade: 0.174,
  leftGeom: { x: 0.351, sx: 0.211, sy: 0.24 },
  rightGeom: { x: 0.645, sx: 0.208, sy: 0.234 },
  halo: { scale: 0.58, power: 2.92 },
};

const field = (
  tint: [number, number, number],
  leftColour: [number, number, number],
  rightColour: [number, number, number],
  haloColour: [number, number, number],
  // A tinted base is lighter than the pure-blue one at the same magnitude;
  // scaling the ramp keeps both colourways at the same depth.
  rampScale = 1,
): FieldSpec => ({
  ramp: GEOMETRY.ramp.map((v) => v * rampScale) as [number, number, number],
  tint,
  bottomShade: GEOMETRY.bottomShade,
  left: { ...GEOMETRY.leftGeom, colour: leftColour },
  right: { ...GEOMETRY.rightGeom, colour: rightColour },
  halo: { ...GEOMETRY.halo, colour: haloColour },
});

export const COLOURWAYS: Record<ColourwayId, Colourway> = {
  // Reference match: deep blue field, violet cast on the left, cleaner blue
  // on the right. Base ramp and cast colours come straight from the fit.
  blue: {
    id: "blue",
    field: field([0, 0, 1], [71, 33.5, 111.6], [0, 88.6, 106.7], [31.4, 47.2, 45.2]),
    outline: "#d8f4ff",
    glow: "#7fe3ff",
    fill: "#8fe4ff",
    rim: "#c8f4ff",
    arcLeft: "#7a4ae8",
    arcRight: "#22d3ee",
    ring: "#9ed8ff",
    burst: "#e6f8ff",
    streak: "#ffffff",
    sparkle: "#ffffff",
    mesh: "#bfe8ff",
  },
  // Same field geometry, hues rotated: violet base, magenta cast on the left,
  // blue on the right.
  violet: {
    id: "violet",
    field: field([0.42, 0.13, 1], [112, 20, 95], [20, 52, 128], [40, 38, 48], 0.92),
    outline: "#f0d8ff",
    glow: "#d59cff",
    fill: "#c99cff",
    rim: "#f2dcff",
    arcLeft: "#e026c0",
    arcRight: "#4a6ae8",
    ring: "#d9bfff",
    burst: "#f6ecff",
    streak: "#ffffff",
    sparkle: "#ffffff",
    mesh: "#e4d0ff",
  },
};

export const COLOURWAY_IDS = Object.keys(COLOURWAYS) as ColourwayId[];
