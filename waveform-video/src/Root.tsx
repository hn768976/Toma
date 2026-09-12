import React from "react";
import { Composition } from "remotion";
import { Waveform, type WaveformProps } from "./waveform/Waveform";
import { BLUE_THEME, WHITE_THEME } from "./waveform/theme";

const FPS = 30;
/** 300 frames at 30fps — 10.000s, matching the reference clip exactly. */
const DURATION_IN_FRAMES = 300;

const UHD = { width: 3840, height: 2160 } as const;
const FHD = { width: 1920, height: 1080 } as const;

/**
 * Grid and motion for each variant. Nothing here is in pixels: the component
 * derives every dimension from the composition size, so one set of props drives
 * 4K and 1080p identically.
 */
const BLUE: WaveformProps = {
  theme: BLUE_THEME,
  // Traced from the reference: 32 bars × 40 segments, bar 24/30 of its pitch,
  // segment 11/13.5 of its row.
  bars: 32,
  rows: 40,
  barRatio: 24 / 30,
  cellRatio: 11 / 13.5,
  // The reference never drops below 13 or exceeds 34 of its 40 segments.
  minFill: 13 / 40,
  maxFill: 34 / 40,
  skew: 1.35,
  seed: 20250912,
};

/** Same construction, twice the bars and 1.5× the segments — a finer grid. */
const WHITE: WaveformProps = {
  ...BLUE,
  theme: WHITE_THEME,
  bars: 64,
  rows: 60,
};

const timing = { fps: FPS, durationInFrames: DURATION_IN_FRAMES } as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WaveformBlue4K"
        component={Waveform}
        {...UHD}
        {...timing}
        defaultProps={BLUE}
      />
      <Composition
        id="WaveformBlue1080"
        component={Waveform}
        {...FHD}
        {...timing}
        defaultProps={BLUE}
      />
      <Composition
        id="WaveformWhite4K"
        component={Waveform}
        {...UHD}
        {...timing}
        defaultProps={WHITE}
      />
      <Composition
        id="WaveformWhite1080"
        component={Waveform}
        {...FHD}
        {...timing}
        defaultProps={WHITE}
      />
    </>
  );
};
