import {loadFontFromInfo} from '@remotion/google-fonts/from-info';
import {getInfo as monoInfo} from '@remotion/google-fonts/RobotoMono';
import {getInfo as sansInfo} from '@remotion/google-fonts/Roboto';
import {staticFile} from 'remotion';

/**
 * Fonts come from @remotion/google-fonts, but the woff2 files themselves are
 * vendored into public/ and the metadata is pointed at them. Google Fonts'
 * metadata still supplies the family name, the weights and the unicode ranges;
 * nothing is fetched over the network at render time, so a 4K render on another
 * machine is reproducible and cannot stall on a font request.
 */
type FontMeta = Parameters<typeof loadFontFromInfo>[0];

const localise = (
  info: {fontFamily: string; version: string; url: string; unicodeRanges: Record<string, string>},
  style: string,
  weights: string[],
  file: string,
): FontMeta => {
  const fonts: Record<string, Record<string, Record<string, string>>> = {[style]: {}};
  for (const weight of weights) {
    fonts[style][weight] = {latin: staticFile(file)};
  }
  return {...info, fonts} as unknown as FontMeta;
};

const mono = loadFontFromInfo(
  localise(monoInfo(), 'normal', ['400', '700'], 'fonts/RobotoMono-latin.woff2'),
  'normal',
  {weights: ['400', '700'], subsets: ['latin']},
);

const sans = loadFontFromInfo(
  localise(sansInfo(), 'italic', ['900'], 'fonts/Roboto-Italic-900-latin.woff2'),
  'italic',
  {weights: ['900'], subsets: ['latin']},
);

export const MONO_FAMILY = mono.fontFamily;
export const SANS_FAMILY = sans.fontFamily;

export const monoFont = (size: number, weight: 400 | 700 = 400): string =>
  `${weight} ${size}px "${MONO_FAMILY}", monospace`;

export const bannerFont = (size: number): string =>
  `italic 900 ${size}px "${SANS_FAMILY}", sans-serif`;

/**
 * Canvas text does not participate in normal font loading, so the exact face
 * strings have to be forced into document.fonts before the first draw. The
 * composition gates on this with delayRender()/continueRender().
 */
export const fontsReady: Promise<unknown> = Promise.all([
  mono.waitUntilDone(),
  sans.waitUntilDone(),
]).then(() =>
  Promise.all([
    document.fonts.load(monoFont(26, 400)),
    document.fonts.load(monoFont(26, 700)),
    document.fonts.load(bannerFont(170)),
  ]),
);
