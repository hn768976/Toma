import React from "react";
import { FPS, STATUS_BAR_HEIGHT } from "../constants";
import { StatusBar, Window } from "../components/Chrome";
import { CandleChart } from "../panels/CandleChart";
import { useTheme } from "../components/ThemeContext";

// The chart monitor sits a touch behind the others in the reference, so
// it carries a sub-pixel defocus. Kept small enough that 4K still reads
// as sharp.
export const ChartWindow: React.FC<{
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  symbol: string;
}> = ({ frame, x, y, width, height, symbol }) => {
  const t = useTheme();
  return (
    <Window
      x={x}
      y={y}
      width={width}
      height={height}
      filter={t.chartDefocusPx > 0 ? `blur(${t.chartDefocusPx}px)` : undefined}
    >
      <div style={{ background: t.chartBg, flex: 1 }}>
        <CandleChart
          frame={frame}
          width={width}
          height={height - STATUS_BAR_HEIGHT}
          symbol={symbol}
        />
      </div>
      <div style={{ background: t.chartBg }}>
        <StatusBar seconds={frame / FPS} />
      </div>
    </Window>
  );
};
