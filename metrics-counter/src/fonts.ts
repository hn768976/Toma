import {loadFont} from '@remotion/fonts';
import {continueRender, delayRender, staticFile} from 'remotion';

export const FONT_FAMILY = 'InterMetrics';

/**
 * The font is embedded with the project rather than pulled from a CDN or left to
 * a system fallback — a substituted face changes the metrics, and the layout is
 * built around glyph widths at nearly 300px. Rendering is held until the face is
 * actually available.
 */
const handle = delayRender('Loading Inter Black');

export const fontLoaded = loadFont({
  family: FONT_FAMILY,
  url: staticFile('fonts/Inter-Black.woff2'),
  weight: '900',
  style: 'normal',
})
  .then(() => {
    continueRender(handle);
  })
  .catch((err) => {
    continueRender(handle);
    throw err;
  });
