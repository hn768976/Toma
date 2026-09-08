/**
 * Barlow Semi Condensed, embedded.
 *
 * The woff2 files ship in public/fonts — nothing is fetched from a font CDN at
 * render time. Barlow is SIL Open Font Licensed, so embedding it in footage that
 * is sold is permitted.
 *
 * Semi Condensed is the working face for the whole project. Condensed is carried
 * as well, for any country whose name is long enough to need the narrower cut
 * rather than a smaller size — set `titleFace: 'condensed'` on that country.
 */

import {continueRender, delayRender, staticFile} from 'remotion';

export const FONT_SEMI = 'BarlowSemiCondensedEmbedded';
export const FONT_CONDENSED = 'BarlowCondensedEmbedded';

export type TitleFace = 'semi' | 'condensed';

export const titleFontFamily = (face: TitleFace): string =>
  face === 'condensed'
    ? `'${FONT_CONDENSED}', '${FONT_SEMI}', system-ui, sans-serif`
    : `'${FONT_SEMI}', system-ui, sans-serif`;

export const FONT_FAMILY = titleFontFamily('semi');

/**
 * Weights, per the type brief:
 *   800 country name (bold caps)   600 capital city   500 city labels
 *   400 neighbour countries        400 italic water labels
 */
const SEMI_WEIGHTS = [400, 500, 600, 700, 800] as const;
const CONDENSED_WEIGHTS = [400, 500, 700, 800] as const;

const face = (family: string, file: string, weight: number, style = 'normal') => `
@font-face {
  font-family: '${family}';
  src: url('${staticFile(`fonts/${file}`)}') format('woff2');
  font-weight: ${weight};
  font-style: ${style};
  font-display: block;
}`;

let loaded = false;

export const loadFonts = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;

  const css = [
    ...SEMI_WEIGHTS.map((w) => face(FONT_SEMI, `barlow-semi-condensed-${w}.woff2`, w)),
    face(FONT_SEMI, 'barlow-semi-condensed-400-italic.woff2', 400, 'italic'),
    ...CONDENSED_WEIGHTS.map((w) => face(FONT_CONDENSED, `barlow-condensed-${w}.woff2`, w)),
  ].join('\n');

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const handle = delayRender('Loading Barlow');
  Promise.all([
    ...SEMI_WEIGHTS.map((w) => document.fonts.load(`${w} 40px ${FONT_SEMI}`)),
    document.fonts.load(`italic 400 40px ${FONT_SEMI}`),
    ...CONDENSED_WEIGHTS.map((w) => document.fonts.load(`${w} 40px ${FONT_CONDENSED}`)),
  ])
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
};
