import React from 'react';
import {Composition} from 'remotion';
import type {ColourwayName} from './colourways';
import {COUNTRIES} from './countries';
import {GlitchMap} from './GlitchMap';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './timing';

/**
 * 23 countries x 2 colourways = 46 compositions, generated straight from the
 * country data. Adding a country is a data row in src/countries.ts - there is
 * no code to change here.
 */

export const slugify = (name: string): string => name.replace(/[^A-Za-z0-9]/g, '');

const COLOURWAY_NAMES: ColourwayName[] = ['green', 'blue'];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {COUNTRIES.map((country) =>
        COLOURWAY_NAMES.map((colourway) => {
          const suffix = colourway === 'green' ? 'Green' : 'Blue';
          return (
            <Composition
              key={`${country.code}-${colourway}`}
              id={`${slugify(country.name)}-GlitchMap${suffix}`}
              component={GlitchMap}
              durationInFrames={DURATION_IN_FRAMES}
              fps={FPS}
              width={WIDTH}
              height={HEIGHT}
              defaultProps={{countryCode: country.code, colourway}}
            />
          );
        }),
      )}
    </>
  );
};
