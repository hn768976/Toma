import {continueRender, delayRender, staticFile} from 'remotion';

/**
 * The digit field is bundled with its own font file so a render is byte-identical
 * on any machine instead of depending on whatever monospace the host happens to
 * have installed. Remotion is held back until the face is actually ready.
 */
let started = false;

export const ensureFont = () => {
  if (started || typeof document === 'undefined') return;
  started = true;

  const handle = delayRender('Loading GlobeMono');
  const face = new FontFace(
    'GlobeMono',
    `url(${staticFile('fonts/DejaVuSansMono.ttf')}) format('truetype')`,
  );

  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch(() => {
      // Fall back to the system monospace rather than stalling the render.
      continueRender(handle);
    });
};
