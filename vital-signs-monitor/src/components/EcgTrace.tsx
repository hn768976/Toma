import React from 'react';
import {useCurrentFrame} from 'remotion';
import {
  AGE_FADE,
  BLUR,
  DESIGN_H,
  DESIGN_W,
  ERASER_PX,
  FOCUS_K,
  FOCUS_X,
  SWEEP_FRAMES,
  SWEEP_SPEED,
  TRACE_W,
  TRACE_X0,
  TRACE_X1,
} from '../constants';
import {tracePath} from '../ecg';
import type {Theme} from '../theme';

/** Wraps line up with the reference clip, aligned so frame 0 matches the reference. */
const WRAP_OFFSET = 132;

const blurAt = (x: number) =>
  Math.min(
    x < FOCUS_X ? BLUR.traceLeft : BLUR.traceRight,
    Math.abs(x - FOCUS_X) * FOCUS_K + BLUR.traceCenter,
  );

const BANDS = 5;
const BAND_W = TRACE_W / BANDS;

/** Soft-edged vertical slice so neighbouring blur bands cross-fade. */
const bandMask = (i: number) => {
  const a = TRACE_X0 + i * BAND_W;
  const b = a + BAND_W;
  const feather = BAND_W * 0.55;
  const pct = (v: number) => `${((v / DESIGN_W) * 100).toFixed(3)}%`;
  return (
    `linear-gradient(to right, transparent ${pct(a - feather)}, ` +
    `#000 ${pct(a)}, #000 ${pct(b)}, transparent ${pct(b + feather)})`
  );
};

/**
 * One drawn run of trace. Opacity ramps with age, so the stretch about to be
 * wiped by the eraser sits slightly dimmer than the freshly drawn head.
 */
type Segment = {x0: number; x1: number; age0: number; age1: number};

const opacityForAge = (age: number) => 1 - AGE_FADE * (age / SWEEP_FRAMES);

export const EcgTrace: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();

  const phase = ((frame - WRAP_OFFSET) % SWEEP_FRAMES + SWEEP_FRAMES) % SWEEP_FRAMES;
  const cursorX = TRACE_X0 + phase * SWEEP_SPEED;
  const gapEnd = cursorX + ERASER_PX;

  // Age of the trace at x, in frames since the cursor last drew it.
  const ageAt = (x: number) =>
    (x <= cursorX ? cursorX - x : cursorX - x + TRACE_W) / SWEEP_SPEED;

  const segments: Segment[] = [];
  const push = (x0: number, x1: number) => {
    if (x1 - x0 > 0.5) segments.push({x0, x1, age0: ageAt(x0), age1: ageAt(x1)});
  };

  if (gapEnd <= TRACE_X1) {
    push(TRACE_X0, cursorX);
    push(gapEnd, TRACE_X1);
  } else {
    // The eraser has run off the right edge and wrapped back to the left.
    push(gapEnd - TRACE_W, cursorX);
  }

  const layer = (blurPx: number, core: boolean, key: string) => (
    <svg
      width={DESIGN_W}
      height={DESIGN_H}
      viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
      style={{position: 'absolute', inset: 0, filter: `blur(${blurPx}px)`}}
    >
      <defs>
        {segments.map((s, i) => {
          const id = `${key}-${i}`;
          const c = core ? theme.traceCore : theme.trace;
          const base = core ? 1 : 0.8;
          return (
            <linearGradient
              key={id}
              id={id}
              gradientUnits="userSpaceOnUse"
              x1={s.x0}
              y1={0}
              x2={s.x1}
              y2={0}
            >
              <stop offset="0" stopColor={c} stopOpacity={base * opacityForAge(s.age0)} />
              <stop offset="1" stopColor={c} stopOpacity={base * opacityForAge(s.age1)} />
            </linearGradient>
          );
        })}
      </defs>
      {segments.map((s, i) => (
        <path
          key={i}
          d={tracePath(s.x0, s.x1)}
          fill="none"
          stroke={`url(#${key}-${i})`}
          strokeWidth={core ? 2.8 : 10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {Array.from({length: BANDS}, (_, i) => {
        const b = blurAt(TRACE_X0 + (i + 0.5) * BAND_W);
        const mask = bandMask(i);
        return (
          <div
            key={i}
            style={{position: 'absolute', inset: 0, maskImage: mask, WebkitMaskImage: mask}}
          >
            {/* Phosphor halo, then the hot core on top. */}
            <div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
              {layer(b + 5, false, `g${i}`)}
            </div>
            {layer(b, true, `c${i}`)}
          </div>
        );
      })}
    </div>
  );
};
