import {staticFile} from 'remotion';
import {loadFont as loadGoogleFont} from '@remotion/google-fonts/RobotoMono';

export const FONT_FAMILY = 'Roboto Mono';

/** Every weight the sprites ask for. Canvas will not load these implicitly. */
const WEIGHTS = ['400', '500', '600', '700'] as const;

/**
 * Where the monospace face comes from.
 *
 * `false` (the default) uses the copy vendored in `public/fonts`, which keeps
 * `npx remotion render` fully offline and byte-for-byte reproducible - no CDN
 * round trip can vary between two renders of the same frame.
 *
 * Flip to `true` to fetch the same face from Google's CDN through
 * `@remotion/google-fonts` instead. Either path resolves to the identical
 * family name, so nothing else in the project changes.
 */
export const USE_GOOGLE_FONTS: boolean = false;

const loadFromCdn = async () => {
  const {waitUntilDone} = loadGoogleFont('normal', {
    weights: [...WEIGHTS],
    subsets: ['latin'],
  });
  await waitUntilDone();
};

const loadFromDisk = async () => {
  const face = new FontFace(
    FONT_FAMILY,
    `url(${staticFile('fonts/RobotoMono-latin-variable.woff2')}) format("woff2")`,
    {weight: '100 700', style: 'normal', display: 'block'},
  );
  await face.load();
  document.fonts.add(face);
};

let pending: Promise<void> | null = null;

/**
 * Resolves once the face is not just downloaded but actually registered for
 * every weight the canvas will request.
 */
export const loadMonoFont = (): Promise<void> => {
  if (!pending) {
    pending = (USE_GOOGLE_FONTS ? loadFromCdn() : loadFromDisk()).then(async () => {
      await Promise.all(
        WEIGHTS.map((w) => document.fonts.load(`${w} 36px "${FONT_FAMILY}"`)),
      );
      await document.fonts.ready;
    });
  }
  return pending;
};
