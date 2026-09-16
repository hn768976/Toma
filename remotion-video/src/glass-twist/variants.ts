// The two deliverables are the same geometry and the same motion; they
// differ only in colour and in handedness.
//
// - "emerald" reproduces the reference: axis running lower-left to
//   upper-right, right-handed twist, green glass.
// - "azure" is its mirror image: the whole stack is reflected about the
//   vertical axis, which flips the on-screen direction of the axis AND
//   reverses the twist handedness, and the glass is electric azure.

export type VariantName = "emerald" | "azure";

export type Variant = {
  name: VariantName;
  /** Body tint of the glass. */
  glassColor: string;
  /** Tint of the environment streaks that create the specular highlights. */
  highlightColor: string;
  /** Warm/cool fill bouncing into the shadow side. */
  fillColor: string;
  /** Colour of the soft atmospheric glow behind the shape. */
  glowColor: string;
  /** Colour light bleeding through the glass body. */
  innerGlowColor: string;
  /** -1 mirrors the whole scene about the vertical axis. */
  mirror: 1 | -1;
};

export const VARIANTS: Record<VariantName, Variant> = {
  emerald: {
    name: "emerald",
    glassColor: "#116b5d",
    highlightColor: "#d9fff2",
    fillColor: "#0a4d5e",
    glowColor: "#0b6b52",
    innerGlowColor: "#3ff0bd",
    mirror: 1,
  },
  azure: {
    name: "azure",
    glassColor: "#184a97",
    highlightColor: "#dcebff",
    fillColor: "#123a86",
    glowColor: "#0b2a5c",
    innerGlowColor: "#2e8bff",
    mirror: -1,
  },
};
