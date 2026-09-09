import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Badge } from "./components/Badge";
import { ChartCard } from "./components/ChartCard";
import { EcgLine } from "./components/EcgLine";
import { Footnote } from "./components/Footnote";
import { Grain } from "./components/Grain";
import { Heading } from "./components/Heading";
import { StatRow } from "./components/StatRow";
import { buildLayout } from "./layout";
import { THEMES, type StyleName } from "./theme";
import { accentFor, type Topic } from "./topics";

export type ReportDashboardProps = {
  topic: Topic;
  style: StyleName;
  /** Namespaces the SVG defs so two instances can share a page in the Studio. */
  idPrefix: string;
};

/**
 * The whole piece. Layout, timing and structure are fixed; everything that
 * carries subject identity — copy, numbers, curve, accent — arrives as props,
 * so a new topic is a data entry in topics.ts and nothing more.
 */
export const ReportDashboard: React.FC<ReportDashboardProps> = ({
  topic,
  style,
  idPrefix,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const layout = buildLayout(width, height);
  const theme = THEMES[style];
  const accent = accentFor(topic, style);

  return (
    <AbsoluteFill style={{ background: theme.page }}>
      {/* A barely-there warm lift behind the title, so the ground is not a
          flat fill. Kept well under the threshold where it reads as a
          gradient in its own right. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(130% 95% at 50% 16%, ${theme.pageTint} 0%, transparent 68%)`,
        }}
      />

      {/* And a faint settling of tone toward the bottom, so the ECG sits on
          ground rather than floating on a flat fill. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, transparent 52%, ${theme.pageShade} 100%)`,
        }}
      />

      <Badge
        text={topic.category}
        accent={accent}
        layout={layout}
        frame={frame}
      />
      <Heading
        title={topic.title}
        subtitle={topic.subtitle}
        theme={theme}
        layout={layout}
        frame={frame}
      />
      <ChartCard
        label={topic.chartLabel}
        data={topic.chartData}
        theme={theme}
        accent={accent}
        layout={layout}
        frame={frame}
        seed={topic.markerSeed}
        markerCount={topic.markerCount}
        idPrefix={idPrefix}
      />
      <StatRow
        stats={topic.stats}
        theme={theme}
        accent={accent}
        layout={layout}
        frame={frame}
      />
      <Footnote
        text={topic.footnote}
        theme={theme}
        layout={layout}
        frame={frame}
      />
      <EcgLine theme={theme} layout={layout} frame={frame} />

      <Grain opacity={theme.grain} frame={frame} id={`${idPrefix}-grain`} />
    </AbsoluteFill>
  );
};
