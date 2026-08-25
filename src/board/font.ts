import { staticFile } from 'remotion';

/**
 * Roboto Mono 400, vendored under `public/fonts`.
 *
 * The font has to be tabular — every digit the same advance width — or the
 * columns stop lining up the moment a value rerolls from `19.18` to `6.02`.
 *
 * It is served from the bundle rather than fetched from fonts.gstatic.com at
 * render time. A render that reaches out to a CDN once per worker is a render
 * that can produce different output, or none at all, depending on the network
 * it runs on; the file is 32KB and belongs with the code.
 */
export const FONT_FAMILY = '"Roboto Mono Board", "Roboto Mono", monospace';

const FACE = 'Roboto Mono Board';

export const loadBoardFont = (): Promise<void> => {
  if (typeof document === 'undefined') return Promise.resolve();

  const face = new FontFace(
    FACE,
    `url(${staticFile('fonts/RobotoMono-Regular.woff2')}) format('woff2')`,
    { weight: '400', style: 'normal' },
  );

  return face.load().then((loaded) => {
    document.fonts.add(loaded);
  });
};
