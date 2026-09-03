import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FinishPass } from "./components/FinishPass";
import { GlowPool } from "./components/GlowPool";
import { ReflectionBed } from "./components/ReflectionBed";
import { SparkField } from "./components/SparkField";
import { FONT_FAMILY, fontGate } from "./fonts";
import { createCanvas, ctx2d } from "./lib/canvas";
import { ChromeText as ChromeWordLayer, useChromeWord } from "./lib/ChromeText";
import { paintGlowField } from "./lib/glowField";
import { closedDrift } from "./lib/random";
import { VARIANTS } from "./variants";
import { DURATION_IN_FRAMES } from "./constants";
import type { VariantName } from "./variants";

/**
 * Motion constants, shared by all three versions.
 *
 * Every period here divides the 300-frame clip a whole number of times, which
 * is what makes frame 0 and frame 300 identical.
 */
/** Whole traversals of the travelling highlight per loop. */
const HIGHLIGHT_SWEEPS = 2;
/** Frames per breath of the outer glow. 300 / 150 = 2 whole cycles. */
const GLOW_BREATH_PERIOD = 150;
/** Depth of that breath: the glow swings +/- 8%. */
const GLOW_BREATH_DEPTH = 0.08;
/** Amplitude of the ambient drift, in composition pixels. */
const AMBIENT_DRIFT = 6;
/** The glow pools are computed at 1/8 resolution and upscaled. */
const FIELD_DIVISOR = 8;
/** Vertical placement of the word, leaving room for its reflection below. */
const WORD_CENTER_Y = 0.455;
/** Letterspacing and word spacing, as fractions of the font size. */
const TRACKING_RATIO = 0.12;
const WORD_GAP_RATIO = 0.34;
/** The widest the set word may be, as a fraction of the frame. */
const MAX_WIDTH_RATIO = 0.84;

export type ChromeTextProps = {
  variant: VariantName;
};

/**
 * The composition: glow pools, a reflection bed, the chrome word and a spark
 * field, finished with bloom, a vignette and grain.
 *
 * Nothing here reads the clock. Every layer is a pure function of
 * `useCurrentFrame()`, drawn to a canvas once per React render, so Remotion
 * can render frames out of order across processes and still get an identical
 * result every time.
 */
export const ChromeText: React.FC<ChromeTextProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // The loop period is a property of the design, not of the composition
  // length, so it stays fixed even when a longer composition is rendered to
  // check that frame 300 lands exactly back on frame 0.
  const period = DURATION_IN_FRAMES;
  const { word, capHeightRatio, palette } = VARIANTS[variant];

  const source = useChromeWord(
    {
      word,
      fontFamily: FONT_FAMILY,
      capHeight: height * capHeightRatio,
      trackingRatio: TRACKING_RATIO,
      wordGapRatio: WORD_GAP_RATIO,
      maxWidth: width * MAX_WIDTH_RATIO,
    },
    palette,
  );

  const centerX = width / 2;
  const centerY = height * WORD_CENTER_Y;

  // The highlight completes a whole number of traversals per loop.
  const sweep = ((frame / period) * HIGHLIGHT_SWEEPS) % 1;

  // The outer glow breathes on a sine whose period divides the clip.
  const glowAlpha =
    1 + GLOW_BREATH_DEPTH * Math.sin((frame / GLOW_BREATH_PERIOD) * Math.PI * 2);

  // One colour field per frame, shared by the background pools and by the
  // word's outer glow — so the halo around each letter is coloured by exactly
  // the pool sitting behind it, and shifts hue as the pools drift.
  const field = useMemo(() => {
    const canvas = createCanvas(width / FIELD_DIVISOR, height / FIELD_DIVISOR);
    paintGlowField(ctx2d(canvas), canvas.width, canvas.height, {
      hues: palette.glow,
      frame,
      period,
      bandCenter: WORD_CENTER_Y,
      bandSpread: 0.09,
      radiusRatio: 0.17,
      intensity: 0.5,
    });
    return canvas;
  }, [width, height, palette.glow, frame, period]);

  // A closed path, so the drift is back at its origin on the last frame.
  const drift = closedDrift(
    "ambient",
    frame,
    period,
    AMBIENT_DRIFT,
    1,
    2,
  );

  const sparkHues = useMemo(
    () => [...palette.glow, palette.sparkPale],
    [palette.glow, palette.sparkPale],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      {/* The ambient drift moves the picture, not the frame: the vignette and
          grain below stay put, so the edges never slide. */}
      <AbsoluteFill
        style={{ transform: `translate(${drift.x}px, ${drift.y}px)` }}
      >
        <GlowPool field={field} width={width} height={height} />
        <ReflectionBed
          source={source}
          palette={palette}
          width={width}
          height={height}
          centerX={centerX}
          centerY={centerY}
          sweep={sweep}
          gate={fontGate}
        />
        <ChromeWordLayer
          source={source}
          palette={palette}
          width={width}
          height={height}
          centerX={centerX}
          centerY={centerY}
          sweep={sweep}
          glowAlpha={glowAlpha}
          glowColor={palette.glow[0]}
          glowField={field}
          gate={fontGate}
        />
        <SparkField
          width={width}
          height={height}
          centerX={centerX}
          centerY={centerY}
          frame={frame}
          period={period}
          hues={sparkHues}
        />
      </AbsoluteFill>
      <FinishPass
        width={width}
        height={height}
        frame={frame}
        period={period}
      />
    </AbsoluteFill>
  );
};
