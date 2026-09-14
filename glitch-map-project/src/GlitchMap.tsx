import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import type {ColourwayName} from './colourways';
import {COLOURWAYS} from './colourways';
import type {Country} from './countries';
import {COUNTRIES} from './countries';
import {CountryMap} from './CountryMap';
import {GlitchField} from './GlitchField';
import {LoadingRing} from './LoadingRing';

/**
 * One clip. The animation is identical for every country - only the polygon
 * changes - so this is the whole template: give it a country code and a
 * colourway and it builds the clip.
 */

export type GlitchMapProps = {
  readonly countryCode: string;
  readonly colourway: ColourwayName;
};

const findCountry = (code: string): Country => {
  const country = COUNTRIES.find((c) => c.code === code);
  if (!country) throw new Error(`Unknown country code: ${code}`);
  return country;
};

export const GlitchMap: React.FC<GlitchMapProps> = ({countryCode, colourway: colourwayName}) => {
  const country = findCountry(countryCode);
  const colourway = COLOURWAYS[colourwayName];
  const {height} = useVideoConfig();
  const scanlinePitch = Math.max(2, Math.round(height / 540));

  return (
    <AbsoluteFill style={{backgroundColor: colourway.background}}>
      <GlitchField colourway={colourway} layer="under" />
      <CountryMap country={country} colourway={colourway} />
      <GlitchField colourway={colourway} layer="over" />
      <LoadingRing colourway={colourway} />

      {/* Scanlines across the whole frame. */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.9) ${
            scanlinePitch / 2
          }px, rgba(0,0,0,0) ${scanlinePitch / 2}px, rgba(0,0,0,0) ${scanlinePitch}px)`,
          opacity: 0.06,
        }}
      />

      {/* Vignette, fairly strong. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(ellipse 72% 68% at 50% 48%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 74%, rgba(0,0,0,0.92) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
