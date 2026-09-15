// Colours are authored in sRGB hex. three's colour management converts
// them to the linear working space on the way into the shader, so every
// value here can be read as a swatch.

export const TISSUE = {
  enamel: "#FCFBF6",
  dentin: "#E6D6B4",
  root: "#D3BE97",
  gum: "#E4786F",
  gumDeep: "#AE3B3E",
  inflamed: "#D22B3C",
  stain: "#B98C4F",
  plaque: "#E5D4A4",
  tartar: "#DCC287",
  caries: "#241708",
  shield: "#6FE3FF",
  highlight: "#63D3FF",
} as const;

// Backdrops lifted from the reference set: a clinical white sweep, the
// pale medical blue, and the darker teal used for the whitening shots.
export const BACKDROPS = {
  clinicalWhite: { top: "#FFFFFF", bottom: "#DCE6EE" },
  medicalBlue: { top: "#DCEEFB", bottom: "#9FC7E4" },
  softBlue: { top: "#EAF4FC", bottom: "#BFD9EC" },
  deepTeal: { top: "#5E9BB8", bottom: "#27556E" },
  tissueRed: { top: "#C4515C", bottom: "#6E1E29" },
  studioGrey: { top: "#F2F4F6", bottom: "#C8D0D6" },
  paleMint: { top: "#EEF9F6", bottom: "#C2E2DC" },
} as const;

export type Backdrop = { top: string; bottom: string };

export type LightRig = {
  /**
   * "camera" interprets the directions below in view space, so the rig
   * travels with the shot. Dental enamel only reads as glossy when a
   * source sits near the view axis; pinning the rig to world space makes
   * the highlight slide off the buccal faces the moment the camera moves,
   * which is exactly what a nine-shot set cannot afford.
   */
  space: "camera" | "world";
  keyDir: [number, number, number];
  keyColor: string;
  keyIntensity: number;
  fillDir: [number, number, number];
  fillColor: string;
  fillIntensity: number;
  rimDir: [number, number, number];
  rimColor: string;
  rimIntensity: number;
  skyColor: string;
  skyIntensity: number;
  groundColor: string;
  groundIntensity: number;
  exposure: number;
  /** Angular radius of the key/fill sources; widens the specular lobe. */
  lightSize: number;
  /** Weight of the studio environment reflection. */
  envStrength: number;
};

// A soft clinical three-point rig, in view space: key up and to the left
// but still well in front, a cool fill opposite it to keep shadow sides
// from going muddy, and a back rim that separates the arch from a light
// backdrop.
export const CLINICAL_RIG: LightRig = {
  space: "camera",
  keyDir: [-0.38, 0.52, 0.76],
  keyColor: "#FFF6EC",
  keyIntensity: 1.12,
  fillDir: [0.72, 0.1, 0.68],
  fillColor: "#CFE2F2",
  fillIntensity: 0.34,
  rimDir: [0.12, 0.42, -0.9],
  rimColor: "#E8F3FF",
  rimIntensity: 0.42,
  skyColor: "#E6EAEC",
  skyIntensity: 0.34,
  groundColor: "#9A8078",
  groundIntensity: 0.2,
  exposure: 1.42,
  lightSize: 0.13,
  envStrength: 0.34,
};

export const macroRig = (overrides: Partial<LightRig> = {}): LightRig => ({
  ...CLINICAL_RIG,
  ...overrides,
});
