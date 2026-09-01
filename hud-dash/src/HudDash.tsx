import React from "react";
import { AbsoluteFill } from "remotion";
import { WIDTH } from "./constants";
import { LAYOUT, mirrorRect, stack } from "./layout";
import { Backdrop } from "./components/Backdrop";
import { CentreDial } from "./components/CentreDial";
import { CornerPods } from "./components/CornerPods";
import { Finish } from "./components/Finish";
import { CentrePieRow } from "./components/PieRow";
import { RingGauge } from "./components/RingGauge";
import { SidePanel } from "./components/SidePanel";
import { TickRail } from "./components/TickRail";
import { VARIANTS, type VariantName } from "./variants";

export type HudDashProps = { variant: VariantName };

/**
 * Flat, frontal, left-right symmetrical HUD dashboard.
 *
 * The two columns occupy mirrored rectangles and the two flanking gauges sit
 * at mirrored centres, but every panel's CONTENT differs side to side — the
 * symmetry is compositional, not a reflection.
 *
 * There is no camera move, no tilt and no perspective anywhere.
 */
export const HudDash: React.FC<HudDashProps> = ({ variant }) => {
  const v = VARIANTS[variant];
  const leftCol = LAYOUT.columns.left;
  const rightCol = mirrorRect(leftCol);

  const leftRects = stack(leftCol, v.panels.left.length, LAYOUT.columns.gap);
  const rightRects = stack(rightCol, v.panels.right.length, LAYOUT.columns.gap);
  const panelCount = v.panels.left.length + v.panels.right.length;

  return (
    <AbsoluteFill style={{ backgroundColor: v.palette.bgDeep, overflow: "hidden" }}>
      <Backdrop variant={v} />

      <TickRail variant={v} edge="top" />
      <TickRail variant={v} edge="bottom" />

      <CornerPods
        rect={LAYOUT.pods.left}
        seed={`${v.name}-podL`}
        labels={["ALPHA", "BETA"]}
        variant={v}
        align="left"
      />
      <CornerPods
        rect={mirrorRect(LAYOUT.pods.left)}
        seed={`${v.name}-podR`}
        labels={["GAMMA", "DELTA"]}
        variant={v}
        align="right"
      />

      {v.panels.left.map((spec, i) => (
        <SidePanel
          key={`L${spec.code}`}
          rect={leftRects[i]}
          spec={spec}
          variant={v}
          index={i}
          panelCount={panelCount}
        />
      ))}
      {v.panels.right.map((spec, i) => (
        <SidePanel
          key={`R${spec.code}`}
          rect={rightRects[i]}
          spec={spec}
          variant={v}
          index={v.panels.left.length + i}
          panelCount={panelCount}
        />
      ))}

      <RingGauge
        cx={LAYOUT.gauge.cx}
        cy={LAYOUT.gauge.cy}
        r={LAYOUT.gauge.r}
        seed={`${v.name}-gaugeL`}
        label="PORT"
        variant={v}
      />
      <RingGauge
        cx={WIDTH - LAYOUT.gauge.cx}
        cy={LAYOUT.gauge.cy}
        r={LAYOUT.gauge.r}
        seed={`${v.name}-gaugeR`}
        label="STBD"
        variant={v}
      />

      <CentreDial variant={v} />
      <CentrePieRow variant={v} />

      <Finish variant={v} />
    </AbsoluteFill>
  );
};
