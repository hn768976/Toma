/**
 * Palette and layout constants for the Security Breach Alert clip.
 *
 * Everything the two outcomes share lives here; the per-outcome accent
 * colours are resolved by `accentFor()` so the components stay
 * outcome-agnostic and only read a single object.
 */

export type Outcome = "breach" | "granted";

export const COLORS = {
  /** Deep teal-blue field the whole frame sits on. */
  bg: "#0a3038",
  bgDeep: "#062028",
  /** Panel fills and borders over the field. */
  panel: "#1a5560",
  panelFill: "rgba(30, 104, 118, 0.72)",
  panelFillDark: "rgba(16, 70, 84, 0.46)",
  /** Body copy inside the background panels. */
  text: "#7ad4dc",
  /** The brighter data readouts that carry a little bloom. */
  dataBright: "#c8f4f8",

  dialogBorder: "#2ae0f0",
  dialogTitleBar: "#0d4450",
  dialogBody: "#0b2b34",
  field: "#5a2030",
  fieldActive: "#8d2138",
  fieldText: "#ffffff",

  alertRed: "#e01020",
  successGreen: "#22c55e",
  white: "#ffffff",
} as const;

export type Accent = {
  /** Primary accent for the alert graphic and background pickup. */
  color: string;
  /** A darker seat for the graphic to sit on. */
  colorDeep: string;
  /** The heavy caps under the graphic. */
  label: string;
  /** How hard the background reacts: breach is loud, granted is calm. */
  intensity: number;
  /** Number of alarm washes across the frame. */
  washes: number;
};

export const accentFor = (outcome: Outcome): Accent =>
  outcome === "breach"
    ? {
        color: COLORS.alertRed,
        colorDeep: "#5c0710",
        label: "SECURITY BREACH",
        intensity: 1,
        washes: 2,
      }
    : {
        color: COLORS.successGreen,
        colorDeep: "#0b3f22",
        label: "ACCESS GRANTED",
        intensity: 0.42,
        washes: 1,
      };

/** Composition geometry. Every size in the clip is derived from these. */
export const VIDEO = {
  width: 3840,
  height: 2160,
  fps: 30,
  durationInFrames: 450,
} as const;

/** Beat sheet — every timing in the clip is read from here. */
export const BEATS = {
  dialogIn: { from: 6, to: 30 },
  username: { from: 30, to: 120 },
  password: { from: 110, to: 210 },
  /** The hard cut. Two frames of blow-out, two of empty, then the alert. */
  flash: 210,
  cleared: 212,
  alert: 214,
  backgroundPickup: 250,
  hold: 330,
} as const;

export const USERNAME = "ADMINISTRATOR";
export const PASSWORD_LENGTH = 11;
