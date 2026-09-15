// Metadata for the nine "Neural Circuitry" motion-graphic versions.
//
// Every version is authored at 4K (3840x2160) and 30fps. Durations mirror the
// length of the reference clip each version was designed against; references
// shot at 25fps or 29.97fps are re-timed to 30fps at the same wall-clock
// length, so `durationInFrames` is always round(referenceSeconds * 30).

export const FPS = 30;

/** Authoring resolution. Renders are downscaled from here (see README). */
export const MASTER_WIDTH = 3840;
export const MASTER_HEIGHT = 2160;

/** Delivery resolution for the MP4s shipped alongside the project. */
export const PREVIEW_WIDTH = 1920;
export const PREVIEW_HEIGHT = 1080;

export type VersionId =
  | "V01Halo"
  | "V02Projection"
  | "V03Fibers"
  | "V04Pedestal"
  | "V05Flythrough"
  | "V06Amber"
  | "V07Hud"
  | "V08Chevron"
  | "V09Assembly";

export type VersionMeta = {
  id: VersionId;
  /** Human-readable name, used in the studio sidebar and the README. */
  title: string;
  /** Wall-clock length of the reference clip, in seconds. */
  referenceSeconds: number;
  durationInFrames: number;
  /** One-line note on what the version does, for the README. */
  note: string;
};

const framesFor = (seconds: number) => Math.round(seconds * FPS);

export const VERSIONS: VersionMeta[] = [
  {
    id: "V01Halo",
    title: "Halo Ring",
    referenceSeconds: 25,
    durationInFrames: framesFor(25),
    note: "Orbiting halo rings resolve into the circuitry over a drifting data-grid field.",
  },
  {
    id: "V02Projection",
    title: "Floor Projection",
    referenceSeconds: 25,
    durationInFrames: framesFor(25),
    note: "Hologram projected up a light cone from a glowing emitter on a reflective wire floor.",
  },
  {
    id: "V03Fibers",
    title: "Fiber Tractography",
    referenceSeconds: 20,
    durationInFrames: framesFor(20),
    note: "Filament brain with a hot core, over a circuit field streaking past in motion blur.",
  },
  {
    id: "V04Pedestal",
    title: "Pedestal Rays",
    referenceSeconds: 15,
    durationInFrames: framesFor(15),
    note: "Circuitry hovering over a perspective circuit floor, lit by falling volumetric rays.",
  },
  {
    id: "V05Flythrough",
    title: "Circuit Flythrough",
    referenceSeconds: 15,
    durationInFrames: framesFor(15),
    note: "Rush through glowing PCB traces that pulls back to reveal the circuitry.",
  },
  {
    id: "V06Amber",
    title: "Amber Core",
    referenceSeconds: 10,
    durationInFrames: framesFor(10),
    note: "The warm outlier: molten amber circuitry against teal data streams.",
  },
  {
    id: "V07Hud",
    title: "HUD Reticle",
    referenceSeconds: 25,
    durationInFrames: framesFor(25),
    note: "Targeting reticle of counter-rotating rings and readouts locked onto the circuitry.",
  },
  {
    id: "V08Chevron",
    title: "Chevron Bus",
    referenceSeconds: 20,
    durationInFrames: framesFor(20),
    note: "Symmetrical chevron bus lines pulsing outward from the core to both edges.",
  },
  {
    id: "V09Assembly",
    title: "Particle Assembly",
    referenceSeconds: 13.9667,
    durationInFrames: framesFor(13.9667),
    note: "A scattered particle ring converges and condenses into the solid circuitry.",
  },
];

export const versionById = (id: VersionId): VersionMeta => {
  const found = VERSIONS.find((v) => v.id === id);
  if (!found) {
    throw new Error(`Unknown version id: ${id}`);
  }
  return found;
};
