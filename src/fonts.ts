import {getInfo as monoInfo} from '@remotion/google-fonts/JetBrainsMono';
import {getInfo as displayInfo} from '@remotion/google-fonts/Poppins';
import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

/**
 * Fonts: a heavy geometric sans for the "AI" glyph, a monospace for the code.
 *
 * @remotion/google-fonts supplies the font identity — family names and the exact
 * face URLs — but the woff2 files themselves are vendored into public/fonts and
 * served from there. Canvas text is drawn, not laid out by the browser, so a face
 * that is still in flight silently falls back to a system font and the frame is
 * wrong with no error. Serving locally removes that race, and removes the
 * network from `remotion render` entirely. To go back to fetching from Google,
 * swap the FontFace sources below for that package's loadFont().
 */

/** Heavy geometric sans — the "AI" glyph. */
export const DISPLAY_FAMILY = displayInfo().fontFamily;
/** Monospace — the floating code. */
export const MONO_FAMILY = monoInfo().fontFamily;

interface FaceSpec {
  family: string;
  weight: string;
  file: string;
}

const FACES: readonly FaceSpec[] = [
  {family: DISPLAY_FAMILY, weight: '700', file: 'fonts/Poppins-700-latin.woff2'},
  {family: DISPLAY_FAMILY, weight: '800', file: 'fonts/Poppins-800-latin.woff2'},
  {family: MONO_FAMILY, weight: '400', file: 'fonts/JetBrainsMono-400-latin.woff2'},
];

let pending: Promise<void> | null = null;

const loadAllFaces = (): Promise<void> => {
  if (!pending) {
    pending = Promise.all(
      FACES.map(async (spec) => {
        const face = new FontFace(
          spec.family,
          `url(${staticFile(spec.file)}) format('woff2')`,
          {weight: spec.weight, style: 'normal'},
        );
        document.fonts.add(await face.load());
      }),
    ).then(() => document.fonts.ready.then(() => undefined));
  }
  return pending;
};

/**
 * Holds the renderer back until both faces are usable. Nothing may be painted
 * before this returns true.
 */
export const useFontsReady = (): boolean => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading display and monospace fonts'));

  useEffect(() => {
    let mounted = true;
    loadAllFaces()
      .then(() => {
        if (mounted) setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      mounted = false;
    };
  }, [handle]);

  return ready;
};
