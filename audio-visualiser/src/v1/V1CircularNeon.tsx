import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Grain} from '../shared/Grain';
import {hsl} from '../shared/color';
import {barBand, sampleBand} from '../shared/ringLayout';
import {clamp} from '../spectrum/random';
import {BEAT_FRAMES, beatEnvelope, getSpectrum} from '../spectrum/spectrum';
import {
  BAR_COUNT,
  BAR_GAIN,
  DOT_COUNT,
  DOT_TURNS,
  RING_TURNS,
  SPIKE_BY_INDEX,
  ringRamp,
} from './geometry';
import {Bar, Dot, RingArt} from './RingArt';

const BACKGROUND = '#050510';

/**
 * V1 — circular neon spectrum.
 *
 * A single clean ring of bars, centred, with the frame left largely black
 * around it. Composed and graphic rather than kinetic: the ring occupies the
 * middle and nothing radiates out across the frame.
 */
export const V1CircularNeon: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();

  const spectrum = getSpectrum(frame);
  const beat = beatEnvelope(frame, BEAT_FRAMES);

  const cx = width / 2;
  const cy = height / 2;

  // Everything is sized off frame height, so the composition survives a rescale.
  const beatScale = 1 + 0.03 * beat;
  const ringRadius = 0.21 * height * beatScale; // 0.42 x height across
  const dotRadius = ringRadius * 1.6;
  const ringWidth = 0.0042 * height;
  const barWidth = 0.0034 * height;
  const maxBar = 0.132 * height;
  const minBar = 0.009 * height;

  const spin = (RING_TURNS * frame) / durationInFrames;
  const dotSpin = (DOT_TURNS * frame) / durationInFrames;

  const bars: Bar[] = [];
  const halfSlot = (Math.PI / BAR_COUNT) * 1.25;

  for (let i = 0; i < BAR_COUNT; i++) {
    // Angle measured from straight up, clockwise.
    const turn = i / BAR_COUNT + spin;
    const angle = turn * Math.PI * 2 - Math.PI / 2;

    // Colour is fixed to the frame, not to the bar: magenta stays at the top of
    // the frame while the pattern of bars rotates through it.
    const frameTurn = ((turn % 1) + 1) % 1;
    const down = (1 - Math.cos(frameTurn * Math.PI * 2)) / 2; // 0 top, 1 bottom
    const base = ringRamp(down);

    const value = clamp(sampleBand(spectrum, barBand(i, BAR_COUNT)) * BAR_GAIN[i]);
    // A power curve widens the gap between the quiet bands and the loud ones;
    // read straight, the spectrum sits in too narrow a band and the ring's
    // outline comes out flat.
    const drive = Math.pow(value, 1.35);

    const spike = SPIKE_BY_INDEX.get(i);
    let length = minBar + maxBar * drive;
    let strokeWidth = barWidth;

    if (spike) {
      // Spikes are driven by the same band, but reach past the others and pump
      // on the beat, so they read as transients rather than as decoration.
      const push = clamp(0.4 + 0.6 * value + 0.45 * beat);
      length = minBar + maxBar * spike.reach * push * (0.85 + 0.3 * spike.phase);
      strokeWidth = barWidth * 0.62;
    }

    const lit = clamp(value * 1.2 + beat * 0.2);
    const color = hsl(
      {
        h: base.h,
        s: clamp(base.s * (0.9 + 0.1 * lit), 0, 1),
        l: clamp(base.l * (0.6 + 0.55 * lit), 0, 0.8),
      },
      spike ? 0.8 : clamp(0.45 + 0.6 * lit, 0, 1),
    );

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    bars.push({
      // A short chord at the ring radius. 168 of them merge into one solid,
      // continuously coloured ring line under the bars.
      seg: [
        cx + ringRadius * Math.cos(angle - halfSlot),
        cy + ringRadius * Math.sin(angle - halfSlot),
        cx + ringRadius * Math.cos(angle + halfSlot),
        cy + ringRadius * Math.sin(angle + halfSlot),
      ],
      bar: [
        cx + ringRadius * cosA,
        cy + ringRadius * sinA,
        cx + (ringRadius + length) * cosA,
        cy + (ringRadius + length) * sinA,
      ],
      width: strokeWidth,
      color,
    });
  }

  const dots: Dot[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    const turn = i / DOT_COUNT + dotSpin;
    const angle = turn * Math.PI * 2 - Math.PI / 2;
    const frameTurn = ((turn % 1) + 1) % 1;
    const down = (1 - Math.cos(frameTurn * Math.PI * 2)) / 2;
    const base = ringRamp(down);
    // A slow brightness wave riding the dots is what makes the counter-rotation
    // legible; evenly spaced identical dots would look static however they spin.
    const wave = 0.5 + 0.5 * Math.sin(i * 0.55 + frame * 0.06);
    dots.push({
      cx: cx + dotRadius * Math.cos(angle),
      cy: cy + dotRadius * Math.sin(angle),
      r: 0.0021 * height * (0.8 + 0.5 * wave),
      color: hsl({h: base.h, s: base.s, l: base.l * 0.9}, 0.2 + 0.3 * wave + 0.15 * beat),
    });
  }

  const art = (weight: number, opacity: number) => (
    <RingArt
      width={width}
      height={height}
      bars={bars}
      dots={dots}
      ringWidth={ringWidth}
      weight={weight}
      opacity={opacity}
    />
  );

  // Blur radii track frame height so the bloom looks the same at any scale.
  const blur = (px: number) => `blur(${(px * height) / 2160}px)`;
  const hazeAlpha = 0.5 + 0.5 * beat;

  return (
    <AbsoluteFill style={{backgroundColor: BACKGROUND}}>
      {/* Soft coloured haze behind the ring, picking up the nearest hues.
          An annulus, not a disc: the inside of the ring stays dark. */}
      <AbsoluteFill style={{filter: blur(70), opacity: 0.9}}>
        <div
          style={{
            position: 'absolute',
            left: cx - dotRadius * 1.6,
            top: cy - dotRadius * 1.6,
            width: dotRadius * 3.2,
            height: dotRadius * 3.2,
            background: `radial-gradient(circle at 50% 50%, transparent 0%, transparent 34%, hsl(300 82% 42% / ${(
              0.3 * hazeAlpha
            ).toFixed(3)}) 46%, hsl(250 78% 38% / ${(0.16 * hazeAlpha).toFixed(
              3,
            )}) 60%, transparent 78%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: cx - dotRadius * 1.35,
            top: cy - dotRadius * 1.7,
            width: dotRadius * 2.7,
            height: dotRadius * 1.9,
            background: `radial-gradient(ellipse at 50% 100%, hsl(312 88% 46% / ${(
              0.3 * hazeAlpha
            ).toFixed(3)}) 0%, transparent 58%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: cx - dotRadius * 1.35,
            top: cy - dotRadius * 0.2,
            width: dotRadius * 2.7,
            height: dotRadius * 1.9,
            background: `radial-gradient(ellipse at 50% 0%, hsl(188 85% 46% / ${(
              0.26 * hazeAlpha
            ).toFixed(3)}) 0%, transparent 58%)`,
          }}
        />
      </AbsoluteFill>

      {/* The bloom stack: wide and soft underneath, sharp on top. */}
      <AbsoluteFill style={{filter: blur(52), mixBlendMode: 'screen'}}>
        {art(2.4, 0.42)}
      </AbsoluteFill>
      <AbsoluteFill style={{filter: blur(15), mixBlendMode: 'screen'}}>
        {art(1.6, 0.7)}
      </AbsoluteFill>
      <AbsoluteFill style={{filter: blur(4), mixBlendMode: 'screen'}}>
        {art(1, 0.85)}
      </AbsoluteFill>
      {/* The wide bloom bleeds inward as readily as outward and silts up the
          middle of the ring. Painting the background back over the inside keeps
          the centre dark, which is what stops the ring reading as a solid disc. */}
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: cx - ringRadius,
            top: cy - ringRadius,
            width: ringRadius * 2,
            height: ringRadius * 2,
            // closest-side, not the default farthest-corner: with the corner as
            // 100% the gradient is still opaque where the square ends and the
            // box edges show up as straight seams across the artwork.
            background: `radial-gradient(circle closest-side, ${BACKGROUND} 0%, ${BACKGROUND} 52%, transparent 100%)`,
            opacity: 0.82,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill>{art(1, 1)}</AbsoluteFill>

      <Grain opacity={0.035} blend="screen" />
    </AbsoluteFill>
  );
};
