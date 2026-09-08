/**
 * Exact text measurement for the offline label solver.
 *
 * The collision pass runs at build time but the type is drawn by Chromium, so
 * the two only agree if the offline widths are the real ones. fontkit reads the
 * same woff2 files the compositions embed, so a measured box is the box that
 * gets painted — no per-glyph averages, no safety fudge that leaves labels
 * either overlapping or needlessly spread out.
 */

import * as fontkit from 'fontkit';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const FONTS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'public',
  'fonts'
);

export type FontFace = 'semi' | 'condensed';

const FILES: Record<string, string> = {
  'semi-400': 'barlow-semi-condensed-400.woff2',
  'semi-400-italic': 'barlow-semi-condensed-400-italic.woff2',
  'semi-500': 'barlow-semi-condensed-500.woff2',
  'semi-600': 'barlow-semi-condensed-600.woff2',
  'semi-700': 'barlow-semi-condensed-700.woff2',
  'semi-800': 'barlow-semi-condensed-800.woff2',
  'condensed-400': 'barlow-condensed-400.woff2',
  'condensed-500': 'barlow-condensed-500.woff2',
  'condensed-700': 'barlow-condensed-700.woff2',
  'condensed-800': 'barlow-condensed-800.woff2',
};

const cache = new Map<string, {advance: (t: string) => number}>();

const load = (face: FontFace, weight: number, italic: boolean) => {
  const key = `${face}-${weight}${italic ? '-italic' : ''}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const file = FILES[key] ?? FILES[`${face}-${weight}`] ?? FILES['semi-400'];
  const font = fontkit.openSync(path.join(FONTS, file)) as fontkit.Font;
  const upem = font.unitsPerEm;
  const entry = {
    advance: (text: string) => font.layout(text).advanceWidth / upem,
  };
  cache.set(key, entry);
  return entry;
};

export interface TextStyle {
  fontSize: number;
  face?: FontFace;
  weight?: number;
  italic?: boolean;
  /** Tracking, as a fraction of the font size, matching SVG letter-spacing. */
  letterSpacing?: number;
}

/** Rendered advance width in pixels, including tracking. */
export const measureText = (text: string, s: TextStyle): number => {
  const {fontSize, face = 'semi', weight = 400, italic = false, letterSpacing = 0} = s;
  const em = load(face, weight, italic).advance(text);
  // SVG letter-spacing adds after every glyph, including the last.
  return em * fontSize + text.length * letterSpacing * fontSize;
};

/**
 * The largest font size at which `text` fits `maxWidth`, capped at `preferred`.
 * Used for the country name, which is sized to the frame but must not outgrow
 * the country it sits on.
 */
export const fitFontSize = (
  text: string,
  maxWidth: number,
  preferred: number,
  s: Omit<TextStyle, 'fontSize'>
): number => {
  const at1 = measureText(text, {...s, fontSize: 1});
  if (at1 <= 0) return preferred;
  return Math.min(preferred, maxWidth / at1);
};
