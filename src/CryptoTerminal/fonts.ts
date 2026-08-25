import {staticFile} from 'remotion';

/**
 * Fonts are self-hosted under public/fonts rather than fetched from Google.
 *
 * A render that reaches out to the network is a render that can fail, or worse,
 * silently fall back to a proportional face — and proportional figures make the
 * axis labels jitter as they count up. Both files are variable-weight, so one
 * face per family covers every weight the scene uses.
 */
export const FONT_MONO = 'TerminalMono';
export const FONT_SANS = 'TerminalSans';

const face = (family: string, file: string) =>
  new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, {
    weight: '100 900',
    style: 'normal',
  });

let loading: Promise<void> | null = null;

/** Idempotent: every frame awaits the same promise. */
export const loadFonts = (): Promise<void> => {
  if (!loading) {
    loading = Promise.all(
      [face(FONT_MONO, 'RobotoMono.woff2'), face(FONT_SANS, 'Roboto.woff2')].map((f) =>
        f.load().then((loaded) => {
          document.fonts.add(loaded);
        })
      )
    ).then(() => document.fonts.ready.then(() => undefined));
  }
  return loading;
};
