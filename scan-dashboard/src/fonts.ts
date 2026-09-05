import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

/**
 * The dashboard's numerals are bundled with the project so the piece renders
 * identically anywhere, with no dependency on installed system fonts.
 */
const handle = delayRender('Loading ScanMono');

loadFont({
  family: 'ScanMono',
  url: staticFile('fonts/DejaVuSansMono.ttf'),
  weight: '400',
  format: 'truetype',
})
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
