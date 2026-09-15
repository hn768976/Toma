import React from 'react';
import {useCurrentFrame} from 'remotion';
import {
  BLUR,
  BOTTOM_ROW,
  GREY_BAR,
  GREY_TAB,
  HR_NUMBER,
  LEFT_MARKS,
  SUB_MARKS,
  SUB_NUMBER,
} from '../constants';
import {MONITOR_FONT} from '../load-fonts';
import {heartRate, subReadout} from '../readings';
import type {Theme} from '../theme';

/** Digits are lit pixels: a soft same-colour halo sells the emissive look. */
const glow = (color: string, spread: number) =>
  `0 0 ${spread * 0.45}px ${color}, 0 0 ${spread}px ${color}`;

const Digits: React.FC<{
  text: string;
  x: number;
  baselineY: number;
  fontSize: number;
  scaleX: number;
  color: string;
  blurPx: number;
  opacity?: number;
}> = ({text, x, baselineY, fontSize, scaleX, color, blurPx, opacity = 1}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: baselineY,
      fontFamily: `${MONITOR_FONT}, sans-serif`,
      fontWeight: 700,
      fontSize,
      lineHeight: 1,
      color,
      opacity,
      transform: `translateY(-0.72em) scaleX(${scaleX})`,
      transformOrigin: 'left top',
      whiteSpace: 'pre',
      filter: `blur(${blurPx}px)`,
      textShadow: glow(color, fontSize * 0.05),
    }}
  >
    {text}
  </div>
);

const Block: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  blurPx: number;
  opacity?: number;
}> = ({x, y, w, h, color, blurPx, opacity = 1}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      background: color,
      opacity,
      filter: `blur(${blurPx}px)`,
      boxShadow: glow(color, w * 0.3),
    }}
  />
);

export const Readouts: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {LEFT_MARKS.map((m, i) => (
        <Block key={i} {...m} color={theme.accent} blurPx={BLUR.leftMarks} opacity={0.8} />
      ))}

      <Block {...GREY_TAB} color={theme.accent} blurPx={BLUR.greyBar} opacity={0.85} />
      <Block {...GREY_BAR} color={theme.grey} blurPx={BLUR.greyBar} opacity={0.85} />

      {SUB_MARKS.map((m, i) => (
        <Block key={i} {...m} color={theme.sub} blurPx={BLUR.subMarks} opacity={0.78} />
      ))}

      <Digits
        text={String(heartRate(frame))}
        {...HR_NUMBER}
        color={theme.hr}
        blurPx={BLUR.hrNumber}
      />

      <Digits
        text={subReadout(frame)}
        {...SUB_NUMBER}
        color={theme.sub}
        blurPx={BLUR.subNumber}
      />

      {/* Cropped row peeking in along the bottom edge, far out of focus. */}
      <Digits
        text="98.4"
        {...BOTTOM_ROW}
        color={theme.sub}
        blurPx={BLUR.bottomRow}
        opacity={0.7}
      />
    </div>
  );
};
