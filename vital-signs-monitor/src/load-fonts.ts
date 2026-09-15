import {continueRender, delayRender, staticFile} from 'remotion';

export const MONITOR_FONT = 'BarlowCondensedMonitor';

const handle = delayRender('Loading monitor font');

const face = new FontFace(
  MONITOR_FONT,
  `url(${staticFile('fonts/BarlowCondensed-Bold.woff2')}) format('woff2')`,
  {weight: '700', style: 'normal'},
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    return document.fonts.ready;
  })
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
