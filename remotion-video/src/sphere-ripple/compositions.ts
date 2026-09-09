import type { CompositionSpec } from "./types";

/**
 * The twelve setups. Everything that varies between stills lives here — the
 * renderer only ever walks this structure, so a thirteenth composition is a
 * data edit, not a code change.
 *
 * Sphere position and ring spacing are the strongest differentiators; if two
 * of these ever start to look alike, move the sphere and change the spacing
 * before touching anything else.
 */
export const COMPOSITIONS: Record<string, CompositionSpec> = {
  // Large sphere sunk below the bottom-right; only its upper cap shows.
  // Tight spacing, many fine rings. The reference composition.
  r01: {
    id: "r01",
    spheres: [
      {
        centre: { x: 0.66, y: 1.34 },
        radius: 0.62,
        origin: { tilt: 55, azimuth: 62 },
        ringSpacing: 3.0,
        ringCount: 46,
        firstRing: 1.6,
        light: { tilt: 62, azimuth: 78 },
        intensity: 1,
        coreWidth: 3.1,
        glowWidth: 11,
      },
    ],
    focus: { x: 0.64, y: 0.56, angle: -12, halfWidth: 0.1, falloff: 0.42, maxBlur: 52 },
    background: { x: 0.68, y: 0.86, spread: 0.72, strength: 0.85, mottle: 0.5 },
    grain: 0.5,
  },

  // Very large sphere off the left edge — only the right limb crosses the
  // frame, as a curved band. Wide spacing, bold rings, right side empty.
  r02: {
    id: "r02",
    spheres: [
      {
        centre: { x: -0.3, y: 0.42 },
        radius: 0.66,
        origin: { tilt: 76, azimuth: 18 },
        ringSpacing: 6.5,
        ringCount: 24,
        firstRing: 3.5,
        light: { tilt: 70, azimuth: 30 },
        intensity: 1.05,
        coreWidth: 5.2,
        glowWidth: 19,
      },
    ],
    focus: { x: 0.17, y: 0.55, angle: 78, halfWidth: 0.09, falloff: 0.45, maxBlur: 52 },
    background: { x: 0.14, y: 0.42, spread: 0.62, strength: 0.8, mottle: 0.45 },
    grain: 0.5,
  },

  // Small complete sphere floating centre-frame, origin at its centre so the
  // rings are near-concentric. Everything outside the sphere goes soft.
  r03: {
    id: "r03",
    spheres: [
      {
        centre: { x: 0.5, y: 0.5 },
        radius: 0.22,
        origin: { tilt: 0, azimuth: 0 },
        ringSpacing: 5.0,
        ringCount: 20,
        firstRing: 3.0,
        light: { tilt: 66, azimuth: 118 },
        intensity: 1.1,
        coreWidth: 3.0,
        glowWidth: 11,
      },
    ],
    focus: { x: 0.5, y: 0.5, angle: 0, halfWidth: 0.16, falloff: 0.46, maxBlur: 52 },
    background: { x: 0.5, y: 0.5, spread: 0.5, strength: 0.7, mottle: 0.4 },
    grain: 0.55,
  },

  // Large sphere mostly above the frame, lower cap visible; origin at the
  // cap's lower-left so the rings sweep up and to the right.
  r04: {
    id: "r04",
    spheres: [
      {
        centre: { x: 0.72, y: -0.22 },
        radius: 0.58,
        origin: { tilt: 68, azimuth: 222 },
        ringSpacing: 3.4,
        ringCount: 42,
        firstRing: 1.8,
        light: { tilt: 64, azimuth: 200 },
        intensity: 1,
        coreWidth: 3.2,
        glowWidth: 12,
      },
    ],
    focus: { x: 0.56, y: 0.4, angle: 20, halfWidth: 0.1, falloff: 0.45, maxBlur: 52 },
    background: { x: 0.74, y: 0.14, spread: 0.7, strength: 0.82, mottle: 0.5 },
    grain: 0.5,
  },

  // Close to the surface: the sphere is far larger than the frame, curvature
  // is gentle and the rings arrive as broad arcs from an off-frame origin.
  r05: {
    id: "r05",
    spheres: [
      {
        centre: { x: 0.3, y: 0.52 },
        radius: 1.35,
        origin: { tilt: 42, azimuth: 8 },
        ringSpacing: 6.0,
        ringCount: 20,
        firstRing: 3.0,
        light: { tilt: 72, azimuth: 24 },
        intensity: 1.15,
        coreWidth: 5.6,
        glowWidth: 21,
      },
    ],
    focus: { x: 0.45, y: 0.62, angle: -8, halfWidth: 0.12, falloff: 0.5, maxBlur: 52 },
    background: { x: 0.78, y: 0.3, spread: 0.85, strength: 0.75, mottle: 0.55 },
    grain: 0.5,
  },

  // Medium sphere lower-left with the origin right out on the limb, so the
  // rings arrive as a compressed fan rather than as circles.
  r06: {
    id: "r06",
    spheres: [
      {
        centre: { x: 0.26, y: 0.86 },
        radius: 0.4,
        origin: { tilt: 88, azimuth: 35 },
        ringSpacing: 4.2,
        ringCount: 40,
        firstRing: 2.0,
        light: { tilt: 60, azimuth: 52 },
        intensity: 1.3,
        coreWidth: 3.2,
        glowWidth: 12,
      },
    ],
    focus: { x: 0.3, y: 0.72, angle: 35, halfWidth: 0.12, falloff: 0.45, maxBlur: 52 },
    background: { x: 0.28, y: 0.8, spread: 0.6, strength: 0.8, mottle: 0.45 },
    grain: 0.55,
  },

  // Small sphere upper-left, but the sharp band falls on empty background at
  // the lower-right — so the subject itself is soft. Quiet and unusual.
  r07: {
    id: "r07",
    spheres: [
      {
        centre: { x: 0.24, y: 0.24 },
        radius: 0.19,
        origin: { tilt: 30, azimuth: 130 },
        ringSpacing: 6.0,
        ringCount: 20,
        firstRing: 3.0,
        light: { tilt: 64, azimuth: 150 },
        intensity: 1.45,
        coreWidth: 2.8,
        glowWidth: 10,
      },
    ],
    focus: { x: 0.72, y: 0.74, angle: -20, halfWidth: 0.11, falloff: 0.7, maxBlur: 26 },
    background: { x: 0.26, y: 0.26, spread: 0.55, strength: 0.72, mottle: 0.4 },
    grain: 0.6,
  },

  // Large sphere centred on the bottom edge, symmetric about the vertical
  // axis. The tightest spacing and highest ring count of the twelve.
  r08: {
    id: "r08",
    spheres: [
      {
        centre: { x: 0.5, y: 1.3 },
        radius: 0.68,
        origin: { tilt: 50, azimuth: 90 },
        ringSpacing: 2.1,
        ringCount: 68,
        firstRing: 1.2,
        light: { tilt: 66, azimuth: 118 },
        intensity: 0.95,
        coreWidth: 2.5,
        glowWidth: 9,
      },
    ],
    focus: { x: 0.5, y: 0.6, angle: 0, halfWidth: 0.11, falloff: 0.42, maxBlur: 52 },
    background: { x: 0.5, y: 0.9, spread: 0.72, strength: 0.85, mottle: 0.5 },
    grain: 0.45,
  },

  // Medium sphere right of centre with the origin thrown out onto the limb,
  // so the innermost rings truncate almost at once and read as steep curves.
  r09: {
    id: "r09",
    spheres: [
      {
        centre: { x: 0.7, y: 0.44 },
        radius: 0.26,
        origin: { tilt: 84, azimuth: 200 },
        ringSpacing: 6.5,
        ringCount: 26,
        firstRing: 3.2,
        light: { tilt: 68, azimuth: 226 },
        intensity: 1.25,
        coreWidth: 4.2,
        glowWidth: 15,
      },
    ],
    focus: { x: 0.66, y: 0.52, angle: 60, halfWidth: 0.09, falloff: 0.38, maxBlur: 52 },
    background: { x: 0.68, y: 0.44, spread: 0.58, strength: 0.75, mottle: 0.45 },
    grain: 0.55,
  },

  // Enormous sphere off the bottom-right corner: only a diagonal sliver of
  // limb crosses the frame. Wide spacing, few rings, mostly background.
  r10: {
    id: "r10",
    spheres: [
      {
        centre: { x: 1.45, y: 1.75 },
        radius: 0.95,
        origin: { tilt: 85, azimuth: 150 },
        ringSpacing: 6.5,
        ringCount: 20,
        firstRing: 3.5,
        light: { tilt: 66, azimuth: 132 },
        intensity: 1.3,
        coreWidth: 5.0,
        glowWidth: 18,
      },
    ],
    focus: { x: 0.72, y: 0.78, angle: -45, halfWidth: 0.1, falloff: 0.5, maxBlur: 52 },
    background: { x: 0.86, y: 0.9, spread: 0.6, strength: 0.7, mottle: 0.4 },
    grain: 0.6,
  },

  // Centred sphere lit from below: brightest along the bottom, falling to
  // near-black at the top. Inverts the lighting of every other composition.
  r11: {
    id: "r11",
    spheres: [
      {
        centre: { x: 0.46, y: 0.46 },
        radius: 0.36,
        origin: { tilt: 25, azimuth: 285 },
        ringSpacing: 4.0,
        ringCount: 30,
        firstRing: 2.0,
        light: { tilt: 70, azimuth: 270 },
        intensity: 1.05,
        coreWidth: 3.4,
        glowWidth: 13,
      },
    ],
    focus: { x: 0.5, y: 0.5, angle: 90, halfWidth: 0.14, falloff: 0.5, maxBlur: 52 },
    background: { x: 0.46, y: 0.7, spread: 0.62, strength: 0.78, mottle: 0.45 },
    grain: 0.55,
  },

  // Two ripple sources. The second sphere is deliberately smaller, tighter
  // and much dimmer so it reads as a counterpoint, not as a mistake.
  r12: {
    id: "r12",
    spheres: [
      {
        centre: { x: 0.18, y: 0.1 },
        radius: 0.52,
        origin: { tilt: 45, azimuth: 300 },
        ringSpacing: 3.6,
        ringCount: 40,
        firstRing: 1.8,
        light: { tilt: 64, azimuth: 310 },
        intensity: 1,
        coreWidth: 3.2,
        glowWidth: 12,
      },
      {
        centre: { x: 0.86, y: 0.92 },
        radius: 0.24,
        origin: { tilt: 35, azimuth: 140 },
        ringSpacing: 5.5,
        ringCount: 20,
        firstRing: 2.6,
        light: { tilt: 62, azimuth: 150 },
        intensity: 0.7,
        coreWidth: 2.6,
        glowWidth: 9,
      },
    ],
    focus: { x: 0.46, y: 0.44, angle: 34, halfWidth: 0.1, falloff: 0.44, maxBlur: 52 },
    background: { x: 0.24, y: 0.22, spread: 0.7, strength: 0.8, mottle: 0.5 },
    grain: 0.5,
  },
};

export const COMPOSITION_IDS = Object.keys(COMPOSITIONS);

export const resolveComposition = (id: string): CompositionSpec => {
  const spec = COMPOSITIONS[id];
  if (!spec) {
    throw new Error(
      `Unknown composition "${id}". Known ids: ${COMPOSITION_IDS.join(", ")}`,
    );
  }
  return spec;
};
