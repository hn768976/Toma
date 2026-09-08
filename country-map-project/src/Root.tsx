import React from 'react';
import {Composition} from 'remotion';

import {COUNTRIES, type CountryConfig} from './countries';
import {hasRegion, REGIONS, type RegionCode} from './data';
import {COMP_HEIGHT, COMP_WIDTH, DURATION, FPS} from './layout';
import {CountryMap} from './components/CountryMap';
import {SatelliteZoom} from './components/SatelliteZoom';
import {loadFonts} from './fonts';

loadFonts();

/**
 * "South Korea" -> "SouthKorea". Remotion composition ids may not contain
 * underscores, so ids are hyphenated (V1-BrazilMapLight) while the delivered
 * files keep the underscored name (V1_BrazilMapLight.mp4).
 */
const slugify = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');

const SIZE = {
  durationInFrames: DURATION,
  fps: FPS,
  width: COMP_WIDTH,
  height: COMP_HEIGHT,
};

/**
 * Compositions are generated from src/countries.ts. Adding a country to that
 * file and rebuilding its assets is all it takes for four new compositions to
 * appear here — there is nothing to register by hand.
 */
const compositionsFor = (c: CountryConfig) => {
  if (!hasRegion(c.code)) return null;
  const code = c.code as RegionCode;
  const slug = slugify(REGIONS[code].name ?? c.code);
  const v3 = c.v3 && REGIONS[code].v3 ? c.v3 : null;
  return (
    <React.Fragment key={c.code}>
      <Composition
        id={`V1-${slug}MapLight`}
        component={CountryMap}
        defaultProps={{countryCode: code, style: 'v1' as const}}
        durationInFrames={SIZE.durationInFrames}
        fps={SIZE.fps}
        width={SIZE.width}
        height={SIZE.height}
      />
      <Composition
        id={`V2-${slug}MapDark`}
        component={CountryMap}
        defaultProps={{countryCode: code, style: 'v2' as const}}
        durationInFrames={SIZE.durationInFrames}
        fps={SIZE.fps}
        width={SIZE.width}
        height={SIZE.height}
      />
      {v3 ? (
        <Composition
          id={`V3-${slug}SatelliteZoomWhite`}
          component={SatelliteZoom}
          defaultProps={{countryCode: code, fill: 'white' as const}}
          durationInFrames={SIZE.durationInFrames}
          fps={SIZE.fps}
          width={SIZE.width}
          height={SIZE.height}
        />
      ) : null}
      {v3 && v3.flagFill && REGIONS[code].v3?.flag ? (
        <Composition
          id={`V3-${slug}SatelliteZoomFlag`}
          component={SatelliteZoom}
          defaultProps={{countryCode: code, fill: 'flag' as const}}
          durationInFrames={SIZE.durationInFrames}
          fps={SIZE.fps}
          width={SIZE.width}
          height={SIZE.height}
        />
      ) : null}
    </React.Fragment>
  );
};

export const RemotionRoot: React.FC = () => <>{COUNTRIES.map(compositionsFor)}</>;
