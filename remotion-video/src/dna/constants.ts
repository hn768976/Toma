/**
 * Global settings for the 13 DNA / molecule motion plates.
 *
 * Every version is registered twice: at 1920x1080 (the delivered master) and
 * at 3840x2160 (the 4K composition that ships in the project). The scenes are
 * resolution-independent — `resolutionScale` only scales pixel-denominated
 * effects such as point sprite size and CSS blur radii.
 */

export const FPS = 30;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

export type VersionSpec = {
  /** Composition id suffix, e.g. "V01Frosted" -> "V01Frosted" / "V01Frosted4K". */
  id: string;
  title: string;
  /** Reference clip this version tracks. */
  reference: string;
  /** Reference duration in seconds, before conversion to 30fps frames. */
  referenceSeconds: number;
  durationInFrames: number;
  models: ("dna" | "molecule")[];
  note: string;
};

/**
 * Reference durations are preserved to the frame at 30fps. Several references
 * are 25 or 29.97fps sources, so the frame count is the nearest whole frame to
 * the original wall-clock length.
 */
export const VERSIONS: VersionSpec[] = [
  {
    id: "V01FrostedMolecules",
    title: "Frosted Molecules",
    reference: "istockphoto-2200844203",
    referenceSeconds: 14.016,
    durationInFrames: 420,
    models: ["dna", "molecule"],
    note: "Near-black navy, frosted glass molecules in front of a faint helix, heavy depth of field.",
  },
  {
    id: "V02NavySparkle",
    title: "Navy Sparkle",
    reference: "istockphoto-2245145050",
    referenceSeconds: 10.01,
    durationInFrames: 300,
    models: ["dna"],
    note: "Vertical helix right of centre, deep navy, blue glow falling off downward, sparkle points.",
  },
  {
    id: "V03VioletCascade",
    title: "Violet Cascade",
    reference: "istockphoto-2257339429",
    referenceSeconds: 8.406,
    durationInFrames: 252,
    models: ["dna"],
    note: "Layered diagonal helices, magenta/violet iridescent sheen over a blue field.",
  },
  {
    id: "V04ParticleStrand",
    title: "Particle Strand",
    reference: "istockphoto-1418962855",
    referenceSeconds: 20,
    durationInFrames: 600,
    models: ["dna"],
    note: "Diagonal helix drawn entirely as glowing blue dots sampled from the mesh surface.",
  },
  {
    id: "V05GenomeHud",
    title: "Genome HUD",
    reference: "istockphoto-2228757112",
    referenceSeconds: 15,
    durationInFrames: 450,
    models: ["dna"],
    note: "Horizontal cyan hologram helix under a sci-fi analysis interface.",
  },
  {
    id: "V06ClinicalLight",
    title: "Clinical Light",
    reference: "istockphoto-1439818670",
    referenceSeconds: 10.034,
    durationInFrames: 301,
    models: ["dna", "molecule"],
    note: "Pale studio background, blue glass helix with red base-pair accents, molecules behind.",
  },
  {
    id: "V07DualDust",
    title: "Dual Dust",
    reference: "istockphoto-1372447337",
    referenceSeconds: 11.078,
    durationInFrames: 332,
    models: ["dna"],
    note: "Two vertical particle helices — amber in front, blue behind — in a starfield.",
  },
  {
    id: "V08NeonWire",
    title: "Neon Wire",
    reference: "istockphoto-2166967985",
    referenceSeconds: 8.32,
    durationInFrames: 250,
    models: ["dna"],
    note: "Pure black, cyan and magenta wireframe edges reading as neon light streaks.",
  },
  {
    id: "V09CeramicStudio",
    title: "Ceramic Studio",
    reference: "istockphoto-2289598230",
    referenceSeconds: 12,
    durationInFrames: 360,
    models: ["dna"],
    note: "Pale blue-grey studio, matte ceramic ribbons, strong depth of field on the back layers.",
  },
  {
    id: "V10DeepFog",
    title: "Deep Fog",
    reference: "istockphoto-1406187247",
    referenceSeconds: 22,
    durationInFrames: 660,
    models: ["dna"],
    note: "Misty blue-grey gradient, horizontal helix half-lost in fog, very slow drift.",
  },
  {
    id: "V11CrimsonNetwork",
    title: "Crimson Network",
    reference: "istockphoto-2245117899",
    referenceSeconds: 18,
    durationInFrames: 540,
    models: ["dna", "molecule"],
    note: "Red-hot horizontal helix over a plexus network, data grid and molecular diagrams.",
  },
  {
    id: "V12GlassRimlight",
    title: "Glass Rimlight",
    reference: "istockphoto-467724646",
    referenceSeconds: 20,
    durationInFrames: 600,
    models: ["dna"],
    note: "Dark field, glossy translucent helix with a hard blue rim light and silhouetted back strands.",
  },
  {
    id: "V13AzureCopySpace",
    title: "Azure Copy Space",
    reference: "istockphoto-1264115405",
    referenceSeconds: 12.012,
    durationInFrames: 360,
    models: ["dna"],
    note: "Bright blue field, vertical particle helix held to the left, plexus lines, copy space right.",
  },
];

export const TOTAL_FRAMES = VERSIONS.reduce(
  (sum, v) => sum + v.durationInFrames,
  0,
);
