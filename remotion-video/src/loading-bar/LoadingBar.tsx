import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FilmFinish } from "./FilmFinish";
import {
  DISPLAY_FONT_FAMILY,
  DISPLAY_FONT_WEIGHT,
  MONO_FONT_FAMILY,
  MONO_FONT_WEIGHT,
} from "./fonts";
import { computeLayout } from "./layout";
import { completionFrame, progressAt } from "./lib/curve";
import { tiltPoint } from "./lib/tilt";
import { MottledBackdrop } from "./MottledBackdrop";
import { NeonBar } from "./NeonBar";
import { PercentReadout } from "./PercentReadout";
import { SparkField } from "./SparkField";
import { VARIANTS, type VariantName } from "./variants";
import { dotsVisibleAt, WordMark } from "./WordMark";

export type LoadingBarProps = {
  variant: VariantName;
};

/** Frames over which the leading-edge flash fades once the bar completes. */
const FLASH_FADE_FRAMES = 28;

/**
 * The whole piece. Three variants share this component and differ only
 * in the word, the palette and the fill curve — see variants.ts, which
 * is the only file holding a colour or a word.
 *
 * Structure is a stack of 2D canvas layers. The backdrop is opaque; the
 * bar, word, readout and dust are transparent layers composited with
 * `screen`, which is what lets their glow spill onto the wall instead of
 * being clipped to their own bounds. Vignette and grain go on top.
 *
 * Every layer is a pure function of the frame number: no state, no rAF,
 * no Date.now(), so `npx remotion render` is deterministic regardless of
 * how work is split across workers.
 */
export const LoadingBar: React.FC<LoadingBarProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const config = VARIANTS[variant];
  const { palette } = config;

  const layout = computeLayout(width, height, config.capHeightRatio);
  const progress = progressAt(frame, config.curve);

  const done = completionFrame(config.curve);
  const leadFlash =
    frame <= done
      ? 1
      : Math.max(0.12, 1 - (frame - done) / FLASH_FADE_FRAMES);

  // Where the bar's light is coming from right now, in frame space, so
  // the dust can brighten around it even though it is not itself tilted.
  const lead = tiltPoint(
    layout.barLeft + progress * layout.barWidth + layout.barSkew / 2,
    layout.barTop + layout.barHeight / 2,
    width,
    height,
  );
  const lightStrength = Math.max(0, Math.min(1, (frame - 28) / 18));

  return (
    <AbsoluteFill
      style={{ backgroundColor: palette.backdropDeep, isolation: "isolate" }}
    >
      <MottledBackdrop
        width={width}
        height={height}
        deep={palette.backdropDeep}
        mottle={palette.backdropMottle}
        glow={{
          color: palette.backdropMottle,
          centerX: layout.glowCenterX,
          centerY: layout.glowCenterY,
          radiusX: layout.glowRadiusX,
          radiusY: layout.glowRadiusY,
          alpha: 0.55,
        }}
        seed={`${variant}-backdrop`}
      />

      <SparkField
        width={width}
        height={height}
        frame={frame}
        color={palette.spark}
        lightX={lead.x}
        lightY={lead.y}
        lightRadius={width * 0.17}
        lightStrength={lightStrength}
        scale={layout.scale}
        seed={`${variant}-spark`}
      />

      <NeonBar
        width={width}
        height={height}
        x={layout.barLeft}
        y={layout.barTop}
        barWidth={layout.barWidth}
        barHeight={layout.barHeight}
        skew={layout.barSkew}
        cornerRadius={layout.barRadius}
        progress={progress}
        leadFlash={leadFlash}
        scale={layout.scale}
        palette={{
          outline: palette.barOutline,
          core: palette.barCore,
          fill: palette.fill,
          fillBright: palette.fillBright,
        }}
      />

      <WordMark
        width={width}
        height={height}
        word={config.word}
        fontFamily={DISPLAY_FONT_FAMILY}
        fontWeight={DISPLAY_FONT_WEIGHT}
        capHeight={layout.capHeight}
        left={layout.wordLeft}
        baseline={layout.wordBaseline}
        palette={{ word: palette.word, core: palette.wordCore }}
        dotsVisible={dotsVisibleAt(frame)}
        scale={layout.scale}
      />

      {config.showPercent ? (
        <PercentReadout
          width={width}
          height={height}
          progress={progress}
          fontFamily={MONO_FONT_FAMILY}
          fontWeight={MONO_FONT_WEIGHT}
          fontSize={layout.barHeight * 0.4}
          right={layout.barLeft + layout.barWidth + layout.barSkew}
          baseline={layout.barTop - height * 0.016}
          color={palette.word}
          scale={layout.scale}
        />
      ) : null}

      <FilmFinish
        width={width}
        height={height}
        frame={frame}
        seed={`${variant}-finish`}
      />
    </AbsoluteFill>
  );
};
