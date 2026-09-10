/**
 * The command set. This is the only file you need to touch to add a clip.
 *
 * Add an entry and a composition appears in the Studio and in
 * `npx remotion compositions` — no component or render code changes. The label
 * may use A-Z, 0-9, space and . - / : + (see src/pixel-font.ts); `glyph` is one
 * of the shapes in src/glyphs.ts, or "none" for a word on its own. Keep `seed`
 * unique so two clips never glitch in step.
 */

import type {GlyphName} from "./glyphs";

export type VCRCommand = {
  /** Composition id. Remotion allows a-z, A-Z, 0-9 and "-" only. */
  id: string;
  /** Basename of the rendered mp4 and png. */
  file: string;
  /** The word, drawn from the 5x7 pixel grid. */
  label: string;
  glyph: GlyphName;
  seed: number;
  /** Frame used for the exported still. */
  stillFrame: number;
};

export const COMMANDS: VCRCommand[] = [
  {
    id: "VCR-Play",
    file: "VCR_Play",
    label: "PLAY",
    glyph: "play",
    seed: 101,
    stillFrame: 151,
  },
  {
    id: "VCR-Pause",
    file: "VCR_Pause",
    label: "PAUSE",
    glyph: "pause",
    seed: 202,
    stillFrame: 112,
  },
  {
    id: "VCR-Rewind",
    file: "VCR_Rewind",
    label: "REWIND",
    glyph: "rewind",
    seed: 303,
    stillFrame: 4,
  },
  {
    id: "VCR-FastForward",
    file: "VCR_FastForward",
    label: "FAST FORWARD",
    glyph: "fastForward",
    seed: 404,
    stillFrame: 408,
  },
  {
    id: "VCR-Record",
    file: "VCR_Record",
    label: "RECORD",
    glyph: "record",
    seed: 505,
    stillFrame: 432,
  },
  {
    id: "VCR-Stop",
    file: "VCR_Stop",
    label: "STOP",
    glyph: "stop",
    seed: 606,
    stillFrame: 296,
  },
  {
    id: "VCR-Eject",
    file: "VCR_Eject",
    label: "EJECT",
    glyph: "eject",
    seed: 707,
    stillFrame: 436,
  },
  {
    id: "VCR-Tracking",
    file: "VCR_Tracking",
    label: "TRACKING",
    glyph: "none",
    seed: 808,
    stillFrame: 547,
  },
];
