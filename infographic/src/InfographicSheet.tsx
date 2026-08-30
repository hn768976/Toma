import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { getVariant } from "./theme";
import { getLayout, type PanelSpec } from "./layout";
import { CLIMB_END, CLIMB_START, planeMatrix } from "./plane";
import { SheetPlane } from "./components/SheetPlane";
import { DonutChart } from "./components/DonutChart";
import { BarChart } from "./components/BarChart";
import { LineChart } from "./components/LineChart";
import { PieChart } from "./components/PieChart";
import { TextBlock } from "./components/TextBlock";
import { ValueRow } from "./components/ValueRow";
import { YearCounter } from "./components/YearCounter";

/**
 * The ONE shared, normalised timeline.
 *
 * Frames 0-20 sit at zero, 20-420 climb with a slight ease, 420-450 hold. Every
 * donut, bar, line, wedge, value row and the year counter itself is a function
 * of this single number, so the whole sheet advances as one dataset.
 */
export const timelineAt = (frame: number) =>
  interpolate(frame, [CLIMB_START, CLIMB_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    // A slight ease: mostly linear, with softened ends.
    easing: (x) => 0.62 * x + 0.38 * (x * x * (3 - 2 * x)),
  });

const renderPanel = (panel: PanelSpec) => {
  switch (panel.kind) {
    case "donut":
      return <DonutChart key={panel.id} panel={panel} />;
    case "bar":
      return <BarChart key={panel.id} panel={panel} />;
    case "line":
      return <LineChart key={panel.id} panel={panel} />;
    case "pie":
      return <PieChart key={panel.id} panel={panel} />;
    case "text":
      return <TextBlock key={panel.id} panel={panel} />;
    case "valueRows":
      return <ValueRow key={panel.id} panel={panel} />;
    case "counter":
      return <YearCounter key={panel.id} panel={panel} />;
    default:
      return null;
  }
};

export const InfographicSheet: React.FC<{ variant: string }> = ({
  variant: variantName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const variant = getVariant(variantName);
  const panels = getLayout(variant.layoutMode);

  const t = timelineAt(frame);
  const tPrev = timelineAt(Math.max(0, frame - 1));

  // A gentle, constant drift along the plane's own axis, so new content enters
  // and old content leaves. No zoom, no rotation change.
  const driftProgress = interpolate(frame, [0, 450], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const matrix = planeMatrix(
    variant.tilt,
    variant.drift.fromU +
      (variant.drift.toU - variant.drift.fromU) * driftProgress,
    variant.drift.fromV +
      (variant.drift.toV - variant.drift.fromV) * driftProgress,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: variant.palette.background }}>
      <SheetPlane
        variant={variant}
        matrix={matrix}
        t={t}
        tPrev={tPrev}
        frame={frame}
        fps={fps}
      >
        {panels.map(renderPanel)}
      </SheetPlane>
    </AbsoluteFill>
  );
};
