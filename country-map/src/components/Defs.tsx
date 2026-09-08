import React from 'react';
import type {MapStyle} from '../styles';
import {rampTable} from '../styles';

// The relief plate carries three data channels: R = shading (neutral 128),
// G = shoreline ink, B = land coverage. These filters turn that one image into
// coloured terrain and a hairline coast, differently per style version, without
// ever baking a second plate.
const Ramp: React.FC<{id: string; ramp: MapStyle['landRamp']}> = ({id, ramp}) => (
  <filter
    id={id}
    x="0%"
    y="0%"
    width="100%"
    height="100%"
    colorInterpolationFilters="sRGB"
  >
    {/* Shading into every colour channel, land coverage into alpha. */}
    <feColorMatrix
      type="matrix"
      values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 1 0 0"
    />
    <feComponentTransfer>
      <feFuncR type="table" tableValues={rampTable(ramp, 0)} />
      <feFuncG type="table" tableValues={rampTable(ramp, 1)} />
      <feFuncB type="table" tableValues={rampTable(ramp, 2)} />
    </feComponentTransfer>
  </filter>
);

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4));

export const Defs: React.FC<{
  style: MapStyle;
  subject: string;
  wipe: {cx: number; cy: number; r: number};
  shadowBlur: number;
  shadowOffset: number;
  nameShadowBlur: number;
  insets: {box: [number, number, number, number]}[];
}> = ({style, subject, wipe, shadowBlur, shadowOffset, nameShadowBlur, insets}) => {
  const [sr, sg, sb] = rgb(style.shore);
  return (
    <defs>
      <Ramp id="landRamp" ramp={style.landRamp} />
      <Ramp id="subjectRamp" ramp={style.subjectRamp} />

      {/* Flat shore colour, with the shoreline channel as its alpha. */}
      <filter
        id="shoreInk"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feColorMatrix
          type="matrix"
          values={`0 0 0 0 ${sr}  0 0 0 0 ${sg}  0 0 0 0 ${sb}  0 ${style.shoreStrength} 0 0 0`}
        />
      </filter>

      {/* Shadow only, with no copy of the shape in the output. The fill above it
          is deliberately not opaque so the relief reads through, and a
          feDropShadow on that would show its own shadow through the fill. */}
      <filter id="subjectShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation={shadowBlur} />
        <feOffset dx={shadowOffset * 0.55} dy={shadowOffset} result="cast" />
        <feFlood floodColor={style.subjectShadow} />
        <feComposite in2="cast" operator="in" />
      </filter>

      <filter id="typeShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow
          dx="0"
          dy={nameShadowBlur * 0.35}
          stdDeviation={nameShadowBlur}
          floodColor="rgba(0,0,0,0.4)"
        />
      </filter>

      <clipPath id="subjectClip">
        <path d={subject} />
      </clipPath>

      {insets.map((inset, i) => (
        <clipPath key={i} id={`insetClip${i}`}>
          <rect x={inset.box[0]} y={inset.box[1]} width={inset.box[2]} height={inset.box[3]} />
        </clipPath>
      ))}

      {/* The fill wipe: a soft-edged disc growing from the country's centre,
          clipped to the polygon so it reads as the shape filling in. */}
      <radialGradient
        id="wipeGradient"
        gradientUnits="userSpaceOnUse"
        cx={wipe.cx}
        cy={wipe.cy}
        r={Math.max(wipe.r, 0.001)}
      >
        <stop offset="0" stopColor="#fff" />
        <stop offset="0.72" stopColor="#fff" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
      <mask id="fillWipe" maskUnits="userSpaceOnUse">
        <rect x="0" y="0" width="100%" height="100%" fill="url(#wipeGradient)" />
      </mask>
    </defs>
  );
};
