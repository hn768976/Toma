import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { RadialBarRing } from "./RadialBarRing";
import { RingTrack } from "./RingTrack";
import { SevenSegmentDigits } from "./SevenSegmentDigits";
import { UnitLabels } from "./UnitLabels";
import { countAt } from "./count";
import { sweepColorAt } from "./color";
import { grainPass } from "./effects";
import { LABEL_FONT_FAMILY, LABEL_FONT_WEIGHT } from "./fonts";
import { makeHarmonics, sampleNoise } from "./noise";
import { createStage, type Stage } from "./stage";
import { DIGITS, DRIFT_PX, PALETTE, RING, computeLayout } from "./theme";
import { VARIANTS, type VariantName } from "./variants";

export type CountdownTimerProps = {
  variant: VariantName;
};

const GRAIN_ALPHA = 0.02;

/** Bloom radii, as fractions of frame height. */
const BAR_BLOOM_FRAC = 0.022;
const DIGIT_BLOOM_FRAC = 0.03;

const pad2 = (value: number) => String(value).padStart(2, "0");

/**
 * Ambient drift of the whole assembly: a closed figure-eight, so the
 * assembly returns exactly to where it started and never appears to
 * wander off-centre over a long count.
 */
const driftAt = (frame: number, durationInFrames: number) => {
  const turn = (frame / durationInFrames) * Math.PI * 2;
  return {
    x: DRIFT_PX * Math.sin(turn),
    y: DRIFT_PX * Math.sin(turn * 2),
  };
};

/**
 * Neon radial-bar countdown timer.
 *
 * Every value on screen is a pure function of useCurrentFrame(): the
 * count, the bar lengths, the ring's rotation, the drift and the grain.
 * That is not stylistic here — Remotion renders frames in parallel and
 * out of order, so a timer driven by Date.now() or by component state
 * would drift out of step with the frames it was drawn on and the
 * finished file would simply show the wrong numbers.
 */
export const CountdownTimer: React.FC<CountdownTimerProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const { totalSeconds } = VARIANTS[variant];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);

  // The stage is built from the mounted canvas once, then reused; the
  // buffers behind it are far too large to reallocate every frame.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStage((current) =>
      current && current.target === canvas && current.width === width
        ? current
        : createStage(canvas, width, height),
    );
  }, [width, height]);

  const layout = useMemo(() => computeLayout(width, height), [width, height]);
  const count = countAt(frame, fps, totalSeconds);

  const drift = driftAt(frame, durationInFrames);
  const centerX = layout.centerX + drift.x;
  const centerY = layout.centerY + drift.y;

  // Exactly one full turn over the composition's length, whatever that
  // length is — the rotation is proportional to the timer, not to real
  // time, so the shorter variant simply turns faster.
  const rotation = (frame / durationInFrames) * Math.PI * 2;

  const harmonics = useMemo(() => makeHarmonics("countdown-bar-field"), []);
  const seconds = frame / fps;
  const lengthFactor = useCallback(
    (_index: number, ringAngle: number) =>
      sampleNoise(harmonics, ringAngle, seconds),
    [harmonics, seconds],
  );

  // The flash lands on the frame the digits change; through the final ten
  // seconds it hits harder and the steady glow rises with it.
  const flashGain = count.flashing ? 1.25 + 0.45 * count.build : 1;
  const digitGlow = (1 + 0.55 * count.build) * flashGain;
  const digitBloom = height * DIGIT_BLOOM_FRAC * (1 + 0.25 * count.build);

  const r = layout.trackRadius;
  const digitsCenterY = centerY + r * DIGITS.centerOffsetR;
  const labelY = centerY + r * DIGITS.labelBaselineR;
  const labelSize = r * DIGITS.labelSizeR;

  // MINS sits under the minutes pair, SECS under the seconds pair. Both
  // pair centres are one half-digit plus half a gap either side of the
  // colon, which is itself on the readout's centre line.
  const pairOffset =
    r * DIGITS.colonWidthR / 2 +
    r * DIGITS.pairGapR +
    r * DIGITS.widthR +
    (r * DIGITS.digitGapR) / 2;

  const labels = useMemo(
    () => [
      { text: "MINS", x: centerX - pairOffset, y: labelY },
      { text: "SECS", x: centerX + pairOffset, y: labelY },
    ],
    [centerX, pairOffset, labelY],
  );

  // Grain goes on last, over everything. A parent's layout effect runs
  // after all of its children's, which is exactly the ordering wanted.
  useLayoutEffect(() => {
    if (!stage) return;
    const ctx = stage.target.getContext("2d");
    // Only once the children have painted this frame, and only once.
    if (!ctx || stage.frame !== frame || stage.painted.has("grain")) return;
    stage.painted.add("grain");
    grainPass(ctx, width, height, frame, GRAIN_ALPHA);
  });

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.background }}>
      <RingTrack
        stage={stage}
        frame={frame}
        background={PALETTE.background}
        centerX={centerX}
        centerY={centerY}
        radius={layout.trackRadius}
        lineWidth={layout.trackWidth}
        color={PALETTE.ringTrack}
      />
      <RadialBarRing
        stage={stage}
        frame={frame}
        background={PALETTE.background}
        centerX={centerX}
        centerY={centerY}
        innerRadius={layout.trackRadius}
        barCount={RING.barCount}
        barWidth={layout.barWidth}
        minLength={layout.barMinLength}
        maxLength={layout.barMaxLength}
        rotation={rotation}
        lengthFactor={lengthFactor}
        colorAt={sweepColorAt}
        bloomBlur={height * BAR_BLOOM_FRAC}
        bloomAlpha={0.75}
      />
      <SevenSegmentDigits
        stage={stage}
        frame={frame}
        background={PALETTE.background}
        text={`${pad2(count.minutes)}:${pad2(count.seconds)}`}
        centerX={centerX}
        centerY={digitsCenterY}
        digitWidth={r * DIGITS.widthR}
        digitHeight={r * DIGITS.heightR}
        thickness={r * DIGITS.thicknessR}
        gap={r * DIGITS.thicknessR * DIGITS.segmentGapT}
        colonWidth={r * DIGITS.colonWidthR}
        digitGap={r * DIGITS.digitGapR}
        pairGap={r * DIGITS.pairGapR}
        litColor={PALETTE.digitWhite}
        dimColor={PALETTE.digitDim}
        bloomBlur={digitBloom}
        bloomAlpha={Math.min(0.95, 0.7 * digitGlow)}
      />
      <UnitLabels
        stage={stage}
        frame={frame}
        background={PALETTE.background}
        labels={labels}
        fontFamily={LABEL_FONT_FAMILY}
        fontSize={labelSize}
        fontWeight={LABEL_FONT_WEIGHT}
        letterSpacing={r * DIGITS.labelTrackingR}
        color={PALETTE.labelPale}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
