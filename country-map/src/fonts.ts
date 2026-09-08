import {staticFile} from 'remotion';

// Fonts are vendored under public/fonts (Inter and Barlow Condensed, both SIL
// Open Font License) so a render never depends on a font CDN.
const face = (family: string, weight: number, file: string, range: string) => `
@font-face {
  font-family: '${family}';
  font-style: normal;
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
  face('Inter Map', 500, 'inter-latin-500-normal.woff2', LATIN),
  face('Inter Map', 500, 'inter-latin-ext-500-normal.woff2', LATIN_EXT),
  face('Inter Map', 600, 'inter-latin-600-normal.woff2', LATIN),
  face('Inter Map', 600, 'inter-latin-ext-600-normal.woff2', LATIN_EXT),
  face('Barlow Map', 600, 'barlow-condensed-latin-600-normal.woff2', LATIN),
  face('Barlow Map', 600, 'barlow-condensed-latin-ext-600-normal.woff2', LATIN_EXT),
  face('Barlow Map', 700, 'barlow-condensed-latin-700-normal.woff2', LATIN),
  face('Barlow Map', 700, 'barlow-condensed-latin-ext-700-normal.woff2', LATIN_EXT),
].join('\n');

export const SANS = "'Inter Map', system-ui, sans-serif";
export const DISPLAY = "'Barlow Map', 'Inter Map', system-ui, sans-serif";
