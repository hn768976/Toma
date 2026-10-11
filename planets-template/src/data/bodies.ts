// Body metadata written by scripts/build-bodies.mjs (one meta.json per body).
import mercury from "../../public/bodies/mercury/meta.json";
import venus from "../../public/bodies/venus/meta.json";
import mars from "../../public/bodies/mars/meta.json";
import jupiter from "../../public/bodies/jupiter/meta.json";
import saturn from "../../public/bodies/saturn/meta.json";
import uranus from "../../public/bodies/uranus/meta.json";
import neptune from "../../public/bodies/neptune/meta.json";
import pluto from "../../public/bodies/pluto/meta.json";
import ceres from "../../public/bodies/ceres/meta.json";

export type Atmosphere = {
  color: [number, number, number];
  strength: number;
  thickness: number;
  crescent: number;
};

export type BodyMeta = {
  id: string;
  name: string;
  kind: "planet" | "dwarf";
  radiusKm: number;
  flattening: number;
  obliquityDeg: number;
  retrograde: boolean;
  maps: { color: string; normal: string; width: number; height: number };
  surface: {
    saturation: number;
    wrap: number;
    normalStrength: number;
    limbDarkening?: number;
  };
  atmosphere: Atmosphere | null;
  rings: { texture: string; inner: number; outer: number } | null;
  greatRedSpot?: { latDeg: number; lonDeg: number };
};

export const BODIES = {
  mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, ceres,
} as unknown as Record<BodyId, BodyMeta>;

export type BodyId =
  | "mercury" | "venus" | "mars" | "jupiter" | "saturn"
  | "uranus" | "neptune" | "pluto" | "ceres";
