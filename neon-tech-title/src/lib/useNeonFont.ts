import { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

export const FONT_FAMILY = 'PoppinsNeon';
export const FONT_WEIGHT = '600';

/**
 * Loads Poppins SemiBold into `document.fonts` before the 3D canvas mounts.
 *
 * This deliberately happens OUTSIDE the three.js canvas. React state that
 * settles inside the canvas subtree does not by itself trigger a redraw --
 * the canvas only draws when Remotion advances the frame -- so a font that
 * arrives late would leave the already-drawn canvas without any text on it.
 * Resolving the font first makes text measurement synchronous on first render.
 */
export const useNeonFont = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender(`Loading ${FONT_FAMILY}`));

  useEffect(() => {
    let cancelled = false;
    const face = new FontFace(
      FONT_FAMILY,
      `url(${staticFile('fonts/Poppins-SemiBold.ttf')})`,
      { weight: FONT_WEIGHT },
    );

    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        return document.fonts.load(`${FONT_WEIGHT} 100px ${FONT_FAMILY}`);
      })
      .then(() => {
        if (cancelled) return;
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        cancelRender(
          new Error(`Could not load Poppins-SemiBold.ttf: ${(err as Error).message}`),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return ready;
};
