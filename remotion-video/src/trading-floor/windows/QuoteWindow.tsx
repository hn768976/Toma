import React from "react";
import { STATUS_BAR_HEIGHT, TAB_BAR_HEIGHT, TOOLBAR_HEIGHT, FPS } from "../constants";
import { StatusBar, TabBar, Toolbar, Window } from "../components/Chrome";
import { DepthLadder } from "../panels/DepthLadder";
import { Gauges } from "../panels/Gauges";
import { IntradayChart } from "../panels/IntradayChart";
import { StatsGrid } from "../panels/StatsGrid";
import { TimeSales } from "../panels/TimeSales";
import { FocusPrint } from "../data/market";

const LADDER_W = 358;
const SALES_W = 332;
const GAUGE_W = 268;
const TOP_H = 300;

export const QuoteWindow: React.FC<{
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  prints: FocusPrint[];
}> = ({ frame, x, y, width, height, prints }) => {
  const bodyH = height - TAB_BAR_HEIGHT - TOOLBAR_HEIGHT - STATUS_BAR_HEIGHT;
  const bottomH = bodyH - TOP_H;

  return (
    <Window x={x} y={y} width={width} height={height}>
      <TabBar active="Quote" />
      <Toolbar />
      <div style={{ display: "flex", height: TOP_H }}>
        <DepthLadder frame={frame} width={LADDER_W} />
        <TimeSales frame={frame} width={SALES_W} prints={prints} />
        <Gauges frame={frame} width={GAUGE_W} />
      </div>
      <div style={{ display: "flex", height: bottomH }}>
        <StatsGrid frame={frame} width={LADDER_W} />
        <IntradayChart frame={frame} width={width - LADDER_W} height={bottomH} />
      </div>
      <StatusBar seconds={frame / FPS} />
    </Window>
  );
};
