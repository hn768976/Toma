import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { createWaveformField } from "./noise";
import { capColor, rampGradient, toCss, type Theme } from "./theme";

export type WaveformProps = {
  readonly theme: Theme;
  /** Number of bars across the canvas. */
  readonly bars: number;
  /** Number of LED segments in a full-height bar. */
  readonly rows: number;
  /** Bar width as a fraction of its column pitch. Reference: 24/30. */
  readonly barRatio: number;
  /** Segment height as a fraction of its row pitch. Reference: 11/13.5. */
  readonly cellRatio: number;
  /** Shortest and tallest bar, as fractions of the full column height. */
  readonly minFill: number;
  readonly maxFill: number;
  /** Skews the height distribution downward so tall peaks stay occasional. */
  readonly skew: number;
  readonly seed: number;
};

/**
 * A bottom-anchored LED equaliser.
 *
 * Every dimension is derived from the canvas size, so the same component is
 * pixel-proportional at 4K, 1080p or the reference's 960×540 — only the
 * composition's `width`/`height` change.
 */
export const Waveform: React.FC<WaveformProps> = ({
  theme,
  bars,
  rows,
  barRatio,
  cellRatio,
  minFill,
  maxFill,
  skew,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const field = useMemo(
    () =>
      createWaveformField({
        bars,
        rows,
        durationInFrames,
        seed,
        minFill,
        maxFill,
        skew,
      }),
    [bars, rows, durationInFrames, seed, minFill, maxFill, skew],
  );

  const barPitch = width / bars;
  const barWidth = barPitch * barRatio;
  const barGap = barPitch - barWidth;

  const rowPitch = height / rows;
  const cellHeight = rowPitch * cellRatio;
  const rowGap = rowPitch - cellHeight;

  const litRamp = useMemo(() => rampGradient(theme.ramp), [theme.ramp]);
  const unlitRamp = useMemo(
    () => rampGradient(theme.ramp, theme.unlit),
    [theme.ramp, theme.unlit],
  );

  // A bar is painted as one gradient rectangle, then sliced into segments by a
  // single full-bleed overlay of background-coloured stripes. Cheaper and
  // sharper than emitting a div per segment, and the stripes stay perfectly
  // aligned across every bar.
  const segmentStripes = useMemo(
    () =>
      [
        `repeating-linear-gradient(to top,`,
        ` ${theme.background} 0px,`,
        ` ${theme.background} ${rowGap / 2}px,`,
        ` transparent ${rowGap / 2}px,`,
        ` transparent ${rowGap / 2 + cellHeight}px,`,
        ` ${theme.background} ${rowGap / 2 + cellHeight}px,`,
        ` ${theme.background} ${rowPitch}px)`,
      ].join(""),
    [theme.background, rowGap, cellHeight, rowPitch],
  );

  // Painted at full canvas height on every bar and clipped by the bar's own
  // height, so a segment's colour depends on its row, never on its bar.
  const absoluteRamp = {
    backgroundSize: `100% ${height}px`,
    backgroundPosition: "left bottom",
    backgroundRepeat: "no-repeat" as const,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {Array.from({ length: bars }, (_, bar) => {
        const litRows = field.litRows(bar, frame);
        const left = bar * barPitch + barGap / 2;

        // Top edge of the highest lit segment.
        const capTop = height - litRows * rowPitch + rowGap / 2;
        const capAt = rows > 1 ? (litRows - 1) / (rows - 1) : 1;

        return (
          <React.Fragment key={bar}>
            <div
              style={{
                position: "absolute",
                left,
                top: 0,
                width: barWidth,
                height,
                backgroundImage: unlitRamp,
                ...absoluteRamp,
              }}
            />
            <div
              style={{
                position: "absolute",
                left,
                top: capTop,
                width: barWidth,
                height: height - capTop,
                backgroundImage: litRamp,
                ...absoluteRamp,
              }}
            />
            <div
              style={{
                position: "absolute",
                left,
                top: capTop,
                width: barWidth,
                height: cellHeight,
                backgroundColor: toCss(capColor(theme, capAt)),
              }}
            />
          </React.Fragment>
        );
      })}

      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: segmentStripes,
        }}
      />
    </AbsoluteFill>
  );
};
