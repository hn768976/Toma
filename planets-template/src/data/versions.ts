// One data row per composition (17 in all). Each row holds everything the
// shot needs: body, shot style, framing, axial tilt, rotation direction,
// atmosphere colour and strength, rings, and the light angle.
import { BODIES, BodyId } from "./bodies";

export type Shot = "spin" | "crescent";

export type VersionRow = {
  // Deliverable name (Planet_Mars_Spin). Remotion composition ids cannot
  // contain "_", so the composition is registered as compositionId(row).
  id: string;
  body: BodyId;
  shot: Shot;
  durationInFrames: number;
  framing: {
    // Disc (equatorial) diameter as a fraction of the frame height.
    discHeightFrac: number;
    // Disc centre in frame fractions (0.5, 0.5 = centred).
    centerX: number;
    centerY: number;
    // Crescent only: push-in as a fraction of the start size.
    pushIn: number;
  };
  tilt: {
    obliquityDeg: number;
    // How the pole is presented: lean in the image plane (+ = toward the
    // right) and toward the camera (+ = north pole toward the viewer).
    rollDeg: number;
    pitchDeg: number;
  };
  rotation: {
    // +1: features cross the near side left to right (prograde about the
    // map's +Y pole); -1: the reverse.
    direction: 1 | -1;
    // Longitude facing the camera at the hero frame (Spin 300, Crescent 400).
    faceLonDeg: number;
    // Total turn over the clip (Spin: exactly 360).
    turnDeg: number;
  };
  atmosphere: { color: [number, number, number]; strength: number } | null;
  rings: boolean;
  light: {
    // Angle between the camera axis and the direction to the sun.
    angleDeg: number;
    // Which side the sun is on (-1 left, +1 right) and its elevation.
    side: -1 | 1;
    elevationDeg: number;
    // Crescent: swing toward the camera over the clip (degrees).
    swingDeg: number;
  };
  exposure: number;
  // Multiplies the normal-map relief (Crescent shots light the terminator
  // at a grazing angle, where relief is the point of the shot).
  reliefBoost: number;
  // Added to the body's wrap (softer terminator) and multiplier on its
  // colour saturation; sunlight colour (linear RGB).
  wrapBoost: number;
  saturationBoost: number;
  sunColor: [number, number, number];
  // Multiplier on the body's atmosphere strength for this shot.
  atmosphereScale: number;
  // Faint fill light from the opposite side (fraction of the sun), so
  // relief stays faintly visible on the night side of Crescent shots.
  fill: number;
  // Multiplier on limb darkening (0 on Crescent shots: a backlit crescent
  // is brightest toward its limb).
  limbScale: number;
  starBrightness: number;
};

const SPIN_FRAMES = 600;
const CRESCENT_FRAMES = 450;

const prefix = (b: BodyId) => (BODIES[b].kind === "dwarf" ? "DwarfPlanet" : "Planet");

// Per-body presentation: how the obliquity is shown, which way it turns,
// and which longitude is the "hero" face.
const PRESENT: Record<
  BodyId,
  { roll: number; pitch: number; dir: 1 | -1; face: number; spinDisc?: number; exposure?: number }
> = {
  // Mercury: obliquity ~0. Faces the Caloris side.
  mercury: { roll: 0.03, pitch: 0, dir: 1, face: 150 },
  // Venus: 177.4 deg = 2.6 deg tilt with retrograde spin (IAU north up).
  venus: { roll: 180 - 177.36, pitch: 0, dir: -1, face: 0, exposure: 0.95 },
  // Mars: 25.2 deg, with the north pole tipped 20 deg toward the camera so
  // the north polar cap is in view; Valles Marineris / Tharsis face us.
  mars: { roll: 25.19, pitch: 20, dir: 1, face: -75 },
  // Jupiter: 3.1 deg; the Great Red Spot faces the camera at the hero frame.
  jupiter: { roll: 3.13, pitch: 0, dir: 1, face: BODIES.jupiter.greatRedSpot?.lonDeg ?? 0 },
  // Saturn: 26.7 deg, presented as seen from Earth with the rings open ~24 deg.
  saturn: { roll: 8, pitch: 24, dir: 1, face: 0 },
  // Uranus: 97.8 deg = 82.2 deg with retrograde spin; as now seen from Earth
  // (north pole toward us, rings nearly face-on).
  uranus: { roll: 15, pitch: 64, dir: -1, face: 0 },
  // Neptune: 28.3 deg; the Great Dark Spot toward the camera.
  neptune: { roll: 28.32, pitch: 0, dir: 1, face: 23 },
  // Pluto: New Horizons maps use the positive (right-hand-rule) pole as +Y,
  // which lies 122.5 deg from orbital north, so it is shown leaning past
  // horizontal; turning prograde about it reads as retrograde on screen.
  // The heart (Sputnik Planitia, ~175 E) faces the camera.
  pluto: { roll: 122.53, pitch: 0, dir: 1, face: 178 },
  // Ceres: 4 deg; Occator crater (239 E) toward the camera.
  ceres: { roll: 4, pitch: 0, dir: 1, face: -121 },
};

// Disc diameter (fraction of frame height) that fits a ring system:
// ring outer diameter 85% of the frame width, and within 92% of its height.
function ringFit(b: BodyId, pitchDeg: number, rollDeg: number): number {
  const outer = BODIES[b].rings?.outer ?? 1;
  const byWidth = (0.85 * (16 / 9)) / outer;
  // Projected half-height of the ring ellipse relative to its radius.
  const p = (pitchDeg * Math.PI) / 180, r = (rollDeg * Math.PI) / 180;
  const minor = Math.abs(Math.sin(p));
  const halfH = Math.sqrt((Math.cos(r) * minor) ** 2 + Math.sin(r) ** 2);
  const byHeight = 0.92 / (outer * halfH);
  return Math.min(byWidth, byHeight);
}

function spinRow(b: BodyId): VersionRow {
  const m = BODIES[b];
  const pr = PRESENT[b];
  const disc = m.rings ? ringFit(b, pr.pitch, pr.roll) : 0.65;
  return {
    id: `${prefix(b)}_${m.name}_Spin`,
    body: b,
    shot: "spin",
    durationInFrames: SPIN_FRAMES,
    framing: { discHeightFrac: disc, centerX: 0.5, centerY: 0.5, pushIn: 0 },
    tilt: { obliquityDeg: m.obliquityDeg, rollDeg: pr.roll, pitchDeg: pr.pitch },
    rotation: { direction: pr.dir, faceLonDeg: pr.face, turnDeg: 360 },
    atmosphere: m.atmosphere ? { color: m.atmosphere.color, strength: m.atmosphere.strength } : null,
    rings: Boolean(m.rings),
    // Sun ~35 deg off the camera axis, front-left. For Saturn it is swung up
    // (still ~35 deg off-axis: 20 deg left, 29 deg up) so it stands ~47 deg
    // above the ring plane and the rings' shadow falls on the visible globe
    // just below them.
    light: b === "saturn"
      ? { angleDeg: 20, side: -1, elevationDeg: 29, swingDeg: 0 }
      : { angleDeg: 35, side: -1, elevationDeg: 6, swingDeg: 0 },
    exposure: 1.1 * (pr.exposure ?? 1),
    reliefBoost: 1,
    wrapBoost: 0.15,
    saturationBoost: 1,
    sunColor: [1, 1, 1],
    atmosphereScale: 1,
    fill: 0,
    limbScale: 1,
    starBrightness: 0.85,
  };
}

function crescentRow(b: BodyId): VersionRow {
  const m = BODIES[b];
  const pr = PRESENT[b];
  return {
    id: `${prefix(b)}_${m.name}_Crescent`,
    body: b,
    shot: "crescent",
    durationInFrames: CRESCENT_FRAMES,
    framing: { discHeightFrac: 0.95, centerX: 0.48, centerY: 0.47, pushIn: 0.08 },
    // Saturn's crescent is seen from south of the ring plane with the sun to
    // the north (as in Cassini's backlit views): the ring shadow falls in
    // broad bands across the crescent, and the rings glow with sunlight
    // diffusing through them.
    tilt: { obliquityDeg: m.obliquityDeg, rollDeg: pr.roll, pitchDeg: b === "saturn" ? -pr.pitch : pr.pitch },
    // The hero face sits ~70 deg west of the lit limb so relief on the
    // terminator is the interesting terrain.
    rotation: { direction: pr.dir, faceLonDeg: pr.face - 60 * pr.dir, turnDeg: 25 },
    atmosphere: m.atmosphere ? { color: m.atmosphere.color, strength: m.atmosphere.strength } : null,
    rings: Boolean(m.rings),
    // From behind and to the upper right (~110-115 deg off the camera axis),
    // so the terminator runs diagonally and the lower disc falls into shadow.
    // Saturn: lit from the right (5 deg up), which puts the sun ~20 deg
    // north of the ring plane, so the rings' shadow falls as broad bands
    // across the middle of the crescent.
    light: { angleDeg: 115, side: 1, elevationDeg: b === "saturn" ? 5 : 35, swingDeg: 8 },
    exposure: 2.1 * (pr.exposure ?? 1),
    reliefBoost: 2.4,
    wrapBoost: 0,
    saturationBoost: 1.3,
    // Warm low sun; Mars gets the hot amber of the reference look.
    sunColor: b === "mars" ? [1.0, 0.86, 0.5] : [1.0, 0.95, 0.85],
    // Mars is not one of the crescent bodies with an atmosphere arc.
    atmosphereScale: b === "mars" ? 0.15 : 1,
    fill: 0.05,
    limbScale: 0,
    starBrightness: 0.02,
  };
}

const SPIN_BODIES: BodyId[] = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "ceres"];
const CRESCENT_BODIES: BodyId[] = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

export const VERSIONS: VersionRow[] = [
  ...SPIN_BODIES.map(spinRow),
  ...CRESCENT_BODIES.map(crescentRow),
];

// Frame used for each composition's still / contact sheet.
export const heroFrame = (row: VersionRow) => (row.shot === "spin" ? 300 : 400);

// Remotion composition id: Planet_Mars_Spin -> Planet-Mars-Spin.
export const compositionId = (row: VersionRow) => row.id.replace(/_/g, "-");
