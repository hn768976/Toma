import React from 'react';
import {Composition} from 'remotion';
import {COUNTRIES} from './data/countries';
import {COMP_HEIGHT, COMP_WIDTH, DURATION_IN_FRAMES, FPS, Framing} from './flag/constants';
import {WavingFlag} from './flag/WavingFlag';

/** V1 = flag on a pole, V2 = full-frame fabric. */
const VERSIONS: {framing: Framing; suffix: string}[] = [
  {framing: 'pole', suffix: 'FlagPole'},
  {framing: 'closeup', suffix: 'FlagCloseup'},
];

/**
 * 30 countries x 2 versions = 60 compositions, generated from the data set.
 * Adding a country is a texture plus a data row — no code change here.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {COUNTRIES.flatMap((country) =>
      VERSIONS.map(({framing, suffix}) => (
        <Composition
          key={`${country.slug}-${suffix}`}
          id={`${country.slug}-${suffix}`}
          component={WavingFlag}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={COMP_WIDTH}
          height={COMP_HEIGHT}
          defaultProps={{countryCode: country.code, framing, shutterOffset: 0}}
        />
      )),
    )}
  </>
);
