import React from "react";
import {
  FPS,
  STATUS_BAR_HEIGHT,
  TAB_BAR_HEIGHT,
  TAPE_ROW_HEIGHT,
} from "../constants";
import {
  SegmentedControl,
  StatusBar,
  TabBar,
  Window,
} from "../components/Chrome";
import { TickerColumn } from "../panels/TickerColumn";
import { Print } from "../data/tape";

const SEGMENT_H = 22;
const HEADER_H = 24;

export const TickerWindow: React.FC<{
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: Print[][];
  columnOffset: number;
}> = ({ frame, x, y, width, height, columns, columnOffset }) => {
  const bodyH = height - TAB_BAR_HEIGHT - SEGMENT_H - STATUS_BAR_HEIGHT;
  const rows = Math.floor((bodyH - HEADER_H) / TAPE_ROW_HEIGHT);
  const columnWidth = width / columns.length;

  return (
    <Window x={x} y={y} width={width} height={height}>
      <TabBar active="Ticker" />
      <SegmentedControl active="All" />
      <div style={{ display: "flex", height: bodyH, overflow: "hidden" }}>
        {columns.map((prints, i) => (
          <TickerColumn
            key={i}
            frame={frame}
            prints={prints}
            rows={rows}
            width={columnWidth}
            columnIndex={columnOffset + i}
            showDivider={i > 0}
          />
        ))}
      </div>
      <StatusBar seconds={frame / FPS} />
    </Window>
  );
};
