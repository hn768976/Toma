import { AbsoluteFill } from "remotion";
import { TradingMacro } from "./TradingMacro";
import { BATCH } from "./batch";

/** Four tiles across so each composition's two palettes sit side by side. */
export const SHEET_COLUMNS = 4;
export const SHEET_TILE = { width: 960, height: 640 };

export const SHEET_SIZE = {
  width: SHEET_TILE.width * SHEET_COLUMNS,
  height: (SHEET_TILE.height * BATCH.length) / SHEET_COLUMNS,
};

export const ContactSheet: React.FC = () => (
  <AbsoluteFill
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(${SHEET_COLUMNS}, ${SHEET_TILE.width}px)`,
      gridAutoRows: `${SHEET_TILE.height}px`,
    }}
  >
    {BATCH.map((entry) => (
      <div
        key={`${entry.composition}-${entry.palette}`}
        style={{ position: "relative", overflow: "hidden" }}
      >
        <TradingMacro
          composition={entry.composition}
          palette={entry.palette}
          size={SHEET_TILE}
        />
      </div>
    ))}
  </AbsoluteFill>
);
