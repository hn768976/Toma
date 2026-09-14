// Builds the 3D field of panels, plus the camera path and the depth-of-field
// model. Everything in here is a pure function of a seed (and, for the
// camera, of time), so any frame can be rendered independently.

import {
  APERTURE,
  BASE_HEIGHT,
  BASE_WIDTH,
  CAMERA_BOB_PERIOD,
  CAMERA_SWAY_PERIOD,
  CAMERA_X_SWAY,
  CAMERA_Y_BOB,
  CAMERA_Y_DRIFT,
  CAMERA_Z_PUSH,
  FAR_Z,
  FIELD_X_SPREAD,
  FIELD_Y_SPREAD,
  FOCAL,
  FOCUS_FAR_Z,
  FOCUS_NEAR_Z,
  MAX_BLUR_PX,
  NEAR_Z,
  PANEL_COUNT,
  STREAK_COUNT,
} from "./constants";
import { codeBlock, numberGrid, panelLabel, panelMeta } from "./content";
import { chance, intRange, mulberry32, range } from "./random";

export type PanelKind = "code" | "framed" | "table" | "bars";

/** A highlighted source line: the orange selection bars in the reference. */
export type LineDeco = {
  line: number;
  kind: "hot" | "cool";
  widthFrac: number;
};

/** A free-floating indicator bar inside a panel, in panel-local px. */
export type PanelBar = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "hot" | "cool" | "faint";
};

export type Panel = {
  id: number;
  kind: PanelKind;
  /** World position. x/y are offsets from the field axis, z is depth. */
  x: number;
  y: number;
  z: number;
  /** Authored size in world units, before projection. */
  width: number;
  height: number;
  /** Type metrics in world units. */
  fontSize: number;
  lineHeight: number;
  padding: number;
  lines: string[];
  decos: LineDeco[];
  bars: PanelBar[];
  label: string | null;
  meta: string | null;
  framed: boolean;
  /** 0 = faintest background layer, 1 = brightest foreground. */
  brightness: number;
  opacity: number;
};

export type Camera = { x: number; y: number; z: number };

/**
 * Camera at a normalised time t in [0, 1].
 *
 * World +Y points down-screen and the projection is `screenY = centreY +
 * (panelY - cameraY) * scale`, so a camera Y that decreases over time is a
 * camera rising through the field — which reads on screen as the whole wall
 * of code drifting steadily downward, as in the reference. On top of that
 * sits a gentle dolly-in and a lateral sway, so the parallax never settles
 * into a single flat direction.
 */
export const cameraAt = (t: number, durationSeconds: number): Camera => {
  const seconds = t * durationSeconds;
  return {
    x: Math.sin((seconds / CAMERA_SWAY_PERIOD) * Math.PI * 2) * CAMERA_X_SWAY,
    y:
      -t * CAMERA_Y_DRIFT +
      Math.sin((seconds / CAMERA_BOB_PERIOD) * Math.PI * 2) * CAMERA_Y_BOB,
    z: t * CAMERA_Z_PUSH,
  };
};

/**
 * Circle of confusion, in base (1080p) pixels. Zero inside the focus band,
 * then growing as (distance outside the band) / depth.
 */
export const blurForDepth = (depth: number) => {
  const outside =
    depth < FOCUS_NEAR_Z
      ? FOCUS_NEAR_Z - depth
      : depth > FOCUS_FAR_Z
        ? depth - FOCUS_FAR_Z
        : 0;
  if (outside === 0) return 0;
  return Math.min(MAX_BLUR_PX, (APERTURE * outside) / depth);
};

/**
 * How large a panel is authored relative to its depth. Fully compensating
 * for perspective (size proportional to z) would make every layer render at
 * an identical on-screen size and kill the sense of depth; not compensating
 * at all leaves the far wall as unreadable dust. The 0.65 exponent keeps far
 * text legibly small and near text comfortably large.
 */
const depthSizeScale = (z: number) => Math.pow(z / FOCAL, 0.65);

// R2 low-discrepancy sequence. Placing panels with plain uniform randoms
// leaves visible clumps and holes in a field this size; R2 fills the frame
// evenly at every prefix length, so each depth stratum covers the screen.
const R2_A1 = 0.7548776662466927; // 1 / plastic number
const R2_A2 = 0.5698402909980532; // 1 / plastic number^2
const r2 = (n: number) => ({
  u: (0.5 + R2_A1 * n) % 1,
  v: (0.5 + R2_A2 * n) % 1,
});

const buildPanel = (id: number, seed: number, tDepth: number): Panel => {
  const rng = mulberry32(seed);

  // Log-uniform in depth: even spacing in apparent size rather than in z.
  const z = NEAR_Z * Math.pow(FAR_Z / NEAR_Z, tDepth);
  const sizeScale = depthSizeScale(z);

  // Seed in normalised screen space at this depth, then unproject, so every
  // layer covers the frame evenly. A little jitter on top of the sequence
  // breaks up the residual lattice without reintroducing holes.
  const { u, v } = r2(id);
  const worldPerScreenX = z / FOCAL;
  const nx = (u - 0.5) * 2 * FIELD_X_SPREAD + range(rng, -0.05, 0.05);
  const x = nx * BASE_WIDTH * worldPerScreenX;
  // The vertical span must cover the frame at this depth *and* the whole
  // camera rise, or the field runs out from under the camera mid-clip.
  const ySpan = BASE_HEIGHT * worldPerScreenX * FIELD_Y_SPREAD * 2 + CAMERA_Y_DRIFT * 1.25;
  const y = (v - 0.5 + range(rng, -0.04, 0.04)) * ySpan - CAMERA_Y_DRIFT * 0.5;

  const kindRoll = rng();
  const kind: PanelKind =
    kindRoll < 0.34 ? "framed" : kindRoll < 0.68 ? "code" : kindRoll < 0.88 ? "table" : "bars";

  const fontSize = range(rng, 9.5, 12) * sizeScale;
  const lineHeight = fontSize * range(rng, 1.28, 1.46);
  const padding = fontSize * range(rng, 1.1, 2.2);

  const charWidth = fontSize * 0.52; // Share Tech Mono advance ratio
  const cols = intRange(rng, 16, 48);
  const rows = intRange(rng, 6, 26);

  const framed = kind === "framed";
  const label = framed || chance(rng, 0.3) ? panelLabel(rng) : null;
  const meta = framed && chance(rng, 0.6) ? panelMeta(rng) : null;

  const lines =
    kind === "table"
      ? numberGrid(rng, rows, intRange(rng, 3, 6))
      : kind === "bars"
        ? codeBlock(rng, Math.max(3, Math.round(rows * 0.4)))
        : codeBlock(rng, rows);

  // Header rows occupy space above the body text.
  const headerRows = (label ? 1 : 0) + (meta ? 1 : 0);
  const width = cols * charWidth + padding * 2;
  const height = (lines.length + headerRows * 1.6) * lineHeight + padding * 2;

  // Selection highlights: usually a short run of consecutive lines, the way
  // an editor marks a block, rather than scattered single rows.
  const decos: LineDeco[] = [];
  if (chance(rng, 0.3)) {
    const runStart = intRange(rng, 0, Math.max(0, lines.length - 3));
    const runLength = intRange(rng, 1, 3);
    for (let i = 0; i < runLength && runStart + i < lines.length; i++) {
      decos.push({
        line: runStart + i,
        kind: "hot",
        widthFrac: range(rng, 0.4, 0.9),
      });
    }
  }
  if (chance(rng, 0.3)) {
    decos.push({
      line: intRange(rng, 0, Math.max(0, lines.length - 1)),
      kind: "cool",
      widthFrac: range(rng, 0.4, 0.95),
    });
  }

  // Free-floating indicator bars. "bars" panels are mostly these.
  const bars: PanelBar[] = [];
  const barCount = kind === "bars" ? intRange(rng, 4, 8) : intRange(rng, 0, 2);
  for (let i = 0; i < barCount; i++) {
    const h = lineHeight * range(rng, 0.32, 0.72);
    bars.push({
      x: padding + range(rng, 0, 0.25) * width,
      y: padding + range(rng, 0, 0.92) * (height - padding * 2),
      w: range(rng, 0.25, 0.88) * (width - padding * 2),
      h,
      kind: chance(rng, 0.18) ? "hot" : chance(rng, 0.55) ? "cool" : "faint",
    });
  }

  // Far layers sit back in the haze; the focus band carries the contrast.
  const depthFade =
    1 - Math.min(1, Math.max(0, (z - FOCUS_FAR_Z) / (FAR_Z - FOCUS_FAR_Z))) * 0.4;
  const brightness = Math.min(1, Math.max(0, depthFade * range(rng, 0.7, 1.15)));

  return {
    id,
    kind,
    x,
    y,
    z,
    width,
    height,
    fontSize,
    lineHeight,
    padding,
    lines,
    decos,
    bars,
    label,
    meta,
    framed,
    brightness,
    opacity: range(rng, 0.45, 0.92) * depthFade,
  };
};

export const buildField = (seed: number): Panel[] => {
  const jitter = mulberry32(seed ^ 0x5f3759df);
  const panels: Panel[] = [];
  for (let i = 0; i < PANEL_COUNT; i++) {
    // Stratified in depth so no layer is ever left empty by chance.
    const tDepth = (i + jitter()) / PANEL_COUNT;
    panels.push(buildPanel(i, seed + i * 7919 + 1, tDepth));
  }
  // Painter's algorithm: far panels first.
  return panels.sort((a, b) => b.z - a.z);
};

/** Horizontal lens streaks that sweep across the field. */
export type Streak = {
  /** Normalised screen Y at t = 0. */
  y0: number;
  /** Normalised screen Y drift per unit t. */
  drift: number;
  /** Normalised screen X of the streak centre, and its half-length. */
  x0: number;
  xDrift: number;
  length: number;
  thickness: number;
  blur: number;
  intensity: number;
  hot: boolean;
  /** Seconds for one brightness pulse. */
  pulsePeriod: number;
  pulsePhase: number;
};

export const buildStreaks = (seed: number): Streak[] => {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const streaks: Streak[] = [];
  for (let i = 0; i < STREAK_COUNT; i++) {
    const hot = chance(rng, 0.25);
    // Every fourth streak is a long, wide, low-contrast sweep — those are
    // what give the reference its horizontal light-leak banding. The rest
    // are shorter and tighter, reading as specular glints off the panels.
    const wide = i % 4 === 0;
    streaks.push({
      y0: range(rng, -0.15, 1.15),
      drift: range(rng, 0.1, 0.38) * (wide ? 0.6 : 1),
      x0: range(rng, 0.1, 0.9),
      xDrift: range(rng, -0.18, 0.18),
      length: wide ? range(rng, 0.9, 1.5) : range(rng, 0.3, 0.85),
      thickness: wide ? range(rng, 30, 90) : range(rng, 6, 30),
      blur: wide ? range(rng, 22, 46) : range(rng, 5, 20),
      intensity: wide ? range(rng, 0.35, 0.7) : range(rng, 0.5, 1.15),
      hot,
      pulsePeriod: range(rng, 5, 14),
      pulsePhase: rng(),
    });
  }
  return streaks;
};
