import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  ADVANCE_END,
  ADVANCE_START,
  HEIGHT,
  INTRO_END,
  WIDTH,
  seriesPointCount,
} from "./layout";
import { useLandGeometry } from "./geo";
import { buildBars, buildCallouts, buildSeries } from "./data";
import { quarterCount, VARIANTS, type VariantName } from "./variants";
import { WorldBackdrop } from "./components/WorldBackdrop";
import { GridLayer } from "./components/GridLayer";
import { BarRow } from "./components/BarRow";
import { LineSeries } from "./components/LineSeries";
import { ValueCallout } from "./components/ValueCallout";
import { TimelineAxis } from "./components/TimelineAxis";
import { FilmFinish } from "./components/FilmFinish";

export type MarketDashProps = {
  variant: VariantName;
};

export const marketDashDefaultProps: MarketDashProps = { variant: "blue" };

/**
 * A global market dashboard. Every layer — the lines, the bars, the callouts,
 * the axis — advances on one normalised `progress`, so the frame reads as a
 * single dataset moving through time rather than as separate animations
 * happening to share a canvas. Nothing here consults the clock: every value
 * is a pure function of the current frame.
 */
export const MarketDash: React.FC<MarketDashProps> = ({ variant: name }) => {
  const frame = useCurrentFrame();
  const variant = VARIANTS[name];
  const land = useLandGeometry();

  const quarters = quarterCount(variant.timeline);
  const series = useMemo(
    () => buildSeries(name, variant, seriesPointCount(quarters)),
    [name, variant, quarters],
  );
  const bars = useMemo(
    () =>
      buildBars(name, variant.bars.count, variant.bars.mode, series[0].values),
    [name, variant.bars.count, variant.bars.mode, series],
  );

  // The one clock the whole frame runs on.
  const progress = interpolate(frame, [ADVANCE_START, ADVANCE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0, 0.2, 1),
  });
  // Frames 0-25 are backdrop and grid only, dim.
  const dim = interpolate(frame, [0, INTRO_END], [0.34, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reveal = interpolate(frame, [ADVANCE_START, ADVANCE_START + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const callouts = useMemo(
    () => buildCallouts(name, series, frame, progress, reveal),
    [name, series, frame, progress, reveal],
  );

  return (
    <AbsoluteFill
      style={{
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: variant.palette.backgroundDeep,
        overflow: "hidden",
      }}
    >
      <WorldBackdrop
        land={land}
        mode={variant.mapMode}
        palette={variant.palette}
        frame={frame}
        progress={progress}
        dim={dim}
        moodWash={variant.moodWash}
      />
      <GridLayer palette={variant.palette} dim={dim} />
      <BarRow
        values={bars}
        progress={progress}
        variant={variant}
        palette={variant.palette}
        reveal={reveal}
      />
      <LineSeries
        series={series}
        progress={progress}
        variant={variant}
        reveal={reveal}
      />
      <ValueCallout callouts={callouts} palette={variant.palette} />
      <TimelineAxis
        timeline={variant.timeline}
        palette={variant.palette}
        progress={progress}
        reveal={reveal}
      />
      <FilmFinish frame={frame} />
    </AbsoluteFill>
  );
};
