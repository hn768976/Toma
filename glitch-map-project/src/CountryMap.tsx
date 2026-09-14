import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {getTearBands} from './bands';
import type {Colourway} from './colourways';
import type {Country} from './countries';
import {buildCountryGeometry} from './geo';
import {hash} from './hash';
import {TIMING} from './timing';

/**
 * The country itself: the outline traces on, then the fill arrives as scanline
 * stripes that consolidate into a solid shape.
 *
 * The trace is driven by stroke-dashoffset against the path's exact measured
 * length, and the length is normalised away by the timing - every country
 * completes its trace between frames 60 and 170 no matter how long its
 * coastline is, so a complex one just traces faster.
 */

type Props = {
  readonly country: Country;
  readonly colourway: Colourway;
};

export const CountryMap: React.FC<Props> = ({country, colourway}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const geometry = useMemo(
    () => buildCountryGeometry(country, width, height),
    [country, width, height],
  );

  const uid = `${country.code}-${colourway.name}`;
  const {d, length, bounds} = geometry;

  const traceProgress = interpolate(frame, [TIMING.traceStart, TIMING.traceEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const drawn = traceProgress * length;

  const reveal = interpolate(frame, [TIMING.stripesStart, TIMING.stripesEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const coverage = interpolate(frame, [TIMING.solidStart, TIMING.solidEnd], [0.34, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const strokeWidth = Math.max(2, width * 0.0032);
  const pitch = Math.max(2, height * 0.0065);
  const tracing = frame >= TIMING.traceStart && frame <= TIMING.traceEnd + 4;

  // Tearing: strong bands drag the part of the map they cross sideways.
  const tears = getTearBands(frame)
    .filter((band) => {
      const y0 = band.y * height;
      const y1 = y0 + band.h * height;
      return y1 > bounds.y0 && y0 < bounds.y1;
    })
    .map((band) => {
      const centre = (band.y + band.h / 2) * height;
      const slab = Math.max(band.h * height, height * 0.012);
      return {
        key: band.seed,
        y: centre - slab / 2,
        h: slab,
        dx: band.shift * width * 3,
      };
    });

  // A one-frame horizontal kick on the whole map when the field is violent.
  const jitter = hash(frame, 61) > 0.9 ? (hash(frame, 62) - 0.5) * width * 0.006 : 0;

  const mapBody = (
    <g id={`map-${uid}`}>
      {/* Moderate bloom under the fill. */}
      <path
        d={d}
        fill={colourway.fill}
        fillRule="evenodd"
        fillOpacity={colourway.fillOpacity * 0.5}
        mask={`url(#fill-${uid})`}
        filter={`url(#soft-${uid})`}
      />
      <path
        d={d}
        fill={colourway.fill}
        fillRule="evenodd"
        fillOpacity={colourway.fillOpacity}
        mask={`url(#fill-${uid})`}
      />
      {/* Strong bloom under the outline; the crisp stroke goes on top of it
          unfiltered, so the one element that has to survive the noise does. */}
      <path
        d={d}
        fill="none"
        stroke={colourway.outline}
        strokeWidth={strokeWidth * 2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.55}
        filter={`url(#bloom-${uid})`}
        strokeDasharray={`${drawn} ${length + 1}`}
      />
      <path
        d={d}
        fill="none"
        stroke={colourway.outline}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={`${drawn} ${length + 1}`}
      />
      {/* The leading point: brighter, with a short trail behind it. */}
      {tracing
        ? ([
            [0.03, 0.35, 1.6],
            [0.012, 0.7, 1.25],
            [0.004, 1, 1],
          ] as const).map(([trailFraction, opacity, widthScale], i) => {
            const trail = length * trailFraction;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={colourway.traceHead}
                strokeWidth={strokeWidth * widthScale}
                strokeLinecap="round"
                opacity={opacity}
                strokeDasharray={`${trail} ${length}`}
                strokeDashoffset={trail - drawn}
                filter={i === 0 ? `url(#bloom-${uid})` : undefined}
              />
            );
          })
        : null}
    </g>
  );

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id={`bloom-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={strokeWidth * 1.6} />
          </filter>
          <filter id={`soft-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={strokeWidth * 1.1} />
          </filter>

          {/* Horizontal bands. Their coverage animates from thin stripes with
              visible gaps to a continuous fill. */}
          <pattern
            id={`stripes-${uid}`}
            x={0}
            y={0}
            width={pitch}
            height={pitch}
            patternUnits="userSpaceOnUse"
          >
            <rect x={0} y={0} width={pitch} height={pitch * coverage} fill="#fff" />
          </pattern>
          {/* Bottom to top reveal, with a soft leading edge. */}
          <linearGradient
            id={`reveal-${uid}`}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={bounds.y1}
            x2={0}
            y2={bounds.y0}
          >
            <stop offset={0} stopColor="#fff" />
            <stop offset={Math.max(0, reveal - 0.001)} stopColor="#fff" />
            <stop offset={Math.min(1, reveal + 0.07)} stopColor="#000" />
            <stop offset={1} stopColor="#000" />
          </linearGradient>
          <mask id={`stripeMask-${uid}`} maskUnits="userSpaceOnUse">
            <rect x={0} y={0} width={width} height={height} fill={`url(#stripes-${uid})`} />
          </mask>
          <mask id={`fill-${uid}`} maskUnits="userSpaceOnUse">
            <g mask={`url(#stripeMask-${uid})`}>
              <rect x={0} y={0} width={width} height={height} fill={`url(#reveal-${uid})`} />
            </g>
          </mask>

          {/* Everything except the torn slabs, so a slab is not drawn twice. */}
          <mask id={`tear-${uid}`} maskUnits="userSpaceOnUse">
            <rect x={0} y={0} width={width} height={height} fill="#fff" />
            {tears.map((tear) => (
              <rect key={tear.key} x={0} y={tear.y} width={width} height={tear.h} fill="#000" />
            ))}
          </mask>
          {tears.map((tear) => (
            <clipPath key={tear.key} id={`slab-${uid}-${tear.key}`} clipPathUnits="userSpaceOnUse">
              <rect x={0} y={tear.y} width={width} height={tear.h} />
            </clipPath>
          ))}

          {mapBody}
        </defs>

        <g transform={`translate(${jitter} 0)`}>
          <g mask={`url(#tear-${uid})`}>
            <use href={`#map-${uid}`} />
          </g>
          {tears.map((tear) => (
            <g
              key={tear.key}
              clipPath={`url(#slab-${uid}-${tear.key})`}
              transform={`translate(${tear.dx} 0)`}
            >
              <use href={`#map-${uid}`} />
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
