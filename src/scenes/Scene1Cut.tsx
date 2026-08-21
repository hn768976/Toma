import React from 'react';
import {AbsoluteFill, interpolateColors, useCurrentFrame} from 'remotion';
import {COLORS, STROKE, TYPE} from '../lib/theme';
import {draw, fadeIn, fadeOut, slide, snap} from '../lib/motion';

/**
 * SCENE 1 -- THE CUT (0:00 - 0:16)
 *
 * Build note from the spec: nothing is literally cut. Three divs are rendered
 * flush from the first frame so they *look* like one rectangle, then they move
 * apart. Far simpler than any masking approach.
 */

const RECT_W = 1152; // 60% of 1920
const RECT_H = 260;
const SEG_W = RECT_W / 3; // 384

// Local frame cues.
const F_LINES = 90; // 0:03 dotted lines draw
const F_LINE_STAGGER = 6; // 200ms
const F_SPLIT = 150; // 0:05 rectangle splits, 8px gaps
const F_WIDEN = 210; // 0:07 gaps widen to 40px, labels swap
const F_DRIFT = 360; // 0:12 packets scale to 0.7, drift left

const PACKET_LABELS = ['Packet 1', 'Packet 2', 'Packet 3'];

export const Scene1Cut: React.FC = () => {
  const frame = useCurrentFrame();

  // 3. snap to an 8px gap, then 2. slide it open to 40px.
  const gap =
    frame < F_WIDEN
      ? snap(frame, F_SPLIT, 0, 8)
      : slide(frame, F_WIDEN, 8, 40);

  // 2. slide -- the whole group shrinks and drifts off toward the route.
  const scale = slide(frame, F_DRIFT, 1, 0.7);
  const driftX = slide(frame, F_DRIFT, 0, -320);

  const rectOpacity = fadeIn(frame, 0);
  const outlineOpacity = Math.min(rectOpacity, fadeOut(frame, F_SPLIT - 6));
  const messageLabelOpacity = Math.min(rectOpacity, fadeOut(frame, F_WIDEN));
  const packetLabelOpacity = fadeIn(frame, F_WIDEN + 6);

  // Grey message -> orange packets. Accent arrives exactly when the labels do.
  const segmentFill = interpolateColors(
    frame,
    [F_WIDEN, F_WIDEN + 9],
    [COLORS.fill, COLORS.accent],
  );

  const cutLineY = [540 - RECT_H / 2 - 60, 540 + RECT_H / 2 + 60];
  const cutLinesOpacity = Math.min(
    fadeIn(frame, F_LINES, 1),
    fadeOut(frame, F_SPLIT - 6),
  );

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      <AbsoluteFill
        style={{
          transform: `translateX(${driftX}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {PACKET_LABELS.map((label, i) => {
          const offset = (i - 1) * (SEG_W + gap);
          return (
            <div
              key={label}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: SEG_W,
                height: RECT_H,
                marginLeft: -SEG_W / 2,
                marginTop: -RECT_H / 2,
                transform: `translateX(${offset}px)`,
                backgroundColor: segmentFill,
                opacity: rectOpacity,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{...TYPE, fontSize: 30, opacity: packetLabelOpacity}}
              >
                {label}
              </span>
            </div>
          );
        })}

        {/* Single outline around the still-whole message. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: RECT_W,
            height: RECT_H,
            marginLeft: -RECT_W / 2,
            marginTop: -RECT_H / 2,
            border: `${STROKE}px solid ${COLORS.ink}`,
            opacity: outlineOpacity,
          }}
        />

        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            opacity: messageLabelOpacity,
          }}
        >
          <span style={{...TYPE, fontSize: 52}}>Your Message</span>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* 4. draw -- two dotted cut lines, top to bottom, staggered 200ms.
          The dash pattern makes the dots, so the reveal animates the line's
          end point rather than a stroke-dashoffset. */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, opacity: cutLinesOpacity}}
      >
        {[-1, 1].map((side, i) => {
          const x = 960 + (side * SEG_W) / 2;
          const progress = draw(frame, F_LINES + i * F_LINE_STAGGER);
          return (
            <line
              key={side}
              x1={x}
              y1={cutLineY[0]}
              x2={x}
              y2={cutLineY[0] + (cutLineY[1] - cutLineY[0]) * progress}
              stroke={COLORS.ink}
              strokeWidth={STROKE}
              strokeDasharray="2 16"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
