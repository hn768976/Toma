import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {
  fontFamily as MONO_FAMILY,
  loadFont as loadMono,
} from '@remotion/google-fonts/RobotoMono';
import {
  fontFamily as COND_FAMILY,
  loadFont as loadCond,
} from '@remotion/google-fonts/BarlowCondensed';

export const MONO = MONO_FAMILY;
export const COND = COND_FAMILY;

/**
 * Google Fonts is the primary source, loaded through @remotion/google-fonts and
 * gated with delayRender()/continueRender(). Identical copies of both faces are
 * vendored in public/fonts and registered under the same family names when
 * fonts.gstatic.com cannot be reached, so a render never blocks on the network.
 */
const LOCAL: [string, string, string][] = [
  [MONO_FAMILY, 'fonts/roboto-mono-latin-400.woff2', '400'],
  [COND_FAMILY, 'fonts/barlow-condensed-latin-400.woff2', '400'],
  [COND_FAMILY, 'fonts/barlow-condensed-latin-600.woff2', '600'],
];

const fromGoogle = async () => {
  await fetch('https://fonts.gstatic.com/', {mode: 'no-cors'});
  const a = loadMono('normal', {weights: ['400', '500'], subsets: ['latin']});
  const b = loadCond('normal', {weights: ['400', '600'], subsets: ['latin']});
  await Promise.all([a.waitUntilDone(), b.waitUntilDone()]);
};

const fromPublic = async () => {
  await Promise.all(
    LOCAL.map(async ([family, file, weight]) => {
      const face = new FontFace(family, `url(${staticFile(file)})`, {weight});
      await face.load();
      document.fonts.add(face);
    }),
  );
};

let done = false;
const listeners = new Set<() => void>();
const handle = delayRender('scan-hud: typefaces');

const finish = () => {
  done = true;
  listeners.forEach((l) => l());
  continueRender(handle);
};

fromGoogle()
  .catch(fromPublic)
  .then(() => document.fonts.ready)
  .then(finish, finish);

export const fontsReady = () => done;

/**
 * Panel chrome is rasterised once and cached, so it has to be re-cut when the
 * typefaces land. This is load state, not animation state.
 */
export const useFontsReady = (): boolean => {
  const [ready, setReady] = useState(done);
  useEffect(() => {
    if (done) {
      setReady(true);
      return;
    }
    const cb = () => setReady(true);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return ready;
};

export const monoFont = (px: number, weight = 400) =>
  `${weight} ${px}px "${MONO}", monospace`;
export const condFont = (px: number, weight = 400) =>
  `${weight} ${px}px "${COND}", sans-serif`;
