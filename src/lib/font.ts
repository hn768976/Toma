import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {loadFont as loadGoogleFont} from '@remotion/google-fonts/RobotoMono';

/**
 * Roboto Mono — a clean sans with inherently tabular figures, so the price
 * labels never jitter as their digits reroll.
 *
 * By default the face is fetched with @remotion/google-fonts on first run.
 * Set REMOTION_OFFLINE_FONTS=1 to load the identical woff2 that ships in
 * public/fonts/ instead — same file, same glyphs, same pixels — for machines
 * with no outbound network (or a TLS-intercepting proxy the browser does not
 * trust). Either way the whole thing is gated behind delayRender(), so no
 * frame is ever captured before the face is usable.
 */
export const FONT_FAMILY = 'Roboto Mono';

const OFFLINE = process.env.REMOTION_OFFLINE_FONTS === '1';

let ready = false;

export const isFontReady = () => ready;

export const fontPromise: Promise<void> = (() => {
  const handle = delayRender('Loading Roboto Mono for the price labels');

  const load = OFFLINE
    ? new FontFace(
        FONT_FAMILY,
        `url(${staticFile('fonts/RobotoMono-latin-var.woff2')}) format('woff2')`,
        {weight: '100 700', style: 'normal'},
      )
        .load()
        .then((face) => {
          document.fonts.add(face);
        })
    : loadGoogleFont('normal', {weights: ['500'], subsets: ['latin']}).waitUntilDone();

  return load
    .then(() => document.fonts.load('500 72px "Roboto Mono"'))
    .then(() => document.fonts.ready)
    .then(() => {
      ready = true;
      continueRender(handle);
    })
    .catch((err) => {
      cancelRender(err);
    });
})();
