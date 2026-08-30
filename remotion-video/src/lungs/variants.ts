import { random } from "remotion";

/**
 * The single source of truth for everything that differs between the two
 * versions: palette, breath rhythm, particle behaviour and tree density.
 * No hex literal lives anywhere else in the piece.
 */

export type LungVariantName = "healthy" | "strained";

export type Palette = {
  background: string;
  lungFill: string;
  lungShadow: string;
  treeDark: string;
  trachea: string;
  particlePale: string;
  particleBright: string;
};

export type BreathCatch = {
  /** Which breath of the loop stutters (0-indexed). */
  breath: number;
  /** Frame within that cycle where the inhale pauses. */
  at: number;
  /** How many frames it pauses for. */
  frames: number;
};

export type Breath = {
  /** Must divide evenly into the 420-frame loop. */
  cycleFrames: number;
  scaleX: number;
  scaleY: number;
  /** Fraction of the cycle spent inhaling. */
  inhale: number;
  /** Fraction of the cycle held at the top. */
  hold: number;
  catches: BreathCatch[];
};

export type Particles = {
  count: number;
  behaviour: "circulating" | "sluggish";
  /** How strongly particles are pulled toward the branch tips (0..1). */
  tipBias: number;
  /** How strongly particles collapse toward the hilum / trachea (0..1). */
  hilumPull: number;
  /** Radius of the drift path, in 4K units. */
  driftRadius: number;
  /** Extra outward travel carried by the breath, in 4K units. */
  breathTravel: number;
  minSize: number;
  maxSize: number;
  /** Fraction of specks drawn in the brighter colour. */
  brightShare: number;
  baseOpacity: number;
};

export type Tree = {
  depth: number;
  rootLength: number;
  rootWidth: number;
  lengthFactor: number;
  widthFactor: number;
  /** Terminal branches never get thinner than this. */
  minWidth: number;
  /** Dark thickened constriction nodes at branch junctions, per lobe. */
  nodeCount: number;
  nodeMinRadius: number;
  nodeMaxRadius: number;
};

export type LungVariant = {
  name: LungVariantName;
  palette: Palette;
  breath: Breath;
  particles: Particles;
  tree: Tree;
};

/**
 * The stutters in the "strained" inhale. Seeded once at module load so their
 * positions are fixed for every render, and always fully inside the inhale so
 * the cycle still closes.
 */
const seededCatches = (cycleFrames: number, inhale: number, breaths: number[]): BreathCatch[] =>
  breaths.map((breath) => {
    const inhaleFrames = cycleFrames * inhale;
    return {
      breath,
      at: Math.round(inhaleFrames * (0.35 + random(`catch-at-${breath}`) * 0.3)),
      frames: 3 + Math.round(random(`catch-len-${breath}`)),
    };
  });

export const VARIANTS: Record<LungVariantName, LungVariant> = {
  healthy: {
    name: "healthy",
    palette: {
      background: "#000000",
      lungFill: "#B03A3A",
      lungShadow: "#8A2C2C",
      treeDark: "#3D1414",
      trachea: "#6B1F1F",
      particlePale: "#E8C4C4",
      particleBright: "#FFF0F0",
    },
    breath: {
      cycleFrames: 140,
      scaleX: 1.09,
      scaleY: 1.04,
      inhale: 0.4,
      hold: 0.1,
      catches: [],
    },
    particles: {
      count: 120,
      behaviour: "circulating",
      tipBias: 0.68,
      hilumPull: 0,
      driftRadius: 26,
      breathTravel: 34,
      minSize: 5,
      maxSize: 14,
      brightShare: 0.28,
      baseOpacity: 0.78,
    },
    tree: {
      depth: 7,
      rootLength: 192,
      rootWidth: 46,
      lengthFactor: 0.81,
      widthFactor: 0.65,
      minWidth: 4,
      nodeCount: 0,
      nodeMinRadius: 0,
      nodeMaxRadius: 0,
    },
  },
  strained: {
    name: "strained",
    palette: {
      background: "#000000",
      lungFill: "#7A3D4A",
      lungShadow: "#5C2A35",
      treeDark: "#2A1018",
      trachea: "#4A1F28",
      particlePale: "#B8A0A8",
      particleBright: "#E8D4D8",
    },
    breath: {
      cycleFrames: 60,
      scaleX: 1.035,
      scaleY: 1.015,
      inhale: 0.28,
      hold: 0.03,
      catches: seededCatches(60, 0.28, [1, 4]),
    },
    particles: {
      count: 55,
      behaviour: "sluggish",
      tipBias: 0.2,
      hilumPull: 0.5,
      driftRadius: 15,
      breathTravel: 0,
      minSize: 5,
      maxSize: 12,
      brightShare: 0.16,
      baseOpacity: 0.6,
    },
    tree: {
      depth: 5,
      rootLength: 210,
      rootWidth: 48,
      lengthFactor: 0.82,
      // Airways narrow rather than taper away: each generation loses less
      // width, and a floor keeps the finest branches stubbornly thick.
      widthFactor: 0.82,
      minWidth: 16,
      nodeCount: 4,
      nodeMinRadius: 13,
      nodeMaxRadius: 27,
    },
  },
};
