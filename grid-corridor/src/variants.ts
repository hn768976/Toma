/**
 * The single source of truth for everything that differs between the three
 * versions of the piece. Nothing outside this file may contain a colour
 * literal, a diagram-set name, a structure mode or a roll direction.
 */

export type VariantName = "teal" | "amber" | "green";

/** "corridor" = tilted grid planes. "wall" = one flat scrolling text surface. */
export type StructureMode = "corridor" | "wall";

/** "roll" = the composite rotates on a sine. "static" = the camera holds. */
export type CameraMode = "roll" | "static";

/** What the type layer is made of. */
export type TextLayerMode = "blocks" | "equations" | "wall";

/** Which vocabulary the small technical drawings are pulled from. */
export type DiagramSet = "molecules" | "circuits";

export type Palette = {
  /** Deepest background tone. */
  bgDeep: string;
  /** The lighter wash the background gradient reaches toward. */
  bgWash: string;
  /** Brightest structural colour: grid lines, or the text wall body. */
  structureMain: string;
  /** The same structure, far away. */
  structureDim: string;
  /** Body colour of code / equation / wall type. */
  textMain: string;
  /** Highlight colour for the occasional bright line. */
  textPale: string;
  /** Stroke colour of the technical diagrams. */
  diagram: string;
  /** The white-hot node dots. */
  nodeWhite: string;
  /** The tinted node dots. */
  nodeAccent: string;
  /** Very sparse contrast colour — a few tiny marks only. */
  accent: string;
};

export type Bucket = {
  key: string;
  /** Blur applied once to the whole buffer, in 4K pixels. */
  blur: number;
  /** Backing-store scale of the buffer. Heavily blurred buffers are half size. */
  res: number;
  /** Composited with "lighter" instead of "source-over". */
  additive?: boolean;
};

export type PlaneSpec = {
  key: string;
  /** Rotation of the plane's local axes, radians. */
  rot: number;
  /** Horizontal shear of the plane's local axes. */
  shear: number;
  /** Relative brightness of this plane's grid, so surfaces separate. */
  tone: number;
};

export type VariantConfig = {
  palette: Palette;
  structure: StructureMode;
  diagrams: DiagramSet;
  textLayer: TextLayerMode;
  camera: {
    mode: CameraMode;
    /** Signed. +1 rolls clockwise and drifts up-left, -1 mirrors both. */
    rollDirection: number;
    /** Amplitude of the roll in degrees. */
    rollDegrees: number;
    /** Amplitude of the ambient wander in pixels (used when mode is static). */
    wanderPx: number;
  };
  /** Negates every plane rotation and shear, mirroring the corridor. */
  planeMirror: number;
  /** Base plane angles, before planeMirror is applied. */
  planes: PlaneSpec[];
  /** Depth-of-field buffers, composited in array order. */
  buckets: Bucket[];
  /** Extra buffer that collects the bright elements for the bloom pass. */
  glow: Bucket;
  /** Roughly how many diagram glyphs are visible at once. */
  diagramCount: number;
  /** Multiplier on the drawn size of every diagram glyph. */
  diagramScale: number;
  /**
   * Population per plane on its wrap-around tile, before the tiling
   * replication that fills the plane. In "wall" mode the single front plane
   * is one tile wide, so these are the visible counts directly.
   */
  perPlane: {
    dots: number;
    glyphs: number;
    codeBlocks: number;
    equations: number;
  };
};

/** Plane angles for the corridor. v2 receives these with planeMirror -1. */
const CORRIDOR_PLANES: PlaneSpec[] = [
  { key: "ceiling", rot: -0.15, shear: 0.5, tone: 0.8 },
  { key: "right", rot: 0.4, shear: -0.64, tone: 1.0 },
  { key: "floor", rot: 0.13, shear: -0.46, tone: 1.08 },
  { key: "left", rot: -0.37, shear: 0.62, tone: 0.86 },
];

/** Three-way depth-of-field: far and near blur hard, the middle band is sharp. */
const CORRIDOR_BUCKETS: Bucket[] = [
  { key: "far", blur: 22, res: 0.5 },
  { key: "mid", blur: 2, res: 1 },
  { key: "near", blur: 26, res: 0.5 },
];

/** Two-way depth-of-field: the wall is flat and sharp, everything else floats. */
const WALL_BUCKETS: Bucket[] = [
  { key: "flat", blur: 0, res: 1 },
  { key: "near", blur: 20, res: 0.5 },
];

const GLOW_BUCKET: Bucket = { key: "glow", blur: 26, res: 0.5, additive: true };

export const VARIANTS: Record<VariantName, VariantConfig> = {
  teal: {
    palette: {
      bgDeep: "#05142E",
      bgWash: "#0C2A52",
      structureMain: "#2EC4C4",
      structureDim: "#14666B",
      textMain: "#3FD4D4",
      textPale: "#A8ECEC",
      diagram: "#E8F4F8",
      nodeWhite: "#FFFFFF",
      nodeAccent: "#5FE8E8",
      accent: "#E8455F",
    },
    structure: "corridor",
    diagrams: "molecules",
    textLayer: "blocks",
    camera: {
      mode: "roll",
      rollDirection: 1,
      rollDegrees: 4,
      wanderPx: 0,
    },
    planeMirror: 1,
    planes: CORRIDOR_PLANES,
    buckets: CORRIDOR_BUCKETS,
    glow: GLOW_BUCKET,
    diagramCount: 22,
    diagramScale: 1,
    perPlane: { dots: 78, glyphs: 14, codeBlocks: 17, equations: 0 },
  },
  amber: {
    palette: {
      bgDeep: "#1A0F02",
      bgWash: "#3D2408",
      structureMain: "#E8942E",
      structureDim: "#7A4A14",
      textMain: "#F5B84F",
      textPale: "#FFE8C0",
      diagram: "#FFF4E0",
      nodeWhite: "#FFFFFF",
      nodeAccent: "#FFC44F",
      accent: "#3FC4E8",
    },
    structure: "corridor",
    diagrams: "circuits",
    textLayer: "equations",
    camera: {
      mode: "roll",
      rollDirection: -1,
      rollDegrees: 4,
      wanderPx: 0,
    },
    planeMirror: -1,
    planes: CORRIDOR_PLANES,
    buckets: CORRIDOR_BUCKETS,
    glow: GLOW_BUCKET,
    diagramCount: 22,
    diagramScale: 1,
    perPlane: { dots: 78, glyphs: 14, codeBlocks: 8, equations: 9 },
  },
  green: {
    palette: {
      bgDeep: "#010A04",
      bgWash: "#04200E",
      structureMain: "#2EB84F",
      structureDim: "#0F4A1E",
      textMain: "#2EB84F",
      textPale: "#6FFF8F",
      diagram: "#C4FFD4",
      nodeWhite: "#F0FFF4",
      nodeAccent: "#4FE87A",
      accent: "#E85FC4",
    },
    structure: "wall",
    diagrams: "molecules",
    textLayer: "wall",
    camera: {
      mode: "static",
      rollDirection: 0,
      rollDegrees: 0,
      wanderPx: 8,
    },
    planeMirror: 1,
    planes: [],
    buckets: WALL_BUCKETS,
    glow: GLOW_BUCKET,
    diagramCount: 10,
    diagramScale: 2,
    perPlane: { dots: 120, glyphs: 10, codeBlocks: 0, equations: 0 },
  },
};
