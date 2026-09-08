import React from 'react';
import {Composition} from 'remotion';
import {CountryMap} from './CountryMap';
import {GEO} from './data/geo';
import registry from './data/countries.json';
import {STYLES, type StyleName} from './styles';
import {DURATION} from './timing';

// Compositions are 4K; render 1080p previews with --scale=0.5.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;

const VERSIONS: {style: StyleName; prefix: string; suffix: string}[] = [
  {style: 'light', prefix: 'V1', suffix: 'MapLight'},
  {style: 'dark', prefix: 'V2', suffix: 'MapDark'},
];

const titleCase = (slug: string) =>
  slug
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

export const RemotionRoot: React.FC = () => (
  <>
    {Object.keys(registry).flatMap((slug) => {
      const geo = GEO[slug];
      if (!geo) return [];
      return VERSIONS.map(({style, prefix, suffix}) => (
        <Composition
          key={`${prefix}_${slug}`}
          id={`${prefix}-${titleCase(slug)}${suffix}`}
          component={CountryMap}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{geo, style: STYLES[style]}}
        />
      ));
    })}
  </>
);
