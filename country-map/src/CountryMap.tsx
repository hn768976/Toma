import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Defs} from './components/Defs';
import {Grain} from './components/Grain';
import {CITIES, NAME, PING, PUSH, FILL_WIPE} from './timing';
import {FONT_CSS, SANS, displayFamily} from './fonts';
import type {CountryGeo} from './data/types';
import type {MapStyle} from './styles';
import {useImageReady} from './useImage';

// A soft ease-out is the only shape used anywhere in this piece. Nothing
// bounces; nothing eases in.
const OUT = Easing.bezier(0.22, 0.61, 0.28, 1);
const PUSH_EASE = Easing.bezier(0.32, 0.4, 0.22, 1);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const CountryMap: React.FC<{geo: CountryGeo; style: MapStyle}> = ({
  geo,
  style,
}) => {
  const frame = useCurrentFrame();
  const {width: W, height: H, durationInFrames} = useVideoConfig();

  const plate = staticFile(`relief/${geo.slug}.png`);
  const ready = useImageReady(plate);

  // ---------------------------------------------------------------- push in
  const scale = interpolate(frame, [0, durationInFrames], [1, PUSH.scale], {
    ...clamp,
    easing: PUSH_EASE,
  });
  // Drift toward the capital, bounded by how much of the frame the current
  // scale actually hides, so an edge can never swing into view.
  const room = (1 - 1 / scale) * PUSH.drift;
  const toCapital = [geo.capital.x - W / 2, geo.capital.y - H / 2];
  const reach = Math.hypot(toCapital[0], toCapital[1]) || 1;
  const driftX = (-toCapital[0] / reach) * room * (W / 2);
  const driftY = (-toCapital[1] / reach) * room * (H / 2);

  // ------------------------------------------------------------- fill wipe
  const [bx0, by0, bx1, by1] = geo.subjectBox;
  const wipeCx = (bx0 + bx1) / 2;
  const wipeCy = (by0 + by1) / 2;
  const wipeMax = Math.hypot(bx1 - bx0, by1 - by0) / 2 + 0.02 * W;
  const wipeR = interpolate(frame, [FILL_WIPE.from, FILL_WIPE.to], [0, wipeMax], {
    ...clamp,
    easing: OUT,
  });

  // ------------------------------------------------------------------ type
  const cityType = 0.0106 * W;
  const gap = 0.0068 * W;
  const markerR = 0.0024 * W;
  const capitalR = 0.0037 * W;
  // Sized in the bake, so the box reserved there for city labels to route
  // around is exactly the box the name occupies here.
  const nameType = geo.nameSize;

  const nameIn = interpolate(frame, [NAME.from, NAME.to], [0, 1], {
    ...clamp,
    easing: OUT,
  });

  const pingMax = 0.07 * W;

  return (
    <AbsoluteFill style={{backgroundColor: style.water}}>
      <style>{FONT_CSS}</style>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${driftX}px, ${driftY}px)`,
          transformOrigin: 'center center',
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          style={{display: 'block'}}
        >
          <Defs
            style={style}
            subject={geo.subject}
            wipe={{cx: wipeCx, cy: wipeCy, r: wipeR}}
            shadowBlur={0.005 * W}
            shadowOffset={0.0035 * W}
            nameShadowBlur={nameType * 0.09}
            insets={geo.insets ?? []}
          />

          <rect x="0" y="0" width={W} height={H} fill={style.water} />

          {ready ? (
            <>
              <image
                href={plate}
                x="0"
                y="0"
                width={W}
                height={H}
                filter="url(#landRamp)"
                preserveAspectRatio="none"
              />
              <image
                href={plate}
                x="0"
                y="0"
                width={W}
                height={H}
                filter="url(#shoreInk)"
                preserveAspectRatio="none"
              />
            </>
          ) : null}

          <path
            d={geo.lakes}
            fill={style.water}
            stroke={style.shore}
            strokeWidth={0.0005 * W}
          />
          <path
            d={geo.borders}
            fill="none"
            stroke={style.border}
            strokeWidth={0.00055 * W}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Subject country: fill, its own relief showing through, edge. */}
          <g mask="url(#fillWipe)">
            <path d={geo.subject} fill="#000" filter="url(#subjectShadow)" />
            <path
              d={geo.subject}
              fill={style.subjectFill}
              fillOpacity={style.subjectFillOpacity}
            />
            {ready ? (
              <g clipPath="url(#subjectClip)" opacity={style.subjectReliefOpacity}>
                <image
                  href={plate}
                  x="0"
                  y="0"
                  width={W}
                  height={H}
                  filter="url(#subjectRamp)"
                  preserveAspectRatio="none"
                />
              </g>
            ) : null}
            <path
              d={geo.subject}
              fill="none"
              stroke={style.subjectEdge}
              strokeWidth={0.0011 * W}
              strokeLinejoin="round"
            />
          </g>

          {/* Seas and neighbours: context type, never competing with the name. */}
          {geo.seas.map((sea) => (
            <text
              key={sea.name}
              x={sea.x}
              y={sea.y}
              fill={style.seaLabel}
              fontFamily={SANS}
              fontSize={0.0084 * W}
              fontStyle="italic"
              fontWeight={400}
              letterSpacing={0.08 * 0.0084 * W}
              textAnchor="middle"
            >
              {sea.name}
            </text>
          ))}
          {geo.neighbours.map((n) => (
            <text
              key={n.name}
              x={n.x}
              y={n.y}
              fill={style.neighbourLabel}
              fontFamily={SANS}
              fontSize={0.008 * W}
              fontWeight={500}
              letterSpacing={0.16 * 0.008 * W}
              textAnchor="middle"
            >
              {n.name}
            </text>
          ))}

          <Ping x={geo.capital.x} y={geo.capital.y} max={pingMax} style={style} />

          {geo.cities.map((city, i) => (
            <CityMarker
              key={city.name}
              city={city}
              index={i}
              count={geo.cities.length}
              style={style}
              r={city.capital ? capitalR : markerR}
              ring={0.0009 * W}
              gap={gap}
              type={cityType}
            />
          ))}

          <g
            opacity={nameIn}
            transform={`translate(${geo.nameAt.x} ${geo.nameAt.y}) scale(${
              0.955 + 0.045 * nameIn
            })`}
            filter="url(#typeShadow)"
          >
            <text
              x="0"
              y="0"
              fill="#ffffff"
              fontFamily={displayFamily(geo.name)}
              fontSize={nameType}
              fontWeight={700}
              letterSpacing={0.06 * nameType}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {geo.name}
            </text>
          </g>
        </svg>
      </AbsoluteFill>

      {/* Territory insets sit outside the push-in: a corner inset is a fixed
          piece of furniture on the frame, not part of the map being pushed
          into, and scaling it would crop it against the frame edge. */}
      {(geo.insets ?? []).length ? (
        <AbsoluteFill>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height="100%"
            style={{display: 'block'}}
          >
          {(geo.insets ?? []).map((inset, i) => (
            <TerritoryInset
              key={i}
              inset={inset}
              style={style}
              index={i}
              ready={ready}
              opacity={interpolate(
                frame,
                [FILL_WIPE.from + 6, FILL_WIPE.to + 6],
                [0, 1],
                {...clamp, easing: OUT},
              )}
              type={0.0078 * W}
              stroke={0.0009 * W}
            />
          ))}

          </svg>
        </AbsoluteFill>
      ) : null}

      <Grain opacity={style.grain} />
      {style.vignette > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,${style.vignette}) 100%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const TerritoryInset: React.FC<{
  inset: NonNullable<CountryGeo['insets']>[number];
  style: MapStyle;
  index: number;
  ready: boolean;
  opacity: number;
  type: number;
  stroke: number;
}> = ({inset, style, index, ready, opacity, type, stroke}) => {
  const [bx, by, bw, bh] = inset.box;
  const [ix, iy, iw, ih] = inset.image;
  const plate = staticFile(inset.plate);
  return (
    <g opacity={opacity}>
      <rect x={bx} y={by} width={bw} height={bh} fill={style.water} />
      <g clipPath={`url(#insetClip${index})`}>
        {ready ? (
          <>
            <image href={plate} x={ix} y={iy} width={iw} height={ih} filter="url(#landRamp)" />
            <image href={plate} x={ix} y={iy} width={iw} height={ih} filter="url(#shoreInk)" />
          </>
        ) : null}
        <path d={inset.borders} fill="none" stroke={style.border} strokeWidth={stroke} />
        <path
          d={inset.subject}
          fill={style.subjectFill}
          fillOpacity={style.subjectFillOpacity}
        />
        <path
          d={inset.subject}
          fill="none"
          stroke={style.subjectEdge}
          strokeWidth={stroke * 1.2}
          strokeLinejoin="round"
        />
      </g>
      <rect
        x={bx}
        y={by}
        width={bw}
        height={bh}
        fill="none"
        stroke={style.insetBorder}
        strokeWidth={stroke * 1.4}
      />
      {inset.label ? (
        <text
          x={bx + bw / 2}
          y={by + bh - type * 0.55}
          fill={style.neighbourLabel}
          fontFamily={SANS}
          fontSize={type}
          fontWeight={500}
          letterSpacing={0.16 * type}
          textAnchor="middle"
        >
          {inset.label}
        </text>
      ) : null}
    </g>
  );
};

// A neutral location ping: thin concentric circles, once, no reticle.
const Ping: React.FC<{x: number; y: number; max: number; style: MapStyle}> = ({
  x,
  y,
  max,
  style,
}) => {
  const frame = useCurrentFrame();
  const life = 26;
  return (
    <g fill="none" stroke={style.ping}>
      {Array.from({length: PING.rings}, (_, i) => {
        const start = PING.from + i * PING.ringStagger;
        const t = interpolate(frame, [start, start + life], [0, 1], {
          ...clamp,
          easing: OUT,
        });
        if (t <= 0 || t >= 1) return null;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={t * max}
            strokeWidth={max * 0.014}
            opacity={(1 - t) * 0.55}
          />
        );
      })}
    </g>
  );
};

const CityMarker: React.FC<{
  city: CountryGeo['cities'][number];
  index: number;
  count: number;
  style: MapStyle;
  r: number;
  ring: number;
  gap: number;
  type: number;
}> = ({city, index, count, style, r, ring, gap, type}) => {
  const frame = useCurrentFrame();
  const span =
    CITIES.to - CITIES.from - CITIES.markerRise - CITIES.labelDelay - CITIES.labelFade;
  const start = CITIES.from + (count > 1 ? (span * index) / (count - 1) : 0);

  const rise = interpolate(frame, [start, start + CITIES.markerRise], [0, 1], {
    ...clamp,
    easing: OUT,
  });
  const labelFrom = start + CITIES.labelDelay;
  const label = interpolate(
    frame,
    [labelFrom, labelFrom + CITIES.labelFade],
    [0, 1],
    {...clamp, easing: OUT},
  );

  // A label pushed out to clear space keeps a leader line back to its marker.
  const from = city.leader ?? city;
  const offset = r + gap;
  const anchors = {
    right: {x: from.x + offset, y: from.y, anchor: 'start', baseline: 'central'},
    left: {x: from.x - offset, y: from.y, anchor: 'end', baseline: 'central'},
    above: {x: from.x, y: from.y - offset, anchor: 'middle', baseline: 'auto'},
    below: {x: from.x, y: from.y + offset, anchor: 'middle', baseline: 'hanging'},
  } as const;
  const at = anchors[city.anchor] ?? anchors.right;

  return (
    <g>
      {city.leader ? (
        <line
          x1={city.x}
          y1={city.y}
          x2={city.leader.x}
          y2={city.leader.y}
          stroke={style.markerFill}
          strokeWidth={ring * 0.9}
          opacity={label * 0.75}
          strokeLinecap="round"
        />
      ) : null}
      <circle
        cx={city.x}
        cy={city.y}
        r={r * rise}
        fill={style.markerFill}
        stroke={style.markerRing}
        strokeWidth={ring * rise}
      />
      {city.capital ? (
        <circle
          cx={city.x}
          cy={city.y}
          r={r * 1.75 * rise}
          fill="none"
          stroke={style.markerRing}
          strokeWidth={ring * 0.8 * rise}
          opacity={0.55 * rise}
        />
      ) : null}
      <text
        x={at.x}
        y={at.y}
        opacity={label}
        fill={style.label}
        stroke={style.labelHalo}
        strokeWidth={type * 0.16}
        paintOrder="stroke"
        strokeLinejoin="round"
        fontFamily={SANS}
        fontSize={type}
        fontWeight={500}
        textAnchor={at.anchor}
        dominantBaseline={at.baseline}
      >
        {city.name}
      </text>
    </g>
  );
};
