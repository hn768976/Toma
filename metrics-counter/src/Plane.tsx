import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT_FAMILY} from './fonts';
import {counterValue, formatCount, METRICS} from './counters';
import * as L from './layout';
import type {Theme} from './theme';

/**
 * The gridded sheet with the three lines of type on it. Real DOM text under a
 * single `perspective` container — nothing is rasterised to canvas, so the glyph
 * edges stay clean however large the render.
 *
 * Rendered once per depth-of-field slice; it is a pure function of the frame, so
 * every copy is identical and only the blur around it differs.
 */
export const Plane: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();

  const t = frame / durationInFrames;

  // Slow float, well under 2% of the frame, plus a barely perceptible push in.
  const driftX = L.DRIFT_X * width * Math.sin(t * Math.PI * 1.15 + 0.6);
  const driftY = L.DRIFT_Y * height * Math.sin(t * Math.PI * 0.8 + 2.1);
  const pushIn = L.PUSH_IN * height * t;

  const planeW = L.PLANE_W * width;
  const planeH = L.PLANE_H * height;

  const fontSize = L.FONT_SIZE * height;
  const cell = L.GRID_CELL * height;
  const line = L.GRID_LINE * height;

  const grid = [
    `repeating-linear-gradient(0deg, ${theme.gridStrong} 0 ${line * 1.4}px, transparent ${line * 1.4}px ${cell * L.GRID_MAJOR_EVERY}px)`,
    `repeating-linear-gradient(90deg, ${theme.gridStrong} 0 ${line * 1.4}px, transparent ${line * 1.4}px ${cell * L.GRID_MAJOR_EVERY}px)`,
    `repeating-linear-gradient(0deg, ${theme.grid} 0 ${line}px, transparent ${line}px ${cell}px)`,
    `repeating-linear-gradient(90deg, ${theme.grid} 0 ${line}px, transparent ${line}px ${cell}px)`,
  ].join(', ');

  return (
    <AbsoluteFill
      style={{
        perspective: L.PERSPECTIVE * height,
        perspectiveOrigin: '50% 50%',
      }}
    >
      <AbsoluteFill style={{transformStyle: 'preserve-3d'}}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: planeW,
            height: planeH,
            backgroundColor: theme.surface,
            transform: [
              `translate(-50%, -50%)`,
              `translateZ(${pushIn}px)`,
              `rotateX(${L.ROTATE_X}deg)`,
              `rotateZ(${L.ROTATE_Z}deg)`,
              `translate(${driftX}px, ${driftY}px)`,
            ].join(' '),
          }}
        >
          {/* A soft warmth (V1) or cool cast (V2) in the paper itself, laid
              under the ruling so it does not wash the grid out. */}
          <AbsoluteFill style={{backgroundColor: theme.surfaceTint}} />
          <AbsoluteFill style={{backgroundImage: grid}} />

          <div
            style={{
              position: 'absolute',
              left: planeW / 2 + L.TEXT_OFFSET_X * width,
              top: planeH / 2 + L.TEXT_OFFSET_Y * height,
              transform: 'translateY(-50%)',
              whiteSpace: 'nowrap',
              fontFamily: `${FONT_FAMILY}, sans-serif`,
              fontWeight: 900,
              fontSize,
              lineHeight: L.LINE_HEIGHT,
              letterSpacing: L.LETTER_SPACING * fontSize,
              color: theme.type,
              // True tabular figures — without them the layout jitters every
              // frame as digit widths change, and at this size it is glaring.
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum" 1, "calt" 0',
            }}
          >
            {METRICS.map((metric) => (
              <div key={metric.label}>
                {formatCount(counterValue(metric, frame, durationInFrames))}
                <span style={{marginLeft: `${L.LABEL_GAP}em`}}>{metric.label}</span>
              </div>
            ))}
          </div>

          {/* Light falls off towards the far edge of the sheet. */}
          <AbsoluteFill style={{backgroundImage: theme.falloff}} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
