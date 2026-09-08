/**
 * Inter, embedded. The woff2 files ship in public/fonts — nothing is fetched
 * from a font CDN at render time.
 */

import {continueRender, delayRender, staticFile} from 'remotion';

const face = (weight: number) => `
@font-face {
  font-family: 'InterEmbedded';
  src: url('${staticFile(`fonts/inter-${weight}.woff2`)}') format('woff2');
  font-weight: ${weight};
  font-style: normal;
  font-display: block;
}`;

export const FONT_FAMILY = "'InterEmbedded', system-ui, sans-serif";

let loaded = false;

export const loadFonts = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const style = document.createElement('style');
  style.textContent = [300, 400, 500, 700].map(face).join('\n');
  document.head.appendChild(style);

  const handle = delayRender('Loading Inter');
  Promise.all(
    [300, 400, 500, 700].map((w) => document.fonts.load(`${w} 40px InterEmbedded`))
  )
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
};
