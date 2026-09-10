import React from 'react';
import {Composition} from 'remotion';
import {ZodiacSymbol} from './ZodiacSymbol';
import {ContactSheet} from './ContactSheet';
import {SIGNS} from './zodiac-data';

/**
 * One composition per sign. The animation, material, lighting and framing are
 * identical across all twelve - only the entry in `zodiac-data.ts` changes -
 * so a new style is a prop on <ZodiacSymbol>, not another component.
 */

/** 3840x2160. Previews are rendered from these with --scale=0.5. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 10 seconds. Every animated value is periodic over exactly this many frames. */
export const DURATION_IN_FRAMES = 300;

/**
 * Composition ids may not contain underscores, so the id is hyphenated while
 * the delivered file keeps the `Zodiac_<Sign>Gold.mp4` name.
 */
export const compositionId = (signName: string) => `Zodiac-${signName}Gold`;

/** Output filename stem for a sign, without extension. */
export const outputName = (signName: string) => `Zodiac_${signName}Gold`;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {SIGNS.map((sign) => (
        <Composition
          key={sign.name}
          id={compositionId(sign.name)}
          component={ZodiacSymbol}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{sign: sign.name}}
        />
      ))}

      {/* Review tool, not a deliverable: all twelve on one frame, for the
          framing check. */}
      <Composition
        id="Zodiac-ContactSheet"
        component={ContactSheet}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
