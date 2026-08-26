import { continueRender, delayRender, staticFile } from 'remotion';

/**
 * Roboto — a clean sans, bundled as a latin-subset variable woff2 in public/
 * rather than fetched at render time so a render never depends on the network.
 *
 * Tabular figures are not requested from the font: canvas 2D has no
 * font-feature-settings, so digit advance is normalised by hand in text.ts.
 */
export const FONT_FAMILY = 'RobotoLocal';

let started = false;

export const ensureFont = () => {
  if (started) return;
  started = true;
  const handle = delayRender('Loading Roboto');
  const face = new FontFace(
    FONT_FAMILY,
    `url(${staticFile('fonts/Roboto-latin.woff2')}) format('woff2')`,
    { weight: '100 900', style: 'normal', display: 'block' }
  );
  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      return document.fonts.ready;
    })
    .then(
      () => continueRender(handle),
      () => continueRender(handle)
    );
};
