import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Grain} from '../shared/Grain';
import {barBand, sampleBand} from '../shared/ringLayout';
import {mulberry32} from '../spectrum/random';
import {getEqualizedSpectrum} from '../spectrum/spectrum';

/** Bars, one per slot around the dotted ring. */
const BAR_COUNT = 120;

/** Dots forming the ring outline. */
const DOT_COUNT = 168;

/**
 * A fixed gain per bar. Without it the same handful of bars spike every time
 * and the ring reads as a stencil rather than as something responding.
 */
const BAR_GAIN: number[] = (() => {
  const rand = mulberry32(0x3ac9_51e2);
  return Array.from({length: BAR_COUNT}, () => 0.44 + rand() * 0.68);
})();

/**
 * V3 — minimal white podcast visualiser.
 *
 * Pure black, pure white, nothing else. The austerity is the whole character:
 * no glow, no bloom, hard-ended strokes. White on true black keys cleanly under
 * a screen blend, which is what makes this usable as an overlay given that mp4
 * carries no alpha.
 *
 * Not a loop — the progress bar runs empty to full over the full 450 frames,
 * which cannot loop without a visible jump.
 */
export const V3MinimalWhite: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();

  const spectrum = getEqualizedSpectrum(frame);

  const cx = width / 2;
  const cy = height / 2;

  const ringRadius = 0.175 * height; // 0.35 x height across
  const dotRadius = 0.0018 * height;
  const barGap = 0.0075 * height;
  const barWidth = 0.0022 * height;

  // Short, and hard to earn. The power curve means a quiet band produces almost
  // nothing and only the loudest bands push out into a visible spike.
  const minBar = 0.0035 * height;
  const maxBar = 0.092 * height;

  const dots: React.ReactElement[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    const angle = (i / DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
    dots.push(
      <circle
        key={`d${i}`}
        cx={cx + ringRadius * Math.cos(angle)}
        cy={cy + ringRadius * Math.sin(angle)}
        r={dotRadius}
        fill="#ffffff"
        opacity={0.9}
      />,
    );
  }

  const bars: React.ReactElement[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
    const value = Math.min(1, sampleBand(spectrum, barBand(i, BAR_COUNT)) * BAR_GAIN[i]);
    // A steep curve is what keeps this restrained: a band at half its peak
    // contributes almost nothing, so most bars stay just past the dots and only
    // the genuinely loud ones read as spikes. The beat is already in the signal
    // and needs no extra push here — every band peaks on it at once, and any
    // added gain turns each beat into a full sunburst.
    const drive = Math.pow(value, 3.4);
    const length = minBar + maxBar * drive;

    const r0 = ringRadius + barGap;
    const r1 = r0 + length;
    bars.push(
      <line
        key={`b${i}`}
        x1={cx + r0 * Math.cos(angle)}
        y1={cy + r0 * Math.sin(angle)}
        x2={cx + r1 * Math.cos(angle)}
        y2={cy + r1 * Math.sin(angle)}
        stroke="#ffffff"
        strokeWidth={barWidth}
        strokeLinecap="butt"
      />,
    );
  }

  // Progress: constant speed across the full duration, stopping near the right
  // end rather than exactly on it.
  const trackX0 = 0.1 * width;
  const trackX1 = 0.9 * width;
  const trackY = 0.86 * height;
  const progress =
    durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  const knobX = trackX0 + (trackX1 - trackX0) * progress * 0.985;
  const trackWidth = 0.0013 * height;
  const knobRadius = 0.0052 * height;

  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{position: 'absolute', inset: 0}}
      >
        {dots}
        {bars}

        {/* Played portion, slightly brighter than the portion still ahead. */}
        <line
          x1={trackX0}
          y1={trackY}
          x2={trackX1}
          y2={trackY}
          stroke="#ffffff"
          strokeWidth={trackWidth}
          opacity={0.38}
        />
        <line
          x1={trackX0}
          y1={trackY}
          x2={Math.max(trackX0, knobX)}
          y2={trackY}
          stroke="#ffffff"
          strokeWidth={trackWidth}
          opacity={0.85}
        />
        <circle cx={knobX} cy={trackY} r={knobRadius} fill="#ffffff" />
      </svg>

      {/* Overlay blend, so the background stays at exactly #000000 and the
          screen-blend key over other footage remains exact. */}
      <Grain opacity={0.012} blend="overlay" cell={2.4} />
    </AbsoluteFill>
  );
};
