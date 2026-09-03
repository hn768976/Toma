import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { getLayout } from "./layout";
import { Axes } from "./parts/Axes";
import { Grid } from "./parts/Grid";
import { XLabels, YLabels } from "./parts/Labels";
import { SeriesBars, barStartFrame } from "./parts/SeriesBars";
import { SeriesLine, lineCrossingFrame } from "./parts/SeriesLine";
import { TitleBlock } from "./parts/TitleBlock";
import { THEMES, textInk, type ThemeName } from "./theme";

export type ChartVariant = "line" | "bar" | "area";

export type DataChartProps = {
  variant: ChartVariant;
  theme: ThemeName;
};

/**
 * One build, four products: line / bar / area on a dark ground, and the light
 * mode line chart. Everything is flat SVG in the frame's own coordinate space,
 * so the 1080p preview and the 4K render are the same picture.
 */
export const DataChart: React.FC<DataChartProps> = ({ variant, theme }) => {
  const { width, height } = useVideoConfig();
  const layout = getLayout(width, height);
  const palette = THEMES[theme];
  const ink = textInk(theme);
  const idPrefix = `${variant}-${theme}`;

  const crossedAt =
    variant === "bar"
      ? (i: number) => barStartFrame(i)
      : (i: number) => lineCrossingFrame(layout, i);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <Grid layout={layout} theme={palette} />
        <Axes layout={layout} theme={palette} />
        <YLabels layout={layout} theme={palette} ink={ink} />
        <XLabels
          layout={layout}
          theme={palette}
          ink={ink}
          crossedAt={crossedAt}
        />
        {variant === "bar" ? (
          <SeriesBars layout={layout} theme={palette} idPrefix={idPrefix} />
        ) : (
          <SeriesLine
            layout={layout}
            theme={palette}
            withArea={variant === "area"}
            idPrefix={idPrefix}
          />
        )}
        <TitleBlock layout={layout} theme={palette} ink={ink} />
      </svg>
    </AbsoluteFill>
  );
};
