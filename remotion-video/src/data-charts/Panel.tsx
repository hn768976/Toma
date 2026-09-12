import React from "react";
import { useCurrentFrame } from "remotion";
import { GRID_CELL, PANEL_HEIGHT, PANEL_WIDTH } from "./constants";
import { UI_FONT } from "./fonts";
import { buildIn } from "./motion";
import type { PanelSpec } from "./layout";
import { ROW_BLUR } from "./layout";
import type { Theme } from "./themes";
import { RadialGauge } from "./panels/RadialGauge";
import { BarChart } from "./panels/BarChart";
import { LineChart } from "./panels/LineChart";
import { SignalArea } from "./panels/SignalArea";
import { Spectrum } from "./panels/Spectrum";
import { Globe } from "./panels/Globe";
import { DataTable } from "./panels/DataTable";
import { Donut } from "./panels/Donut";
import { HeatGrid } from "./panels/HeatGrid";

const PAD = 24;
const HEADER = 40;

type Props = { spec: PanelSpec; theme: Theme };

// One glass tile on the floor: fine grid, header strip, and a chart that
// fills the rest. Blur comes from the panel's row (depth of field).
export const Panel: React.FC<Props> = ({ spec, theme }) => {
  const frame = useCurrentFrame();
  const appear = buildIn(frame, spec.delay, 18);
  const cw = PANEL_WIDTH - PAD * 2;
  const ch = PANEL_HEIGHT - HEADER - PAD;
  const chart = { width: cw, height: ch, theme, delay: spec.delay, seed: spec.seed };

  const blur = ROW_BLUR[spec.row] ?? 0;

  let content: React.ReactNode;
  switch (spec.kind) {
    case "gauge":
      content = <RadialGauge {...chart} value={0.72} />;
      break;
    case "gauge-plain":
      content = <RadialGauge {...chart} value={0.58} showValue={false} />;
      break;
    case "bars":
      content = <BarChart {...chart} />;
      break;
    case "lines":
      content = <LineChart {...chart} />;
      break;
    case "signal":
      content = <SignalArea {...chart} />;
      break;
    case "spectrum":
      content = <Spectrum {...chart} />;
      break;
    case "globe":
      content = <Globe {...chart} />;
      break;
    case "table":
      content = <DataTable {...chart} />;
      break;
    case "donut":
      content = <Donut {...chart} />;
      break;
    case "heat":
    default:
      content = <HeatGrid {...chart} />;
      break;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: spec.x,
        top: spec.y,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        borderRadius: 8,
        background: theme.panelFill,
        backgroundImage: `linear-gradient(${theme.panelGridLine} 1px, transparent 1px), linear-gradient(90deg, ${theme.panelGridLine} 1px, transparent 1px)`,
        backgroundSize: `${GRID_CELL}px ${GRID_CELL}px`,
        boxShadow: `inset 0 0 0 1px ${theme.panelBorder}, 0 0 48px ${theme.panelGlow}`,
        opacity: appear,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        overflow: "hidden",
        transform: `translateY(${(1 - appear) * 24}px)`,
      }}
    >
      {/* Header strip */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 0,
          height: HEADER,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: UI_FONT,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: theme.textDim,
          borderBottom: `1px solid ${theme.panelBorder}`,
        }}
      >
        <span>{spec.title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 7,
              background: theme.accentAlt,
              boxShadow: `0 0 8px ${theme.accentAlt}`,
              opacity: 0.6 + 0.4 * Math.sin((frame + spec.seed * 9) * 0.2),
            }}
          />
          <span style={{ color: theme.highlight, fontSize: 14, lineHeight: 1 }}>+</span>
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: PAD,
          top: HEADER + 8,
          width: cw,
          height: ch - 8,
        }}
      >
        {content}
      </div>
    </div>
  );
};
