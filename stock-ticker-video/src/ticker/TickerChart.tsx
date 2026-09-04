import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY } from "../load-fonts";
import { Chart } from "./Chart";
import { Chrome } from "./Chrome";
import { HEADER_FADE_FRAMES } from "./constants";
import { buildLayout, buildScale, nearestMinute, playheadAt } from "./geometry";
import { Readout } from "./Readout";
import { ScreenOptics } from "./ScreenOptics";
import { buildSeries } from "./series";
import type { TickerVariant } from "./themes";

export const TickerChart: React.FC<{ variant: TickerVariant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { palette, series: seriesConfig } = variant;

  // Every size below is a fraction of the frame, so the composition can be
  // rendered at any scale and stay identical.
  const layout = React.useMemo(() => buildLayout(width, height), [width, height]);
  const values = React.useMemo(() => buildSeries(seriesConfig), [seriesConfig]);
  const scale = React.useMemo(
    () => buildScale(values, seriesConfig.prevClose, layout),
    [values, seriesConfig.prevClose, layout],
  );

  const head = playheadAt(frame, values, scale);
  const change = head.value - seriesConfig.prevClose;
  const changePercent = (change / seriesConfig.prevClose) * 100;

  const headerOpacity = interpolate(frame, [0, HEADER_FADE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const screen = (
    <AbsoluteFill style={{ background: palette.background }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: height * 0.268,
          background: palette.panel,
        }}
      />
      <Chart
        values={values}
        prevClose={seriesConfig.prevClose}
        scale={scale}
        layout={layout}
        palette={palette}
        head={head}
        fontFamily={FONT_FAMILY}
      />
      <Chrome
        layout={layout}
        palette={palette}
        fontFamily={FONT_FAMILY}
        price={head.value}
        change={change}
        changePercent={changePercent}
        minuteIndex={nearestMinute(head)}
        headerOpacity={headerOpacity}
      />
      <Readout
        layout={layout}
        palette={palette}
        fontFamily={FONT_FAMILY}
        head={head}
        change={change}
        changePercent={changePercent}
        opacity={headerOpacity}
      />
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ background: palette.background }}>
      <ScreenOptics layout={layout} palette={palette}>
        {screen}
      </ScreenOptics>
    </AbsoluteFill>
  );
};
