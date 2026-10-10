import type { RingCamera, RingPalette } from "./rings";

export const RING_PALETTES = {
  blue: {
    glass: "#0A1A4A",
    edge: "#4A8AFF",
    points: ["#3AE0E8", "#4A7AFF", "#5AE08A", "#FFB84A"],
    background: "#02040E",
  },
  violet: {
    glass: "#1A0A3A",
    edge: "#C84AFF",
    points: ["#FF4AD8", "#8A5AFF", "#FF8AC8", "#FFC86A"],
    background: "#06020E",
  },
} satisfies Record<string, RingPalette>;

/**
 * The four camera angles on the one shared structure (lengths in units of R).
 * Roll turns which side of the ring is nearest; shiftX/Y move the ring centre
 * off-centre in frame like the references.
 */
export const RING_CAMERAS = {
  frontTilt: {
    elevationDeg: 40,
    azimuthDeg: 0,
    distance: 2.2,
    target: [0, 0, 0],
    fovDeg: 30,
    rollDeg: 72, // near side on the left
    focusPoint: [0, 0, 0],
    aperture: 0.05,
    maxCoc: 0.03,
    pushIn: 0.08,
    driftDeg: 4,
    orbitDeg: 0,
    shiftX: 0.15,
    shiftY: 0.05,
    pointCoc: 0.6,
  },
  closeAngle: {
    elevationDeg: 32,
    azimuthDeg: 0,
    distance: 1.35,
    target: [0, 0, 0],
    fovDeg: 34,
    rollDeg: 38, // near side lower-left, rings recede to the upper right
    focusPoint: [0, 0.02, -0.15],
    aperture: 0.035,
    maxCoc: 0.025,
    pushIn: 0.06,
    driftDeg: 3,
    orbitDeg: 0,
    shiftX: 0.12,
    shiftY: -0.02,
    pointCoc: 0.25,
  },
  lowHorizon: {
    elevationDeg: 17,
    azimuthDeg: 0,
    distance: 1.3,
    target: [0, 0, 0.1],
    fovDeg: 40,
    rollDeg: 0,
    focusPoint: [0, 0, 0],
    aperture: 0.03,
    maxCoc: 0.03,
    pushIn: 0.05,
    driftDeg: 3,
    orbitDeg: 0,
    shiftX: 0,
    shiftY: -0.05,
    pointCoc: 0.6,
  },
  topSpin: {
    elevationDeg: 36,
    azimuthDeg: 0,
    distance: 1.35,
    target: [0, 0, 0],
    fovDeg: 36,
    rollDeg: 30,
    focusPoint: [0, 0.03, 0],
    aperture: 0.045,
    maxCoc: 0.03,
    pushIn: 0,
    driftDeg: 0,
    orbitDeg: 60, // exactly one sixth of a turn and back
    shiftX: 0.12,
    shiftY: 0,
    pointCoc: 0.22,
  },
} satisfies Record<string, RingCamera>;
