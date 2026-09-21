// The ten looks.
//
// This file is pure data. Adding an eleventh look means adding one row here and
// nothing else — the rig reads these fields and has no per-look branches.
//
// Colours and proportions were set against frames extracted from the reference
// clips, then revised after a round of blind comparison in which a separate
// reader was shown a reference frame and a render and asked only to list the
// differences. Four notes came back on nearly every look and drove this pass:
// each reference is composed around one dominant hero, the spikes are club or
// trumpet shaped rather than balls on sticks, the spike count wanted roughly
// doubling, and the film grain was reading as noise the references do not have.

import type { LookSpec } from "./types";

/** Shared defaults. A row overrides only what makes it different. */
const base = {
  heroIndex: 22,
  core: {
    detail: 4,
    displace: 0.038,
    displaceFreq: 2.6,
    mottleFreq: 5,
    mottleDark: 0.78,
    mottleLight: 1.16,
    mottleContrast: 1.7,
    // Low enough to give a specular sweep. The first pass was matte
    // everywhere, which read as plastic against the references' wet look.
    roughness: 0.52,
    metalness: 0.0,
  },
  spike: {
    scale: 1,
    stalkScale: 1,
    capScale: 1,
    roughness: 0.45,
    metalness: 0.0,
  },
} as const;

export const LOOKS: LookSpec[] = [
  // 1 -------------------------------------------------------------- Pale Mint
  {
    ...base,
    id: "PaleMint",
    name: "Pale Mint",
    seed: 0x1a3c_0001,
    background: {
      kind: "radial",
      inner: "#dcefe3",
      outer: "#8ec4aa",
      // Off-centre, matching the reference's diagonal light leak rather than a
      // symmetric vignette.
      centre: [0.6, 0.78],
      falloff: 1.15,
      dither: 1.2,
    },
    specks: {
      count: 420,
      colour: "#ffffff",
      sizeRange: [0.04, 0.2],
      opacity: 0.5,
    },
    particles: {
      count: 36,
      radiusRange: [0.34, 1.3],
      depthRange: [-20, 4.5],
      spread: 1.08,
      spikeCount: [108, 128],
      heroScale: 1.95,
      heroAt: [0.34, -0.36],
      heroDepth: 0.5,
    },
    heroIndex: 19,
    // Hollow flared cups, not lollipops: spikes facing the camera should read
    // as dark openings scattered over the body.
    spike: { ...base.spike, archetype: "trumpet", scale: 1.0, roughness: 0.32 },
    // Body and spikes are one glossy material in the reference; the earlier
    // pale-grey spikes inverted that relationship.
    colorways: [
      { core: "#27a45f", stalk: "#2fb268", cap: "#41c477", weight: 3 },
      { core: "#2aa878", stalk: "#33b884", cap: "#45c78f", weight: 1 },
    ],
    lighting: {
      ambient: 0.62,
      keyColour: "#ffffff",
      keyIntensity: 3.2,
      keyPosition: [-6, 7, 9],
      fillColour: "#cfe8da",
      fillIntensity: 0.6,
      fillPosition: [7, -3, 5],
      rimColour: "#ffffff",
      rimIntensity: 0.3,
      rimPosition: [0, 4, -8],
    },
    post: {
      focusDistance: 0,
      // Mild and selective: the reference keeps its background particles
      // legible, unlike the heavier looks.
      focusRange: 7.0,
      bokehScale: 3.5,
      bloomIntensity: 0.14,
      bloomThreshold: 0.9,
      grain: 0.009,
    },
    stillFrames: [80, 260, 470],
  },

  // 2 --------------------------------------------------------------- Lime Sun
  {
    ...base,
    id: "LimeSun",
    name: "Lime Sun",
    seed: 0x1a3c_0002,
    background: {
      kind: "radial",
      inner: "#c6d4d9",
      outer: "#8ab3bb",
      centre: [0.5, 0.58],
      falloff: 1.22,
      dither: 1.2,
    },
    flare: {
      at: [0.5, 0.6],
      radius: 0.22,
      intensity: 0.95,
      colour: "#fff8e8",
      streak: 5.5,
    },
    specks: {
      count: 520,
      colour: "#ffffff",
      sizeRange: [0.03, 0.14],
      opacity: 0.55,
    },
    particles: {
      count: 22,
      radiusRange: [0.3, 0.9],
      depthRange: [-19, 4],
      spread: 1.05,
      spikeCount: [116, 136],
      heroScale: 2.0,
      heroAt: [-0.32, 0.0],
      heroDepth: 0.0,
    },
    heroIndex: 15,
    core: { ...base.core, displace: 0.05, mottleFreq: 9, mottleContrast: 2.4 },
    spike: { ...base.spike, archetype: "cluster", scale: 1.5, roughness: 0.55 },
    // Strongly two-tone: bright chartreuse body against dark forest-green
    // florets. A single flat tone was the largest colour miss here.
    colorways: [
      { core: "#b3c63f", stalk: "#3d5a17", cap: "#43631a", weight: 3 },
      { core: "#c2d24c", stalk: "#456620", cap: "#4d7022", weight: 2 },
    ],
    lighting: {
      ambient: 0.5,
      keyColour: "#fff4dc",
      keyIntensity: 3.4,
      keyPosition: [3, 6, 8],
      fillColour: "#bcd2dc",
      fillIntensity: 0.45,
      fillPosition: [-6, -2, 5],
      rimColour: "#ffffff",
      rimIntensity: 0.4,
      rimPosition: [0, 3, -8],
    },
    post: {
      focusDistance: 0,
      focusRange: 3.6,
      bokehScale: 7.5,
      bloomIntensity: 0.4,
      bloomThreshold: 0.75,
      grain: 0.009,
    },
    stillFrames: [110, 300, 500],
  },

  // 3 ----------------------------------------------------------- Pastel Multi
  {
    ...base,
    id: "PastelMulti",
    name: "Pastel Multi",
    seed: 0x1a3c_0003,
    background: {
      kind: "radial",
      inner: "#c2d6e0",
      outer: "#7a94ab",
      centre: [0.47, 0.62],
      falloff: 1.3,
      dither: 1.4,
    },
    flare: {
      at: [0.47, 0.62],
      radius: 0.15,
      intensity: 0.95,
      colour: "#ffffff",
      streak: 0,
    },
    specks: {
      count: 420,
      colour: "#ffffff",
      sizeRange: [0.03, 0.14],
      opacity: 0.45,
    },
    particles: {
      count: 24,
      radiusRange: [0.32, 1.05],
      depthRange: [-18, 5.5],
      spread: 1.14,
      spikeCount: [88, 104],
      heroScale: 1.9,
      heroAt: [-0.3, 0.05],
      heroDepth: 0.5,
    },
    heroIndex: 16,
    core: { ...base.core, displace: 0.035, mottleFreq: 7, mottleContrast: 1.9 },
    // The brief calls for mushroom caps here, but both the reference and the
    // blind read describe clumped florets on a neck, so the field follows those.
    spike: { ...base.spike, archetype: "cluster", scale: 1.3, roughness: 0.5 },
    // Saturation raised and the hue pairs pushed apart: the washed-out version
    // read as grey fuzz rather than four distinct colourways.
    colorways: [
      { core: "#93b85c", stalk: "#6f4d92", cap: "#7d569f", weight: 3 },
      { core: "#6f93bd", stalk: "#8fa83f", cap: "#9cb548", weight: 2 },
      { core: "#5fae9d", stalk: "#b8687f", cap: "#c4748a", weight: 2 },
      { core: "#c08b98", stalk: "#6f86a0", cap: "#7d93ac", weight: 2 },
      { core: "#c0a77e", stalk: "#a06f77", cap: "#ad7b83", weight: 1 },
    ],
    lighting: {
      ambient: 0.68,
      keyColour: "#ffffff",
      keyIntensity: 2.6,
      keyPosition: [-5, 7, 8],
      fillColour: "#c2d4e4",
      fillIntensity: 0.6,
      fillPosition: [6, -3, 4],
      rimColour: "#ffffff",
      rimIntensity: 0.45,
      rimPosition: [0, 3, -8],
    },
    post: {
      focusDistance: 0,
      // The softest of the ten, but anchored: a thin focus band on the hero
      // with everything else falling away.
      focusRange: 2.4,
      bokehScale: 10.0,
      bloomIntensity: 0.35,
      bloomThreshold: 0.78,
      grain: 0.009,
    },
    stillFrames: [95, 285, 460],
  },

  // 4 -------------------------------------------------------------- Deep Navy
  {
    ...base,
    id: "DeepNavy",
    name: "Deep Navy",
    seed: 0x1a3c_0004,
    background: {
      kind: "radial",
      inner: "#2a2c58",
      outer: "#141232",
      centre: [0.5, 0.6],
      // Flatter than the other dark looks: the reference has a soft haze, not
      // a hard corner vignette.
      falloff: 0.85,
      dither: 2.0,
    },
    particles: {
      count: 22,
      radiusRange: [0.3, 0.95],
      depthRange: [-24, 4],
      spread: 1.05,
      spikeCount: [76, 92],
      heroScale: 1.95,
      heroAt: [-0.34, 0.02],
      heroDepth: 0.5,
    },
    heroIndex: 15,
    core: { ...base.core, displace: 0.055, displaceFreq: 3.0, mottleFreq: 6, mottleContrast: 2.0, roughness: 0.66 },
    // Flared goblet caps on thin crimson stalks, not pinheads.
    spike: { ...base.spike, archetype: "trumpet", scale: 1.2, capScale: 0.88, roughness: 0.45 },
    // Deep saturated violet, close in value to the body, so the particle reads
    // as one dark jewel-toned mass instead of bright dots on red.
    colorways: [
      { core: "#7e262f", stalk: "#a82b36", cap: "#56127a", weight: 3 },
      { core: "#6d2029", stalk: "#992630", cap: "#631785", weight: 2 },
    ],
    lighting: {
      ambient: 0.34,
      keyColour: "#ffe8e0",
      keyIntensity: 2.3,
      keyPosition: [-6, 7, 8],
      fillColour: "#4a4a9c",
      fillIntensity: 0.6,
      fillPosition: [7, -3, 4],
      rimColour: "#8f6fd6",
      rimIntensity: 1.4,
      rimPosition: [-2, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 3.0,
      bokehScale: 8.0,
      bloomIntensity: 0.3,
      bloomThreshold: 0.72,
      grain: 0.007,
    },
    stillFrames: [70, 250, 480],
  },

  // 5 ---------------------------------------------------------- Electric Blue
  {
    ...base,
    id: "ElectricBlue",
    name: "Electric Blue",
    seed: 0x1a3c_0005,
    background: {
      kind: "radial",
      inner: "#0b39a8",
      outer: "#03063f",
      centre: [0.44, 0.62],
      // Strong off-centre falloff; the flat version lost the reference's
      // near-black corners.
      falloff: 1.35,
      dither: 1.8,
    },
    specks: {
      count: 460,
      colour: "#e8f0ff",
      sizeRange: [0.025, 0.08],
      opacity: 0.7,
    },
    particles: {
      count: 20,
      radiusRange: [0.3, 1.0],
      depthRange: [-20, 5],
      spread: 1.06,
      spikeCount: [78, 94],
      heroScale: 1.85,
      heroAt: [-0.05, 0.05],
      heroDepth: 0.5,
    },
    heroIndex: 14,
    core: {
      ...base.core,
      displace: 0.05,
      displaceFreq: 2.0,
      // Low frequency and a very wide ramp: this is what marbles the core
      // black-to-white rather than merely speckling it.
      mottleFreq: 1.7,
      mottleDark: 0.006,
      mottleLight: 1.2,
      mottleContrast: 3.4,
      roughness: 0.4,
    },
    // Rounded bulbous knobs with a specular hotspot, not flat-topped cones.
    spike: { ...base.spike, archetype: "club", scale: 1.35, roughness: 0.3 },
    colorways: [{ core: "#cdd2d8", stalk: "#e8501f", cap: "#f4592e" }],
    lighting: {
      ambient: 0.32,
      keyColour: "#ffffff",
      keyIntensity: 3.3,
      keyPosition: [-5, 7, 9],
      fillColour: "#5f7fd8",
      fillIntensity: 0.4,
      fillPosition: [7, -2, 4],
      rimColour: "#9fb8ff",
      rimIntensity: 1.0,
      rimPosition: [0, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 2.8,
      bokehScale: 9.0,
      bloomIntensity: 0.16,
      bloomThreshold: 0.86,
      grain: 0.008,
    },
    stillFrames: [100, 290, 470],
  },

  // 6 ------------------------------------------------------------ Blood Field
  {
    ...base,
    id: "BloodField",
    name: "Blood Field",
    seed: 0x1a3c_0006,
    background: {
      kind: "radial",
      inner: "#a81513",
      outer: "#050102",
      // A broad band low in the frame rather than a tight circle.
      centre: [0.46, 0.4],
      falloff: 0.92,
      dither: 2.2,
    },
    particles: {
      // Dense and flat-packed: particles fill the frame edge to edge across
      // several depth layers, unlike the other nine.
      count: 88,
      radiusRange: [0.45, 1.25],
      depthRange: [-15, 2],
      spread: 1.3,
      spikeCount: [62, 78],
      heroScale: 1.5,
      heroAt: [-0.3, 0.3],
      heroDepth: 1.0,
    },
    heroIndex: 70,
    core: {
      ...base.core,
      displace: 0.022,
      mottleFreq: 12,
      mottleDark: 0.72,
      mottleLight: 1.26,
      mottleContrast: 2.4,
      roughness: 0.6,
    },
    // Branching tufts, not smooth cones: face-on the old cones degenerated
    // into flat dots and the spheres read as polka-dotted.
    spike: { ...base.spike, archetype: "cluster", scale: 1.15, stalkScale: 0.5, roughness: 0.5 },
    // Vivid crimson with lit edges, and a brighter cool white body — the
    // near-black maroon version read as soot rather than a red corona.
    colorways: [
      { core: "#d6dade", stalk: "#a8342e", cap: "#b03a33", weight: 3 },
      { core: "#c8ced3", stalk: "#932a26", cap: "#9d312b", weight: 2 },
    ],
    lighting: {
      ambient: 0.42,
      keyColour: "#fff2ec",
      keyIntensity: 2.2,
      keyPosition: [-5, 6, 9],
      fillColour: "#a33a30",
      fillIntensity: 0.8,
      fillPosition: [6, -3, 5],
      rimColour: "#e04a38",
      rimIntensity: 1.0,
      rimPosition: [0, 2, -9],
    },
    post: {
      focusDistance: 0,
      // Eased off: the heavier setting blurred the large near particles into
      // cotton wool and put the sharp band behind the subject.
      focusRange: 4.5,
      bokehScale: 6.0,
      bloomIntensity: 0.3,
      bloomThreshold: 0.7,
      grain: 0.008,
    },
    stillFrames: [85, 275, 455],
  },

  // 7 ------------------------------------------------------------- Black Cyan
  {
    ...base,
    id: "BlackCyan",
    name: "Black Cyan",
    seed: 0x1a3c_0007,
    background: {
      kind: "flat",
      inner: "#000000",
      outer: "#000000",
      // No dither. This look's black has to encode as true 0,0,0, and a
      // +/-1/255 dither would lift it. There is no gradient here to band.
      //
      // The reference actually carries a faint navy ambient haze and dust,
      // which the blind read flagged as missing. It stays out on purpose: the
      // brief requires a pure #000000 background here so the clip doubles as a
      // screen-blend overlay, and that requirement wins over the reference.
      dither: 0,
    },
    particles: {
      count: 20,
      radiusRange: [0.32, 1.05],
      depthRange: [-22, 4],
      spread: 1.05,
      spikeCount: [86, 102],
      heroScale: 1.9,
      heroAt: [0.22, -0.05],
      heroDepth: 0.5,
    },
    heroIndex: 14,
    core: { ...base.core, displace: 0.03, mottleFreq: 4.5, mottleDark: 0.5, mottleLight: 1.22, mottleContrast: 2.2, roughness: 0.45 },
    // Small flat heart caps on long fine stalks, packed close.
    spike: { ...base.spike, archetype: "stalk-teardrop", scale: 1.3, stalkScale: 0.92, capScale: 0.92, roughness: 0.42 },
    colorways: [
      { core: "#1682b8", stalk: "#9c8ba8", cap: "#d42116", weight: 3 },
      { core: "#1c91ca", stalk: "#a695b2", cap: "#c9251a", weight: 2 },
    ],
    lighting: {
      ambient: 0.18,
      keyColour: "#ffffff",
      keyIntensity: 3.0,
      keyPosition: [-5, 6, 9],
      fillColour: "#2f6f9c",
      fillIntensity: 0.5,
      fillPosition: [7, -3, 4],
      rimColour: "#4fb0e0",
      rimIntensity: 1.2,
      rimPosition: [-1, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 3.2,
      bokehScale: 8.5,
      // Threshold kept high so bloom cannot bleed into the corners and lift
      // them off zero.
      bloomIntensity: 0.16,
      bloomThreshold: 0.93,
      // Grain is off for the same reason as the dither.
      grain: 0,
    },
    stillFrames: [90, 280, 465],
  },

  // 8 ------------------------------------------------------------- Bokeh Dark
  {
    ...base,
    id: "BokehDark",
    name: "Bokeh Dark",
    seed: 0x1a3c_0008,
    background: {
      // Warm maroon ambient rather than dead black; the flat version lost the
      // reference's atmosphere.
      kind: "radial",
      inner: "#2a1210",
      outer: "#070303",
      centre: [0.38, 0.6],
      falloff: 1.15,
      dither: 2.0,
    },
    bokeh: {
      count: 40,
      colours: ["#c4361a", "#8f2412", "#d85a3a", "#2e343c", "#5a2c22"],
      sizeRange: [2.6, 8.0],
      opacity: 0.5,
    },
    specks: {
      count: 380,
      colour: "#e8ded0",
      sizeRange: [0.025, 0.09],
      opacity: 0.55,
    },
    particles: {
      count: 22,
      radiusRange: [0.3, 0.95],
      depthRange: [-19, 4],
      spread: 1.05,
      spikeCount: [26, 34],
      heroScale: 1.85,
      heroAt: [-0.02, 0.0],
      heroDepth: 0.5,
    },
    heroIndex: 15,
    core: {
      ...base.core,
      // Rough and stony, and darker: the pale periwinkle version blew out.
      displace: 0.065,
      displaceFreq: 3.2,
      mottleFreq: 9,
      mottleDark: 0.55,
      mottleLight: 1.3,
      mottleContrast: 2.2,
      roughness: 0.62,
    },
    // Sparse, long and glossy — the reference's crown of big flared heads,
    // not a dense pelt of studs.
    spike: { ...base.spike, archetype: "cluster", scale: 2.1, roughness: 0.28 },
    colorways: [
      { core: "#5d6c7d", stalk: "#9b1f2a", cap: "#a82430", weight: 3 },
      { core: "#52606f", stalk: "#871a24", cap: "#951e29", weight: 2 },
    ],
    capAccent: { colour: "#8d7f28", fraction: 0.05 },
    lighting: {
      ambient: 0.3,
      keyColour: "#fff2e8",
      keyIntensity: 3.0,
      keyPosition: [-6, 6, 8],
      fillColour: "#3f5266",
      fillIntensity: 0.5,
      fillPosition: [7, -2, 4],
      rimColour: "#c4664a",
      rimIntensity: 1.1,
      rimPosition: [0, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 2.6,
      bokehScale: 9.5,
      bloomIntensity: 0.32,
      bloomThreshold: 0.7,
      grain: 0.007,
    },
    stillFrames: [105, 295, 475],
  },

  // 9 -------------------------------------------------------------- Glow Blue
  {
    ...base,
    id: "GlowBlue",
    name: "Glow Blue",
    seed: 0x1a3c_0009,
    background: {
      // Lifted charcoal with a broad blue bloom through the middle, which is
      // what carries this look — a per-particle halo alone was not enough.
      kind: "radial",
      inner: "#23334f",
      outer: "#14161c",
      centre: [0.5, 0.55],
      falloff: 1.0,
      dither: 2.0,
    },
    specks: {
      count: 300,
      colour: "#cfe0f2",
      sizeRange: [0.025, 0.1],
      opacity: 0.5,
    },
    particles: {
      count: 16,
      radiusRange: [0.3, 0.85],
      depthRange: [-18, 3],
      spread: 1.02,
      spikeCount: [64, 78],
      heroScale: 2.0,
      heroAt: [0.0, 0.0],
      heroDepth: 0.5,
    },
    heroIndex: 11,
    core: { ...base.core, displace: 0.02, mottleFreq: 4, mottleDark: 0.84, mottleLight: 1.16, roughness: 0.35 },
    // Flared mushroom caps on a short stalk, densely packed.
    spike: { ...base.spike, archetype: "club", scale: 1.15, stalkScale: 0.45, capScale: 1.1, roughness: 0.45 },
    // Periwinkle, not white: the desaturated version lost the blue-body /
    // red-spike contrast that defines this look.
    colorways: [{ core: "#5c83cc", stalk: "#8e201e", cap: "#9a2320" }],
    rimGlow: { colour: "#2f7ed4", size: 2.6, intensity: 1.2 },
    lighting: {
      ambient: 0.38,
      keyColour: "#ffffff",
      keyIntensity: 1.8,
      keyPosition: [-5, 6, 9],
      fillColour: "#3f5f8c",
      fillIntensity: 0.6,
      fillPosition: [6, -3, 4],
      rimColour: "#5f8fd6",
      rimIntensity: 1.2,
      rimPosition: [0, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 2.6,
      bokehScale: 9.0,
      // Bloom is here to carry the rim glow, not the whole frame.
      bloomIntensity: 0.5,
      bloomThreshold: 0.62,
      grain: 0.006,
    },
    stillFrames: [75, 265, 450],
  },

  // 10 --------------------------------------------------------- Amber Horizon
  {
    ...base,
    id: "AmberHorizon",
    name: "Amber Horizon",
    seed: 0x1a3c_000a,
    background: {
      // A warm bloom in the upper-left corner over a dark navy base. The brief
      // describes a vertical two-tone ramp, but the reference reads as a
      // corner light source, and a radial centred high-left still runs amber
      // at the top to blue at the bottom.
      kind: "radial",
      inner: "#d4892a",
      outer: "#10182e",
      centre: [0.14, 0.94],
      falloff: 1.55,
      dither: 2.0,
    },
    specks: {
      count: 340,
      colour: "#b8c8e0",
      sizeRange: [0.025, 0.1],
      opacity: 0.5,
      // Fine specks concentrated in the lower blue region.
      yBand: [0.0, 0.55],
    },
    particles: {
      count: 22,
      radiusRange: [0.3, 0.95],
      depthRange: [-19, 4],
      spread: 1.04,
      spikeCount: [96, 114],
      heroScale: 2.0,
      heroAt: [-0.1, -0.05],
      heroDepth: 0.5,
    },
    heroIndex: 15,
    core: {
      ...base.core,
      // Granular and cool silver-grey rather than blown-out white.
      displace: 0.02,
      displaceFreq: 4.2,
      mottleFreq: 13,
      mottleDark: 0.74,
      mottleLight: 1.18,
      mottleContrast: 2.2,
      roughness: 0.66,
    },
    spike: { ...base.spike, archetype: "cluster", scale: 1.35, roughness: 0.5 },
    colorways: [{ core: "#b9bdbd", stalk: "#b8493f", cap: "#c2564a" }],
    capAccent: { colour: "#7d8a3a", fraction: 0.1 },
    lighting: {
      ambient: 0.45,
      keyColour: "#ffd9a0",
      keyIntensity: 3.0,
      // Behind the upper-left edge, matching the corner bloom.
      keyPosition: [-4, 8, -2],
      fillColour: "#5f7099",
      fillIntensity: 0.6,
      fillPosition: [5, -3, 6],
      rimColour: "#ffb066",
      rimIntensity: 1.2,
      rimPosition: [-3, 5, -8],
    },
    post: {
      focusDistance: 0,
      focusRange: 2.8,
      bokehScale: 9.0,
      bloomIntensity: 0.3,
      bloomThreshold: 0.75,
      grain: 0.007,
    },
    stillFrames: [88, 282, 468],
  },
];

export const LOOK_BY_ID = Object.fromEntries(LOOKS.map((l) => [l.id, l]));
