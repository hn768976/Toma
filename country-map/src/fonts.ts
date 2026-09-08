import {staticFile} from 'remotion';

// Inter and Inter Tight, both SIL Open Font License, which permits embedding in
// footage that is sold on. Vendored under public/fonts so a render never depends
// on a font CDN or on what happens to be installed on the render machine.
const face = (
  family: string,
  weight: number,
  style: 'normal' | 'italic',
  file: string,
  range: string,
) => `
@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: block;
  src: url('${staticFile(`fonts/${file}`)}') format('woff2');
  unicode-range: ${range};
}`;

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

export const FONT_CSS = [
  face('Map Sans', 500, 'normal', 'inter-latin-500-normal.woff2', LATIN),
  face('Map Sans', 500, 'normal', 'inter-latin-ext-500-normal.woff2', LATIN_EXT),
  face('Map Sans', 700, 'normal', 'inter-latin-700-normal.woff2', LATIN),
  face('Map Sans', 700, 'normal', 'inter-latin-ext-700-normal.woff2', LATIN_EXT),
  // A drawn italic, not a synthesised oblique — a slanted upright reads wrong on
  // a map, where italic is the convention that separates water from land.
  face('Map Sans', 400, 'italic', 'inter-latin-400-italic.woff2', LATIN),
  face('Map Sans', 400, 'italic', 'inter-latin-ext-400-italic.woff2', LATIN_EXT),
  face('Map Tight', 700, 'normal', 'inter-tight-latin-700-normal.woff2', LATIN),
  face('Map Tight', 700, 'normal', 'inter-tight-latin-ext-700-normal.woff2', LATIN_EXT),
].join('\n');

export const SANS = "'Map Sans', system-ui, sans-serif";
export const TIGHT = "'Map Tight', 'Map Sans', system-ui, sans-serif";

// Country names longer than this are set in Inter Tight rather than Inter, so a
// long name fits a narrow country without the type shrinking. Switching face
// instead of size keeps the set visually consistent across every country.
export const TIGHT_THRESHOLD = 10;

export const displayFamily = (name: string) =>
  name.length > TIGHT_THRESHOLD ? TIGHT : SANS;
