/**
 * V1 / V2 — the news-desk regional map.
 *
 * Everything geometric arrives pre-projected in composition pixels from
 * scripts/build-assets.ts, so this component only animates. The push-in is a
 * single transform on the composed layer, which is what keeps the relief raster
 * and the vectors registered as it scales.
 */

import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {REGIONS, type RegionCode} from '../data';
import type {CityPoint} from '../regionTypes';
import {COMP_WIDTH, DURATION, MARKER, PUSH, TYPE, estimateTextWidth} from '../layout';
import {STYLES, type StyleKey} from '../styles';
import {FONT_FAMILY} from '../fonts';
import {Grain, Vignette} from './Grain';

export type CountryMapProps = {
  countryCode: RegionCode;
  style: StyleKey;
};

/** Every ease in this piece is a soft ease-out. Nothing bounces. */
const EASE_OUT = Easing.bezier(0.16, 0.7, 0.24, 1);
/** The push: moving from frame 0, decelerating to a standstill by the end. */
const EASE_PUSH = Easing.bezier(0.22, 0.55, 0.2, 1);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const CountryMap: React.FC<CountryMapProps> = ({countryCode, style}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const region = REGIONS[countryCode];
  const s = STYLES[style];
  /** 1 at 3840 wide. Everything baked is in composition pixels. */
  const k = width / COMP_WIDTH;

  // ── the push-in ──────────────────────────────────────────────────────────
  const push = interpolate(frame, [0, DURATION], [0, 1], {easing: EASE_PUSH, ...clamp});
  const scale = PUSH.from + (PUSH.to - PUSH.from) * push;
  const driftX = PUSH.driftX * width * push;
  const driftY = PUSH.driftY * height * push;

  // ── the fill wipe: a circle opening from the country's interior ──────────
  const wipe = interpolate(frame, [15, 45], [0, 1], {easing: EASE_OUT, ...clamp});
  const bb = region.subjectBBox;
  const wipeOrigin = region.title;
  const wipeRadius =
    Math.hypot(
      Math.max(Math.abs(bb.x - wipeOrigin.x), Math.abs(bb.x + bb.w - wipeOrigin.x)),
      Math.max(Math.abs(bb.y - wipeOrigin.y), Math.abs(bb.y + bb.h - wipeOrigin.y))
    ) * 1.02;

  // ── the country name ─────────────────────────────────────────────────────
  const titleIn = interpolate(frame, [90, 130], [0, 1], {easing: EASE_OUT, ...clamp});
  const titleScale = 0.955 + 0.045 * titleIn;
  const titleMax = region.titleMaxWidth;
  const titleNatural = TYPE.title * COMP_WIDTH;
  const titleWidth = estimateTextWidth(region.displayName, titleNatural, {
    caps: true,
    letterSpacing: TYPE.titleLetterSpacing,
  });
  const titleSize = titleWidth > titleMax ? (titleNatural * titleMax) / titleWidth : titleNatural;

  const capital = region.cities.find((c) => c.capital) ?? region.cities[0];
  const uid = `${countryCode}_${style}`;

  const citySize = TYPE.city * COMP_WIDTH;
  const neighbourSize = TYPE.neighbour * COMP_WIDTH;
  const marineSize = TYPE.marine * COMP_WIDTH;

  return (
    <AbsoluteFill style={{backgroundColor: s.water, fontFamily: FONT_FAMILY}}>
      <AbsoluteFill
        style={{
          transform: `translate(${driftX}px, ${driftY}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${COMP_WIDTH} ${COMP_WIDTH * (height / width)}`}
          style={{display: 'block'}}
        >
          <defs>
            <clipPath id={`land-${uid}`}>
              <path d={region.paths.land} />
            </clipPath>
            <clipPath id={`subject-${uid}`}>
              <path d={region.paths.subject} />
            </clipPath>
            <clipPath id={`wipe-${uid}`}>
              <circle cx={wipeOrigin.x} cy={wipeOrigin.y} r={wipeRadius * wipe} />
            </clipPath>
            <filter id={`lift-${uid}`} x="-8%" y="-8%" width="116%" height="116%">
              <feDropShadow
                dx="0"
                dy={7}
                stdDeviation={13}
                floodColor="#000000"
                floodOpacity={s.shadowOpacity * 0.55}
              />
            </filter>
            <filter id={`titleShadow-${uid}`} x="-20%" y="-30%" width="140%" height="180%">
              <feDropShadow
                dx="0"
                dy={6}
                stdDeviation={14}
                floodColor="#000000"
                floodOpacity={s.shadowOpacity}
              />
            </filter>
          </defs>

          {/* Water, then the pre-warped relief showing only through land. */}
          <rect x={0} y={0} width={COMP_WIDTH} height={2160} fill={s.water} />
          <g clipPath={`url(#land-${uid})`}>
            <image
              href={staticFile(region.relief.files[style])}
              x={0}
              y={0}
              width={COMP_WIDTH}
              height={2160}
              preserveAspectRatio="none"
            />
          </g>
          <path d={region.paths.lakes} fill={s.inlandWater} />
          <path
            d={region.paths.coast}
            fill="none"
            stroke={s.coast}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <path
            d={region.paths.borders}
            fill="none"
            stroke={s.borders}
            strokeWidth={2.2}
            strokeLinejoin="round"
            opacity={0.85}
          />

          {/* Neighbour names, in small grey caps. */}
          {region.neighbourLabels.map((n) => (
            <text
              key={n.name}
              x={n.x}
              y={n.y}
              fill={s.neighbourLabel}
              fontSize={neighbourSize}
              fontWeight={500}
              letterSpacing={neighbourSize * TYPE.neighbourLetterSpacing}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {n.name}
            </text>
          ))}

          {/* Named seas and gulfs, italic. */}
          {region.marineLabels.map((m) => (
            <text
              key={m.name}
              x={m.x}
              y={m.y}
              fill={s.marineLabel}
              fontSize={marineSize}
              fontStyle="italic"
              fontWeight={400}
              letterSpacing={marineSize * TYPE.marineLetterSpacing}
              textAnchor="middle"
              dominantBaseline="middle"
              opacity={0.9}
            >
              {m.name}
            </text>
          ))}

          {/* The subject country. */}
          <g clipPath={`url(#wipe-${uid})`}>
            <g filter={`url(#lift-${uid})`}>
              <path
                d={region.paths.subject}
                fill={s.subjectFill}
                stroke={s.subjectEdge}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </g>
            {/* Its own relief, multiplied back through the fill so the country
                reads as terrain rather than a flat sticker. */}
            <g clipPath={`url(#subject-${uid})`} style={{mixBlendMode: 'multiply'}} opacity={0.6}>
              <image
                href={staticFile(region.relief.files.shade)}
                x={0}
                y={0}
                width={COMP_WIDTH}
                height={2160}
                preserveAspectRatio="none"
              />
            </g>
          </g>

          {/* A neutral location ping over the capital. Once only. */}
          {capital ? <Ping x={capital.x} y={capital.y} frame={frame} /> : null}

          {/* City markers, staggered, each with its label just behind it. */}
          {region.cities.map((city, i) => (
            <City
              key={`${city.name}-${i}`}
              city={city}
              index={i}
              count={region.cities.length}
              frame={frame}
              style={style}
              fontSize={citySize}
            />
          ))}

          {/* The country name: the single dominant piece of type in frame. */}
          <g
            opacity={titleIn}
            transform={`translate(${region.title.x} ${region.title.y}) scale(${titleScale})`}
            filter={`url(#titleShadow-${uid})`}
          >
            <text
              x={0}
              y={0}
              fill={s.title}
              fontSize={titleSize}
              fontWeight={700}
              letterSpacing={titleSize * TYPE.titleLetterSpacing}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{textTransform: 'uppercase'}}
            >
              {region.displayName}
            </text>
          </g>
        </svg>
      </AbsoluteFill>

      <Vignette opacity={s.vignetteOpacity} />
      <Grain opacity={s.grainOpacity} scale={k} />
    </AbsoluteFill>
  );
};

/**
 * The location ping. Deliberately soft and circular, with no cross-hair, tick
 * marks or sweep — a place marker, not a targeting graphic.
 */
const Ping: React.FC<{x: number; y: number; frame: number}> = ({x, y, frame}) => {
  const rings = [0, 1, 2];
  const maxR = 0.052 * COMP_WIDTH;
  return (
    <g>
      {rings.map((i) => {
        const start = 30 + i * 13;
        const t = interpolate(frame, [start, start + 27], [0, 1], {
          easing: Easing.out(Easing.quad),
          ...clamp,
        });
        if (t <= 0 || t >= 1) return null;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={maxR * t}
            fill="none"
            stroke="#ffffff"
            strokeWidth={3.4 * (1 - t * 0.4)}
            opacity={0.62 * (1 - t) ** 1.4}
          />
        );
      })}
    </g>
  );
};

const City: React.FC<{
  city: CityPoint;
  index: number;
  count: number;
  frame: number;
  style: StyleKey;
  fontSize: number;
}> = ({city, index, count, frame, style, fontSize}) => {
  const s = STYLES[style];
  const start = 50 + (index * 90) / Math.max(1, count);
  const markerIn = interpolate(frame, [start, start + 11], [0, 1], {easing: EASE_OUT, ...clamp});
  const labelIn = interpolate(frame, [start + 6, start + 20], [0, 1], {easing: EASE_OUT, ...clamp});
  if (markerIn <= 0) return null;

  const r = (city.capital ? MARKER.capital : MARKER.city) * COMP_WIDTH;
  const gap = r + fontSize * 0.42;
  const dy = fontSize * 0.95;
  const POSITIONS = {
    r: {dx: gap, dy: 0, anchor: 'start' as const},
    l: {dx: -gap, dy: 0, anchor: 'end' as const},
    tr: {dx: gap * 0.5, dy: -dy, anchor: 'start' as const},
    br: {dx: gap * 0.5, dy, anchor: 'start' as const},
    tl: {dx: -gap * 0.5, dy: -dy, anchor: 'end' as const},
    bl: {dx: -gap * 0.5, dy, anchor: 'end' as const},
    t: {dx: 0, dy: -gap - fontSize * 0.4, anchor: 'middle' as const},
    b: {dx: 0, dy: gap + fontSize * 0.4, anchor: 'middle' as const},
  };
  const p = POSITIONS[city.side];
  const pos = {x: city.x + p.dx, y: city.y + p.dy, anchor: p.anchor};

  return (
    <g>
      <g transform={`translate(${city.x} ${city.y}) scale(${markerIn})`}>
        <circle
          cx={0}
          cy={0}
          r={r}
          fill={s.cityMarker}
          stroke={s.cityRing}
          strokeWidth={MARKER.ring * COMP_WIDTH}
        />
        {city.capital ? (
          <circle cx={0} cy={0} r={r * 0.42} fill={s.cityRing} opacity={0.85} />
        ) : null}
      </g>
      <text
        x={pos.x}
        y={pos.y}
        opacity={labelIn}
        fill={s.cityLabel}
        fontSize={fontSize}
        fontWeight={city.capital ? 700 : 500}
        textAnchor={pos.anchor}
        dominantBaseline="middle"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={fontSize * 0.17}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {city.name}
      </text>
    </g>
  );
};
