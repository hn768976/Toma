/**
 * The single source of truth for both versions of the piece.
 *
 * Every hex literal in the project lives in this file. Every component reads
 * its palette, counts, sizes, blur and drift from here, so the two versions
 * differ only by data.
 */

export type VariantName = "red" | "blue";

export type Palette = {
  /** The near-flat field the cells sit on. */
  background: string;
  /** Anchored in one corner as a very subtle gradient over the background. */
  backgroundTint: string;
  /**
   * Cell tones ordered from the most prominent against the background to the
   * faintest. In "red" that runs dark -> pale on near-white; in "blue" it runs
   * bright -> deep on near-black. Cell opacity is correlated with this order,
   * so the faintest tone is also the most transparent in both versions.
   */
  cellTones: [string, string, string];
  /** A slightly different tone carried by a minority of cells. */
  cellEdge: string;
};

export type DriftSettings = {
  /**
   * Unit vector of the dominant travel direction. Every cell starts frame 0
   * moving along it; the return leg of each closed path is staggered by phase
   * so the field never reverses all at once.
   */
  direction: [number, number];
  /** Travel amplitude along `direction`, in 4K px, before the depth multiplier. */
  mainAmplitude: [number, number];
  /** Travel amplitude on the perpendicular axis, in 4K px. */
  crossAmplitude: [number, number];
  /** Integer cycles per 450-frame loop on the perpendicular axis. */
  crossFrequencies: number[];
  /** Depth multiplier on drift amplitude: [far, mid, near]. Near moves fastest. */
  depthSpeed: [number, number, number];
  /** Ambient camera drift, [x, y] in 4K px. Traversed on a closed ellipse. */
  camera: [number, number];
};

export type Variant = {
  palette: Palette;
  /** Number of cells generated for the field. */
  cellCount: number;
  /** Cell diameter range in 4K px. Sampled with a bias toward the small end. */
  sizeRange: [number, number];
  /** Blur applied to the nearest (blurriest) depth bucket, in 4K px. */
  blurCeiling: number;
  /** Blur multipliers per depth bucket: [far, mid, near]. */
  depthBlur: [number, number, number];
  /** Share of cells landing in each depth bucket: [far, mid, near]. */
  depthShare: [number, number, number];
  /** Per-cell opacity range. */
  opacityRange: [number, number];
  /** Points per blob. */
  pointRange: [number, number];
  /** Per-point radius deviation from the mean, as a fraction. */
  radiusJitter: number;
  /**
   * How the outline curves. Point radii vary along two integer harmonics of
   * the angle rather than independently, so the curve stays smooth all the way
   * round; these settings decide how gentle that curve is.
   */
  shape: {
    /** Harmonics available to the broad lobe and to the finer one. */
    harmonics: [number[], number[]];
    /** Their relative weights. More on the first = broader, calmer curves. */
    harmonicWeights: [number, number];
    /** Share of the radius variation that is independent per point. Adds kinks. */
    pointNoise: number;
    /** Angular jitter as a fraction of a point's slice. Uneven spacing bends
     *  the curve unevenly, which reads as lumpy rather than curved. */
    angleJitter: number;
    /** Bias on the point count. Below 0.5 favours the top of pointRange. */
    countBias: number;
  };
  /** Morph depth: how far each point's radius breathes, as a fraction. */
  morphAmplitude: [number, number];
  /** Integer morph frequencies (cycles per loop) available to a point. */
  morphFrequencies: number[];
  /** Fraction of cells that rotate one whole turn over the loop. */
  rotatingShare: number;
  drift: DriftSettings;
  /**
   * Blur spreads a cell's energy, so a heavily blurred fill reads washed out.
   * Saturation is boosted and lightness pushed away from the background in
   * proportion to how blurred the cell's bucket is, so colour survives it.
   */
  saturationBoost: number;
  lightnessShift: number;
  /**
   * Cells lighter than the background have to pool brighter where they
   * overlap, so they composite additively and get a bloom pass.
   */
  additive: boolean;
  /**
   * Exposure of the composited cell layer. Additive compositing clips to white
   * wherever three or four cells stack, which throws the colour away; pulling
   * the layer down leaves headroom so pools read as brighter blue rather than
   * as blown highlights.
   */
  exposure: number;
  bloom: { radius: number; strength: number } | null;
  /** 0 disables the vignette pass entirely. */
  vignette: number;
  grainAlpha: number;
  /** Where the background tint is anchored, in fractions of the frame. */
  tintAnchor: [number, number];
  /**
   * Cells are seeded around a few loose anchors rather than spread evenly.
   * Even placement gives a polka-dot field; clustering is what leaves large
   * stretches of bare background and lets neighbours pool into bigger masses.
   */
  clustering: {
    anchors: number;
    /** Scatter around an anchor, in 4K px. */
    spread: number;
    /** Share of cells placed anywhere in the frame instead. */
    strayShare: number;
  };
};

export const LOOP_FRAMES = 450;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const VARIANTS: Record<VariantName, Variant> = {
  /**
   * v1 — dark cells on near-white. A handful of big soft masses on an almost
   * empty field; roughly 60% of the frame stays background.
   */
  red: {
    palette: {
      background: "#FBF8F8", // near-white, faintly warm
      backgroundTint: "#F2E8E8", // the subtle gradient
      cellTones: [
        "#5A0808", // cell deep  — the darkest cells
        "#8A1414", // cell mid   — mid tone
        "#C46A6A", // cell pale  — the lightest, most transparent
      ],
      cellEdge: "#A03030", // a slightly different tone on some cells
    },
    cellCount: 30,
    sizeRange: [180, 620],
    blurCeiling: 90,
    // Even the least blurred bucket is half the ceiling — nothing in frame is
    // allowed a readable edge.
    depthBlur: [0.6, 0.8, 1],
    depthShare: [0.36, 0.36, 0.28],
    opacityRange: [0.45, 1],
    pointRange: [5, 8],
    radiusJitter: 0.25,
    // v1's cells are large and few, so their outlines carry the piece. The
    // broad lobe is the first harmonic — one maximum and one minimum, which
    // leans the blob into an egg. The second harmonic is avoided here: its
    // four extrema sit 90 degrees apart and line up with the elongation axes,
    // which builds a rounded rectangle. A weak third harmonic adds asymmetry
    // without flattening anything. With almost no per-point noise and
    // near-even point spacing, the result is a smooth curved cell.
    shape: {
      harmonics: [[1], [3]],
      harmonicWeights: [0.84, 0.16],
      pointNoise: 0.03,
      angleJitter: 0.14,
      countBias: 0.3,
    },
    morphAmplitude: [0.05, 0.13],
    morphFrequencies: [1, 2, 3],
    rotatingShare: 0.25,
    drift: {
      direction: [-1, 0], // mostly leftward
      mainAmplitude: [190, 520],
      crossAmplitude: [40, 150], // with vertical variation
      crossFrequencies: [1, 2],
      depthSpeed: [0.45, 0.72, 1],
      camera: [10, 8],
    },
    saturationBoost: 0.16,
    lightnessShift: -0.09, // darker, because blurring lifts dark cells on white
    additive: false,
    exposure: 1,
    bloom: null,
    vignette: 0,
    grainAlpha: 0.03,
    tintAnchor: [0.86, 0.9],
    clustering: { anchors: 5, spread: 330, strayShare: 0.18 },
  },

  /**
   * v2 — the inversion. Many more, much smaller cells, bright on near-black,
   * compositing additively and glowing. Density is what separates the two
   * versions more than the palette does.
   */
  blue: {
    palette: {
      background: "#030812", // near-black blue
      backgroundTint: "#0A1830",
      cellTones: [
        "#5FC4F5", // cell bright — the brightest cells
        "#2E7FC4", // cell mid
        "#14456B", // cell deep   — the darkest, most transparent
      ],
      cellEdge: "#7FE8F5",
    },
    cellCount: 70,
    sizeRange: [90, 380],
    blurCeiling: 70,
    depthBlur: [0.5, 0.74, 1],
    depthShare: [0.36, 0.36, 0.28],
    opacityRange: [0.45, 1],
    pointRange: [5, 8],
    radiusJitter: 0.25,
    // v2's cells are small and many, and a busier outline survives being
    // shrunk to a bright speck.
    shape: {
      harmonics: [[1, 2], [2, 3]],
      harmonicWeights: [0.62, 0.38],
      pointNoise: 0.15,
      angleJitter: 0.55,
      countBias: 0.5,
    },
    morphAmplitude: [0.05, 0.13],
    morphFrequencies: [1, 2, 3],
    rotatingShare: 0.25,
    drift: {
      direction: [0, -1], // mostly upward
      mainAmplitude: [265, 730], // ~40% further in the same 450 frames
      crossAmplitude: [56, 210], // with horizontal variation
      crossFrequencies: [1, 2],
      depthSpeed: [0.45, 0.72, 1],
      camera: [8, 10],
    },
    saturationBoost: 0.2,
    lightnessShift: 0.03, // brighter, because these read as emissive on dark
    additive: true,
    exposure: 0.7,
    bloom: { radius: 150, strength: 0.38 },
    vignette: 0.2,
    grainAlpha: 0.03,
    tintAnchor: [0.2, 0.14],
    clustering: { anchors: 9, spread: 420, strayShare: 0.32 },
  },
};
