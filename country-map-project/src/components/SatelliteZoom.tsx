/**
 * V3 — the satellite zoom.
 *
 * One continuous move from a whole-world view down to the country. Everything
 * lives on a single equirectangular "plane" whose transform is the entire clip;
 * the base imagery is unprojected equirectangular, so the plane and the raster
 * are the same coordinate system and the country outline lands exactly on the
 * terrain beneath it.
 */

import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {REGIONS, type RegionCode} from '../data';
import {COMP_WIDTH, DURATION, HALO, TYPE, WEIGHT} from '../layout';
import {SATELLITE_STYLE} from '../styles';
import {FONT_FAMILY, titleFontFamily} from '../fonts';
import {Grain} from './Grain';

export type SatelliteFill = 'white' | 'flag';

export type SatelliteZoomProps = {
  countryCode: RegionCode;
  fill: SatelliteFill;
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
/** Starts and ends gently, fastest through the middle. */
const EASE_ZOOM = Easing.bezier(0.45, 0, 0.55, 1);
const EASE_OUT = Easing.bezier(0.16, 0.7, 0.24, 1);

export const SatelliteZoom: React.FC<SatelliteZoomProps> = ({countryCode, fill}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const region = REGIONS[countryCode];
  const v = region.v3;
  if (!v) {
    throw new Error(`${countryCode} is not configured for V3 — see src/countries.ts`);
  }

  const k = width / COMP_WIDTH;
  const compHeight = COMP_WIDTH * (height / width);

  // The zoom. Scale is interpolated geometrically so the apparent rate of
  // approach is constant, and it is never quantised.
  const t = interpolate(frame, [0, DURATION], [0, 1], {easing: EASE_ZOOM, ...clamp});
  const scale = v.openScale * (v.endScale / v.openScale) ** t;
  // Equirectangular over-stretches longitude away from the equator. Easing an
  // x-squeeze in with the zoom means the opening frame is a true world view and
  // the closing frame has locally correct proportions.
  const kx = 1 + (v.kx - 1) * t ** 1.35;
  const cx = v.openCenter[0] + (v.endCenter[0] - v.openCenter[0]) * t;
  const cy = v.openCenter[1] + (v.endCenter[1] - v.openCenter[1]) * t;

  // The close-up crop takes over from the world layer once it covers the frame.
  const cropIn = interpolate(t, [v.cropFadeEnd - 0.2, v.cropFadeEnd], [0, 1], {
    easing: EASE_OUT,
    ...clamp,
  });

  // The highlight arrives once the country is big enough to read.
  const outlineDraw = interpolate(t, [0.5, 0.74], [0, 1], {easing: EASE_OUT, ...clamp});
  const fillIn = interpolate(t, [0.68, 0.86], [0, 1], {easing: EASE_OUT, ...clamp});
  const titleIn = interpolate(t, [0.84, 0.97], [0, 1], {easing: EASE_OUT, ...clamp});

  const planeH = v.planeWidth / 2;
  const uid = `${countryCode}_${fill}`;

  // Type is sized in screen pixels, so it holds a constant size as the plane
  // zooms. The text is drawn inside the plane but un-squeezed by 1/kx below, so
  // its net scale is `scale` in both axes — divide once by that.
  const titleOnScreen = TYPE.satelliteTitle * COMP_WIDTH;
  const titleSize = titleOnScreen / scale;
  const titleStroke = (titleOnScreen * HALO.satellite) / scale;

  const worldTiles = [-1, 0, 1];

  return (
    <AbsoluteFill style={{backgroundColor: SATELLITE_STYLE.ocean, fontFamily: FONT_FAMILY}}>
      <AbsoluteFill
        style={{
          transformOrigin: '0 0',
          transform:
            `translate(${(COMP_WIDTH / 2) * k}px, ${(compHeight / 2) * k}px) ` +
            `scale(${scale * kx * k}, ${scale * k}) ` +
            `translate(${-cx}px, ${-cy}px)`,
          width: v.planeWidth,
          height: planeH,
        }}
      >
        {/* The world, drawn three times so the plane can centre on any meridian. */}
        {worldTiles.map((i) => (
          <Img
            key={i}
            src={staticFile(v.world.file)}
            style={{
              position: 'absolute',
              left: v.world.x + i * v.planeWidth,
              top: v.world.y,
              width: v.world.w,
              height: v.world.h,
            }}
          />
        ))}

        {/* The close-up crop, in the same coordinate system, fading in as the
            world layer runs out of resolution. */}
        {v.crop ? (
          <Img
            src={staticFile(v.crop.file)}
            style={{
              position: 'absolute',
              left: v.crop.x,
              top: v.crop.y,
              width: v.crop.w,
              height: v.crop.h,
              opacity: cropIn,
            }}
          />
        ) : null}

        <svg
          width={v.planeWidth}
          height={planeH}
          viewBox={`0 0 ${v.planeWidth} ${planeH}`}
          style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}
        >
          <defs>
            <clipPath id={`sat-${uid}`}>
              <path d={v.subjectPath} />
            </clipPath>
            {/* A tight offset only — the halo on the glyphs does the work. */}
            <filter id={`satTitle-${uid}`} x="-10%" y="-15%" width="120%" height="140%">
              <feDropShadow
                dx="0"
                dy={(titleOnScreen * 0.03) / scale}
                stdDeviation={(titleOnScreen * 0.03) / scale}
                floodColor="#000000"
                floodOpacity={0.5}
              />
            </filter>
          </defs>

          {fill === 'flag' && v.flag ? (
            <g clipPath={`url(#sat-${uid})`} opacity={SATELLITE_STYLE.flagFillOpacity * fillIn}>
              {/* A nested <svg> keeps the flag's own viewport, so its artwork is
                  scaled to cover the silhouette at its published ratio and
                  cropped by it — never stretched to the bounding box. */}
              <svg
                x={v.flag.rect.x}
                y={v.flag.rect.y}
                width={v.flag.rect.w}
                height={v.flag.rect.h}
                viewBox={v.flag.viewBox.join(' ')}
                dangerouslySetInnerHTML={{__html: v.flag.inner}}
              />
            </g>
          ) : (
            <path
              d={v.subjectPath}
              fill="#ffffff"
              opacity={SATELLITE_STYLE.whiteFillOpacity * fillIn}
              stroke="none"
            />
          )}

          {/* The outline draws around the polygon, then stays on top. A dark
              outer edge under the white keeps it readable against both snow and
              dark ocean. */}
          <path
            d={v.subjectPath}
            fill="none"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={11 / scale}
            strokeLinejoin="round"
            pathLength={1000}
            strokeDasharray={1000}
            strokeDashoffset={1000 * (1 - outlineDraw)}
          />
          <path
            d={v.subjectPath}
            fill="none"
            stroke={SATELLITE_STYLE.outline}
            strokeWidth={6.5 / scale}
            strokeLinejoin="round"
            pathLength={1000}
            strokeDasharray={1000}
            strokeDashoffset={1000 * (1 - outlineDraw)}
            opacity={0.96}
          />

          <text
            x={v.title.x}
            y={v.title.y}
            fill={SATELLITE_STYLE.title}
            fontFamily={titleFontFamily(region.titleFace)}
            fontSize={titleSize}
            fontWeight={WEIGHT.satelliteTitle}
            letterSpacing={titleSize * TYPE.satelliteLetterSpacing}
            textAnchor="middle"
            dominantBaseline="middle"
            opacity={titleIn}
            transform={`translate(${v.title.x} ${v.title.y}) scale(${1 / kx} 1) translate(${-v.title.x} ${-v.title.y})`}
            filter={`url(#satTitle-${uid})`}
            stroke={`rgba(0,0,0,${HALO.satelliteOpacity})`}
            strokeWidth={titleStroke}
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{textTransform: 'uppercase'}}
          >
            {region.displayName}
          </text>
        </svg>
      </AbsoluteFill>

      <Grain opacity={SATELLITE_STYLE.grainOpacity} scale={k} />
    </AbsoluteFill>
  );
};
