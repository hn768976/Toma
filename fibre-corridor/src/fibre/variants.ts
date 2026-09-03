/**
 * The single source of truth for every version of the piece.
 *
 * Every colour in the project is declared here; no hex literal appears
 * anywhere else. Every structural difference between the three versions is a
 * value on this object — the bend is a *signed* number and the horizon is a
 * *number*, so v2 is v1 with the sign flipped and v3 is v1 with the geometry
 * mode changed. Nothing downstream may assume "floor rising into wall".
 */

export type VariantName = "rising" | "descending" | "tunnel";

export type Palette = {
  /** Deepest background tone, at the frame's edges. */
  bgDeep: string;
  /** Background wash pooled around the horizon. */
  bgWash: string;
  /** Strand body — the wide soft glow pass. */
  strandBody: string;
  /** Strand mid tone. */
  strandPale: string;
  /** Brightest strand cores. */
  strandWhite: string;
  /** Packet body colour. */
  packetHue: string;
  /** Packet hot centre. */
  packetWhite: string;
  /** Floor treatment tint. Null when the variant has no floor treatment. */
  sheen: string | null;
  /** Bloom centred on the vanishing point. */
  horizonGlow: string;
  /** Out-of-focus discs near the camera. */
  bokeh: string;
};

export type Variant = {
  name: VariantName;
  palette: Palette;
  /**
   * Signed bend direction.
   *  +1 — strands run along a plane *below* the horizon (a floor) and bend
   *       *upward* into a wall behind the corridor.
   *  -1 — strands run along a plane *above* the horizon (a ceiling) and bend
   *       *downward* into a wall in front of the corridor's lower half.
   * Everything derived from this — the plane the strands run along, the arc's
   * direction, the wall's position and the floor treatment's plane — inverts
   * with the sign.
   */
  bendDir: 1 | -1;
  /** Horizon height as a fraction of frame height, measured from the top. */
  horizonY: number;
  /** How many strands the field holds. */
  strandDensity: number;
  /**
   * "bend"   — one continuous curve from a plane, through a ~90 degree arc,
   *            onto a wall.
   * "tunnel" — no bend; strands wrap a full tube receding to the horizon.
   */
  geometryMode: "bend" | "tunnel";
  /** "sheen" reflective bands, "haze" diffuse volumetric light, or "none". */
  floorTreatment: "sheen" | "haze" | "none";
  /** Lateral spread of the outermost lane at the camera, as a fraction of W. */
  laneSpread: number;
  packets: {
    /** +1 travels away from the camera, -1 travels toward it. */
    direction: 1 | -1;
    /** Packets per strand, inclusive range. */
    countRange: [number, number];
    /** Cycle lengths in frames. Each must divide LOOP so the loop closes. */
    cyclesFrames: number[];
    /** Fraction of packets that are noticeably larger and brighter. */
    hotFraction: number;
    /** Ease the parameter so packets accelerate toward the camera. */
    accelerate: boolean;
    /** Smear the nearest packets along their motion vector. */
    motionBlur: boolean;
    /** Brighten packets as they pass through the bend. */
    bendGlow: boolean;
    /** Base packet radius at the camera, at 4K, in px. */
    baseRadius: number;
  };
  /** Expanding cross-section rings, used to read a tube as enclosed. */
  ringPulses: boolean;
};

export const VARIANTS: Record<VariantName, Variant> = {
  rising: {
    name: "rising",
    palette: {
      bgDeep: "#020A1C",
      bgWash: "#0A2450",
      strandBody: "#2E7FD4",
      strandPale: "#7FC4F5",
      strandWhite: "#E8F8FF",
      packetHue: "#4FE8FF",
      packetWhite: "#FFFFFF",
      sheen: "#1E5490",
      horizonGlow: "#5FA8F5",
      bokeh: "#4F9FE8",
    },
    bendDir: 1,
    horizonY: 0.4,
    strandDensity: 95,
    geometryMode: "bend",
    floorTreatment: "sheen",
    laneSpread: 1.05,
    packets: {
      direction: 1,
      countRange: [2, 4],
      cyclesFrames: [125, 125, 375, 75],
      hotFraction: 0.12,
      accelerate: false,
      motionBlur: false,
      bendGlow: true,
      baseRadius: 9,
    },
    ringPulses: false,
  },

  descending: {
    name: "descending",
    palette: {
      bgDeep: "#140A02",
      bgWash: "#3D2008",
      strandBody: "#D4842E",
      strandPale: "#FFD48F",
      strandWhite: "#FFF8E8",
      packetHue: "#FFC44F",
      packetWhite: "#FFFFFF",
      sheen: "#8A5418",
      horizonGlow: "#FFB86A",
      bokeh: "#E89F3F",
    },
    bendDir: -1,
    horizonY: 0.62,
    strandDensity: 70,
    geometryMode: "bend",
    floorTreatment: "haze",
    laneSpread: 1.05,
    packets: {
      direction: -1,
      countRange: [2, 4],
      cyclesFrames: [125, 125, 375, 75],
      hotFraction: 0.12,
      accelerate: false,
      motionBlur: false,
      bendGlow: true,
      baseRadius: 9,
    },
    ringPulses: false,
  },

  tunnel: {
    name: "tunnel",
    palette: {
      bgDeep: "#0A0420",
      bgWash: "#2A1058",
      strandBody: "#7B4FD4",
      strandPale: "#C4A8FF",
      strandWhite: "#F4EEFF",
      packetHue: "#E85FD4",
      packetWhite: "#FFFFFF",
      sheen: null,
      horizonGlow: "#A87FFF",
      bokeh: "#8A5FE8",
    },
    // Unused by the tunnel geometry mode, but the field is not optional: the
    // tube is symmetric, so the sign carries no meaning here.
    bendDir: 1,
    horizonY: 0.5,
    strandDensity: 160,
    geometryMode: "tunnel",
    floorTreatment: "none",
    laneSpread: 1.0,
    packets: {
      direction: -1,
      countRange: [2, 4],
      cyclesFrames: [125, 125, 75, 375],
      hotFraction: 0.12,
      accelerate: true,
      motionBlur: true,
      bendGlow: false,
      baseRadius: 10,
    },
    ringPulses: true,
  },
};
