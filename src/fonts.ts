import {loadFont as loadMonoFont} from '@remotion/google-fonts/RobotoMono';
import {loadFont as loadSansFont} from '@remotion/google-fonts/Inter';
import {continueRender, delayRender} from 'remotion';
import {useEffect, useState} from 'react';

const sans = loadSansFont('normal', {weights: ['400', '600', '700'], subsets: ['latin']});
const mono = loadMonoFont('normal', {weights: ['400', '700'], subsets: ['latin']});

export const SANS = sans.fontFamily;
export const MONO = mono.fontFamily;

/**
 * Canvas text will silently fall back to a system face if it is drawn before
 * the webfont is available, so the render is held until both faces have been
 * parsed and the font set has settled.
 */
const ready = Promise.all([sans.waitUntilDone(), mono.waitUntilDone()]).then(() =>
  typeof document === 'undefined' ? null : document.fonts.ready
);

export const useFontsReady = (): boolean => {
  const [handle] = useState(() => delayRender('Loading Inter + Roboto Mono'));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ready
      .then(() => {
        if (!cancelled) setLoaded(true);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return loaded;
};
