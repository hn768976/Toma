/**
 * The nine compositions, as data.
 *
 * Everything that separates one composition from another lives in this file:
 * palette, cluster size, packing density, background, deflation behaviour,
 * blur strength and framing. The generator, material, motion system, camera
 * rig and post chain are fixed. Adding a look means adding a row here — see
 * the README.
 *
 * Nothing in this project renders a human figure, a body, a torso, a
 * silhouette or any anatomical form, in any composition, at any frame. These
 * are stylised cell clusters and nothing else.
 */

import { Lighting } from "./CellMaterial";

export type Palette = {
  /** Lit cell colour. */
  cell: string;
  /** What the crevices between cells fall toward. */
  deep: string;
  /** Fresnel rim hue — warmer and more saturated than the cell. */
  rim: string;
  rimStrength: number;
  sheen: string;
  sheenStrength: number;
  /** Background gradient: centre, edge, and how tight the centre lift is. */
  bgCentre: string;
  bgEdge: string;
  bgFalloff: number;
  /** Surface mottling as a fraction of cell radius. */
  mottleAmp: number;
  mottleFreq: number;
  aoStrength: number;
  aoGamma: number;
  roughness: number;
};

export type DofSpec = {
  /**
   * Offset of the focal plane from the hero cluster, in world units. 0 focuses
   * on the hero itself (looks 1, 3, 4); the tissue look pulls it forward onto
   * the front layer.
   */
  focusDistance: number;
  /** Depth either side of it that stays sharp. */
  focusRange: number;
  /** Blur size. Look 1 is heavy, look 2 mild, look 4 moderate. */
  bokehScale: number;
  /**
   * Resolution the blur passes run at. The bokeh kernel has a fixed number of
   * taps, so a large radius measured in texels of a big buffer shows its ring
   * pattern as striations along a sharp silhouette. Running the blur at a
   * quarter resolution keeps the same radius on screen while each tap covers
   * four times the area, which softens the rings away.
   */
  resolutionScale: number;
};

export type LookKind = "floating" | "tissue" | "shrinking" | "fibre";

export type LookRow = {
  /** Remotion composition id. */
  id: string;
  /** Output file base name. */
  file: string;
  kind: LookKind;
  /** Seeds every build-time draw for this composition. */
  seed: string;
  /** Looks 1, 2 and 4 close exactly at t = 1. Look 3 deliberately does not. */
  loops: boolean;
  palette: Palette;
  lighting: Lighting;
  /**
   * fov, and how much of the frame the hero fills: the hero cluster's radius
   * as a fraction of the frame half-height. The camera distance is derived
   * from it at build time, so changing the cell count reframes automatically
   * instead of silently changing the shot.
   */
  camera: { fov: number; fill: number };
  dof: DofSpec;
  /** Film grain, as a fraction. 1.5-2.5% across the set. */
  grain: number;
  /** Cells in the hero cluster or the front tissue mass. */
  heroCells: number;
  /** Marching-cubes resolution for the hero mesh. */
  heroResolution: number;
  /** Crease size at a contact, in cell radii. Small keeps cells countable. */
  blend: number;
  /** How far cells press into each other at rest. */
  overlap: number;
  /** Packing density; the tissue looks pack tighter than the floating ones. */
  density?: number;
  /** Half-extent of the cluster per axis, in cell radii. */
  extent: [number, number, number];
  /** Background clusters, and how far back they are scattered. */
  backdropCount: number;
  backdropDepth: [number, number];
  /** Drift amplitude as a fraction of cluster diameter. */
  drift: number;
  /** Dust specks; 0 disables them. */
  specks: number;
  /** Membrane over the mass: 0 absent, 1 prominent. */
  membrane: number;
  /**
   * Tissue looks only. "full" packs one continuous slab that overfills the
   * frame, so no pixel of the sharp layer lands on background. "broken" packs
   * several separate masses with the field showing between them.
   */
  tissue?: "full" | "broken";
  /** Fibrous strands crossing the frame. */
  fibres: number;
  /** Frames the stills harvest samples. Three per composition. */
  stills: [number, number, number];
};

const WARM_LIGHT: Lighting = {
  keyDirection: [-0.55, 0.72, 0.62],
  keyColor: "#fff4e2",
  keyIntensity: 0.98,
  fillDirection: [0.75, -0.3, 0.45],
  fillColor: "#ffdcc0",
  fillIntensity: 0.38,
  rimDirection: [0.1, 0.25, -1],
  rimLightColor: "#ffd9a8",
  rimLightIntensity: 0.12,
  ambientColor: "#ffeedd",
  ambientIntensity: 0.3,
};

const COOL_LIGHT: Lighting = {
  ...WARM_LIGHT,
  keyColor: "#fff2e0",
  keyIntensity: 1.12,
  fillColor: "#cfe0f0",
  fillIntensity: 0.34,
  ambientColor: "#dce8f2",
  ambientIntensity: 0.26,
};

const DARK_LIGHT: Lighting = {
  keyDirection: [-0.5, 0.6, 0.7],
  keyColor: "#ffeccd",
  keyIntensity: 0.95,
  fillDirection: [0.8, -0.35, 0.3],
  fillColor: "#7e93a8",
  fillIntensity: 0.3,
  // The dark look adds a rim from behind, to separate the cluster from the
  // field and to catch the strands crossing in front of it.
  rimDirection: [0.25, 0.45, -1],
  rimLightColor: "#ffb765",
  rimLightIntensity: 0.9,
  ambientColor: "#2c3a48",
  ambientIntensity: 0.22,
};

export const LOOKS: LookRow[] = [
  // --- Look 1 - Floating Cluster ------------------------------------------
  {
    id: "FloatingCluster-Beige",
    file: "FloatingCluster_Beige",
    kind: "floating",
    seed: "floating-beige-01",
    loops: true,
    palette: {
      cell: "#f2dda4", deep: "#a86c22", rim: "#ffc972", rimStrength: 0.46,
      sheen: "#ffe6b4", sheenStrength: 0.2,
      bgCentre: "#e7dbd0", bgEdge: "#cdbcae", bgFalloff: 1.15,
      mottleAmp: 0.015, mottleFreq: 2.4, aoStrength: 1.0, aoGamma: 1.6,
      roughness: 0.45,
    },
    lighting: WARM_LIGHT,
    camera: { fov: 36, fill: 0.82 },
    dof: { focusDistance: 0, focusRange: 6.5, bokehScale: 17, resolutionScale: 0.25 },
    grain: 0.02,
    heroCells: 46, heroResolution: 140, blend: 0.13, overlap: 0.13, density: 0.8,
    extent: [1.05, 1.0, 0.95],
    backdropCount: 7, backdropDepth: [-30, 8],
    drift: 0.11, specks: 90, membrane: 0, fibres: 0,
    stills: [40, 150, 250],
  },
  {
    id: "FloatingCluster-CoolGrey",
    file: "FloatingCluster_CoolGrey",
    kind: "floating",
    seed: "floating-coolgrey-07",
    loops: true,
    palette: {
      // The cells are deliberately warmer and more orange here; the opposition
      // against the cool field is the whole point of this variant.
      cell: "#ffce84", deep: "#a85a17", rim: "#ffab48", rimStrength: 0.55,
      sheen: "#ffd79a", sheenStrength: 0.24,
      bgCentre: "#6c7d8b", bgEdge: "#2e3740", bgFalloff: 0.95,
      mottleAmp: 0.018, mottleFreq: 2.2, aoStrength: 1.0, aoGamma: 1.8,
      roughness: 0.44,
    },
    lighting: COOL_LIGHT,
    camera: { fov: 34, fill: 1.0 },
    dof: { focusDistance: 0, focusRange: 6.0, bokehScale: 19, resolutionScale: 0.25 },
    grain: 0.022,
    heroCells: 26, heroResolution: 132, blend: 0.15, overlap: 0.15, density: 0.82,
    extent: [1.0, 1.0, 0.95],
    backdropCount: 6, backdropDepth: [-26, 7],
    drift: 0.1, specks: 130, membrane: 0, fibres: 0,
    stills: [30, 150, 260],
  },
  {
    id: "FloatingCluster-Minimal",
    file: "FloatingCluster_Minimal",
    kind: "floating",
    seed: "floating-minimal-33",
    loops: true,
    palette: {
      cell: "#f6e5ac", deep: "#b88a35", rim: "#ffd484", rimStrength: 0.4,
      sheen: "#ffefc4", sheenStrength: 0.18,
      bgCentre: "#e9dcc4", bgEdge: "#d2bf9f", bgFalloff: 1.3,
      mottleAmp: 0.012, mottleFreq: 2.4, aoStrength: 1.0, aoGamma: 1.75,
      roughness: 0.46,
    },
    lighting: WARM_LIGHT,
    camera: { fov: 32, fill: 0.86 },
    dof: { focusDistance: 0, focusRange: 6.5, bokehScale: 15, resolutionScale: 0.25 },
    grain: 0.018,
    heroCells: 30, heroResolution: 132, blend: 0.17, overlap: 0.17, density: 0.84,
    extent: [1.0, 1.0, 0.92],
    // Quietest composition of the four: one cluster, a couple of small cells
    // at the frame edges, and a large clear region to put text beside.
    backdropCount: 3, backdropDepth: [-24, 6],
    drift: 0.12, specks: 40, membrane: 0, fibres: 0,
    stills: [20, 150, 270],
  },

  // --- Look 2 - Packed Tissue ---------------------------------------------
  {
    id: "PackedTissue-Golden",
    file: "PackedTissue_Golden",
    kind: "tissue",
    seed: "tissue-golden-11",
    loops: true,
    palette: {
      cell: "#f8c95f", deep: "#5e2703", rim: "#ffa93c", rimStrength: 0.3,
      sheen: "#ffd98e", sheenStrength: 0.3,
      bgCentre: "#c07a28", bgEdge: "#7d4610", bgFalloff: 1.0,
      mottleAmp: 0.016, mottleFreq: 2.6, aoStrength: 1.0, aoGamma: 3.0,
      roughness: 0.42,
    },
    lighting: {
      ...WARM_LIGHT,
      keyIntensity: 1.25,
      fillIntensity: 0.22,
      ambientColor: "#c98b3c",
      ambientIntensity: 0.16,
    },
    camera: { fov: 42, fill: 2.72 },
    dof: { focusDistance: 4.6, focusRange: 3.0, bokehScale: 7, resolutionScale: 0.25 },
    grain: 0.02,
    // A wide, shallow slab: the frame has to read as roughly a dozen cells
    // across, which needs a couple of hundred of them at this framing.
    heroCells: 487, heroResolution: 310, blend: 0.1, overlap: 0.2, density: 0.72,
    extent: [23, 12, 5.5],
    backdropCount: 0, backdropDepth: [-22, 2],
    drift: 0.04, specks: 60, membrane: 1, fibres: 0, tissue: "full",
    stills: [0, 150, 299],
  },
  {
    id: "PackedTissue-White",
    file: "PackedTissue_White",
    kind: "tissue",
    seed: "tissue-white-42",
    loops: true,
    palette: {
      cell: "#fdf0cf", deep: "#b4813d", rim: "#ffdd9e", rimStrength: 0.22,
      sheen: "#fffaef", sheenStrength: 0.26,
      bgCentre: "#f7f5f1", bgEdge: "#e6e3de", bgFalloff: 1.4,
      mottleAmp: 0.014, mottleFreq: 2.8, aoStrength: 1.0, aoGamma: 1.9,
      roughness: 0.4,
    },
    lighting: { ...WARM_LIGHT, keyIntensity: 1.0, fillIntensity: 0.45, ambientIntensity: 0.42 },
    camera: { fov: 42, fill: 2.0 },
    dof: { focusDistance: 3.6, focusRange: 3.0, bokehScale: 8, resolutionScale: 0.25 },
    grain: 0.016,
    // Higher key, and the masses are broken up so white shows between them.
    heroCells: 130, heroResolution: 230, blend: 0.1, overlap: 0.18, density: 0.66,
    extent: [13, 6.5, 3.4],
    backdropCount: 6, backdropDepth: [-24, 3],
    drift: 0.05, specks: 50, membrane: 0.5, fibres: 0, tissue: "broken",
    stills: [0, 150, 299],
  },

  // --- Look 3 - Shrinking Cell - NOT LOOPS --------------------------------
  {
    id: "ShrinkingCell-Warm",
    file: "ShrinkingCell_Warm",
    kind: "shrinking",
    seed: "shrink-warm-05",
    loops: false,
    palette: {
      cell: "#f5e4bc", deep: "#b08a52", rim: "#ffd694", rimStrength: 0.26,
      sheen: "#fff0d2", sheenStrength: 0.2,
      bgCentre: "#e8d9bd", bgEdge: "#b99a72", bgFalloff: 1.0,
      mottleAmp: 0.012, mottleFreq: 2.2, aoStrength: 1.0, aoGamma: 1.7,
      roughness: 0.46,
    },
    lighting: WARM_LIGHT,
    camera: { fov: 40, fill: 2.35 },
    dof: { focusDistance: 0, focusRange: 4.2, bokehScale: 12, resolutionScale: 0.25 },
    grain: 0.02,
    // Starts as a packed field of large smooth cells filling the frame.
    heroCells: 60, heroResolution: 36, blend: 0.14, overlap: 0.12, density: 0.66,
    extent: [8.0, 4.3, 1.7],
    backdropCount: 3, backdropDepth: [-20, 4],
    drift: 0.1, specks: 120, membrane: 0, fibres: 0, tissue: "full",
    stills: [10, 140, 285],
  },
  {
    id: "ShrinkingCell-Cool",
    file: "ShrinkingCell_Cool",
    kind: "shrinking",
    seed: "shrink-cool-23",
    loops: false,
    palette: {
      cell: "#f6dfa6", deep: "#a8813c", rim: "#ffcd7c", rimStrength: 0.3,
      sheen: "#ffeec6", sheenStrength: 0.22,
      bgCentre: "#9fb0bd", bgEdge: "#232a31", bgFalloff: 0.8,
      mottleAmp: 0.012, mottleFreq: 2.2, aoStrength: 1.0, aoGamma: 1.75,
      roughness: 0.45,
    },
    lighting: COOL_LIGHT,
    camera: { fov: 34, fill: 0.72 },
    dof: { focusDistance: 0, focusRange: 5.5, bokehScale: 13, resolutionScale: 0.25 },
    grain: 0.022,
    heroCells: 10, heroResolution: 44, blend: 0.16, overlap: 0.16, density: 0.66,
    extent: [1.0, 1.0, 0.95],
    backdropCount: 2, backdropDepth: [-22, 5],
    drift: 0.12, specks: 220, membrane: 0, fibres: 0,
    stills: [8, 150, 290],
  },

  // --- Look 4 - Dark Fibre ------------------------------------------------
  {
    id: "DarkFibre-Orange",
    file: "DarkFibre_Orange",
    kind: "fibre",
    seed: "fibre-orange-19",
    loops: true,
    palette: {
      cell: "#ff9a24", deep: "#8e3505", rim: "#ff7a10", rimStrength: 0.42,
      sheen: "#ffb060", sheenStrength: 0.28,
      bgCentre: "#28333d", bgEdge: "#0a0e13", bgFalloff: 0.85,
      // Visibly bumpier and more irregular than the other looks.
      mottleAmp: 0.034, mottleFreq: 2.9, aoStrength: 1.0, aoGamma: 2.0,
      roughness: 0.4,
    },
    lighting: DARK_LIGHT,
    camera: { fov: 34, fill: 0.86 },
    dof: { focusDistance: 0, focusRange: 6.0, bokehScale: 13.5, resolutionScale: 0.25 },
    grain: 0.022,
    heroCells: 26, heroResolution: 128, blend: 0.13, overlap: 0.14, density: 0.82,
    extent: [1.0, 1.0, 0.95],
    backdropCount: 5, backdropDepth: [-26, 7],
    drift: 0.14, specks: 70, membrane: 0.25, fibres: 9,
    stills: [30, 150, 260],
  },
  {
    id: "DarkFibre-Teal",
    file: "DarkFibre_Teal",
    kind: "fibre",
    seed: "fibre-teal-88",
    loops: true,
    palette: {
      cell: "#f2cd5c", deep: "#7a5510", rim: "#ffc85a", rimStrength: 0.4,
      sheen: "#ffeaa8", sheenStrength: 0.26,
      bgCentre: "#122a2c", bgEdge: "#04090a", bgFalloff: 0.8,
      mottleAmp: 0.036, mottleFreq: 2.8, aoStrength: 1.0, aoGamma: 2.0,
      roughness: 0.42,
    },
    lighting: { ...DARK_LIGHT, rimLightColor: "#ffe08a", rimLightIntensity: 0.85,
      fillColor: "#6ea0a4", ambientColor: "#1d3436" },
    camera: { fov: 34, fill: 0.86 },
    dof: { focusDistance: 0, focusRange: 6.0, bokehScale: 13.5, resolutionScale: 0.25 },
    grain: 0.022,
    heroCells: 26, heroResolution: 128, blend: 0.13, overlap: 0.14, density: 0.82,
    extent: [1.0, 1.0, 0.95],
    backdropCount: 5, backdropDepth: [-26, 7],
    drift: 0.14, specks: 70, membrane: 0.25, fibres: 10,
    stills: [30, 150, 260],
  },
];

export const lookById = (id: string): LookRow => {
  const row = LOOKS.find((l) => l.id === id);
  if (!row) throw new Error(`Unknown look: ${id}`);
  return row;
};
