// Deterministic layout for everything that is "scattered": the city-light
// dots, the background bokeh and the icon ring.
//
// All of it is derived from a seeded PRNG at module scope, so every
// render worker — and every composition, 1080p or 4K — lays the scene out
// identically. Nothing here may read the current frame; per-frame motion
// lives in the components.

import { mulberry32 } from "../particle-ring/random";
import {
  DOT_BAND_INNER,
  DOT_BAND_OUTER,
  DOT_COUNT,
  BOKEH_COUNT,
  GLOBE_RADIUS,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
} from "./constants";
import { ICON_NAMES, type IconName } from "./icons";

const TAU = Math.PI * 2;

export type Dot = {
  angle: number;
  radius: number;
  size: number;
  colorIndex: number;
  /** 0..1 offset into the shared twinkle cycle. */
  phase: number;
  baseOpacity: number;
};

export type BokehBlob = {
  x: number;
  y: number;
  radius: number;
  colorIndex: number;
  baseOpacity: number;
  /** Drift amplitude and phase, so no two blobs move together. */
  driftX: number;
  driftY: number;
  phase: number;
};

export type IconPlacement = {
  name: IconName;
  angle: number;
  radius: number;
  /** Glyph box size in viewBox units. */
  size: number;
  colorIndex: number;
  /** Where the leader line starts, as a multiple of GLOBE_RADIUS. */
  lineStart: number;
  /** Frame the icon pops in on. */
  appearFrame: number;
  phase: number;
};

const buildDots = (): Dot[] => {
  const rand = mulberry32(20_260_914);
  return Array.from({ length: DOT_COUNT }, (_, i) => ({
    angle: (i / DOT_COUNT) * TAU + (rand() - 0.5) * 0.09,
    radius:
      GLOBE_RADIUS *
      (DOT_BAND_INNER + rand() * (DOT_BAND_OUTER - DOT_BAND_INNER)),
    size: 2.4 + rand() * 4.4,
    colorIndex: Math.floor(rand() * 5),
    phase: rand(),
    baseOpacity: 0.45 + rand() * 0.55,
  }));
};

const buildBokeh = (): BokehBlob[] => {
  const rand = mulberry32(77_310_412);
  return Array.from({ length: BOKEH_COUNT }, () => {
    // Spread over a canvas noticeably larger than the frame so the
    // opening pull-back keeps finding blobs instead of empty corners.
    const x = (rand() - 0.5) * VIEWBOX_WIDTH * 1.9 + VIEWBOX_WIDTH / 2;
    const y = (rand() - 0.5) * VIEWBOX_HEIGHT * 2.2 + VIEWBOX_HEIGHT / 2;
    const big = rand() < 0.22;
    return {
      x,
      y,
      radius: big ? 20 + rand() * 30 : 4 + rand() * 11,
      colorIndex: Math.floor(rand() * 4),
      baseOpacity: (big ? 0.14 : 0.34) + rand() * 0.22,
      driftX: (rand() - 0.5) * 46,
      driftY: -14 - rand() * 44,
      phase: rand(),
    };
  });
};

const buildIcons = (): IconPlacement[] => {
  const rand = mulberry32(31_415_926);
  const count = 26;
  // Deal the glyphs round-robin rather than sampling at random: random
  // draws over 26 slots reliably produce four monitors in a row and no
  // envelope at all.
  const deck = Array.from({ length: count }, (_, i) => ICON_NAMES[i % ICON_NAMES.length]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return Array.from({ length: count }, (_, i) => {
    // Even angular spacing with a little jitter — a purely random spread
    // clumps badly and leaves bald patches on the ring.
    const angle = (i / count) * TAU + (rand() - 0.5) * 0.14;
    // Alternate rows, jittered, so neighbours rarely sit at one radius.
    const outer = (i + (rand() < 0.3 ? 1 : 0)) % 2 === 0;
    return {
      name: deck[i],
      angle,
      radius: GLOBE_RADIUS * (outer ? 1.7 + rand() * 0.24 : 1.3 + rand() * 0.18),
      size: (outer ? 74 : 62) + rand() * 18,
      colorIndex: Math.floor(rand() * 6),
      lineStart: 1.12 + rand() * 0.06,
      // Icons flick on between ~1.1s and ~2.5s, in a scattered order
      // rather than sweeping cleanly around the ring.
      appearFrame: 33 + Math.floor(rand() * 42),
      phase: rand(),
    };
  });
};

export const DOTS = buildDots();
export const BOKEH = buildBokeh();
export const ICONS = buildIcons();
