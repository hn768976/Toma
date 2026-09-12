import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import {
  BEZEL,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  SALES_ROWS_PER_SECOND,
  TAPE_ROWS_PER_SECOND,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
} from "./constants";
import { Stage } from "./components/Stage";
import { ThemeProvider, useTheme } from "./components/ThemeContext";
import { buildFocusPrints } from "./data/market";
import { buildTape } from "./data/tape";
import { FOCUS_SYMBOL } from "./data/symbols";
import { themes } from "./theme";
import { ChartWindow } from "./windows/ChartWindow";
import { QuoteWindow } from "./windows/QuoteWindow";
import { TickerWindow } from "./windows/TickerWindow";

export const tradingFloorSchema = z.object({
  theme: z.enum(["dark", "light"]),
  /** Rows per second arriving in each of the six tape columns. */
  tapeRowsPerSecond: z.number().min(1).max(30),
  /** Rows per second in the time & sales blotter. */
  salesRowsPerSecond: z.number().min(1).max(30),
  /** Screen-realism overlays: vignette, scanlines and bloom. */
  screenTexture: z.boolean(),
});

export type TradingFloorProps = z.infer<typeof tradingFloorSchema>;

export const tradingFloorDefaults: TradingFloorProps = {
  theme: "dark",
  tapeRowsPerSecond: TAPE_ROWS_PER_SECOND,
  salesRowsPerSecond: SALES_ROWS_PER_SECOND,
  screenTexture: true,
};

const TAPE_SEEDS = [101, 211, 331, 457, 587, 719];

export const TradingFloor: React.FC<TradingFloorProps> = ({
  theme,
  tapeRowsPerSecond,
  salesRowsPerSecond,
  screenTexture,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = themes[theme];

  // The tapes are generated once for the whole clip and then sampled per
  // frame, so nothing here re-randomises as the video plays.
  const tapes = useMemo(
    () =>
      TAPE_SEEDS.map((seed) =>
        buildTape(seed, durationInFrames, tapeRowsPerSecond),
      ),
    [durationInFrames, tapeRowsPerSecond],
  );
  const focusPrints = useMemo(
    () => buildFocusPrints(9001, durationInFrames, salesRowsPerSecond),
    [durationInFrames, salesRowsPerSecond],
  );

  const right = WINDOW_WIDTH + BEZEL;
  const bottom = WINDOW_HEIGHT + BEZEL;

  return (
    <ThemeProvider theme={t}>
      <Stage background={t.desk}>
        <QuoteWindow
          frame={frame}
          x={0}
          y={0}
          width={WINDOW_WIDTH}
          height={WINDOW_HEIGHT}
          prints={focusPrints}
        />
        <ChartWindow
          frame={frame}
          x={right}
          y={0}
          width={WINDOW_WIDTH}
          height={WINDOW_HEIGHT}
          symbol={FOCUS_SYMBOL}
        />
        <TickerWindow
          frame={frame}
          x={0}
          y={bottom}
          width={WINDOW_WIDTH}
          height={WINDOW_HEIGHT}
          columns={tapes.slice(0, 3)}
          columnOffset={0}
        />
        <TickerWindow
          frame={frame}
          x={right}
          y={bottom}
          width={WINDOW_WIDTH}
          height={WINDOW_HEIGHT}
          columns={tapes.slice(3, 6)}
          columnOffset={3}
        />

        {screenTexture ? <ScreenTexture /> : null}
      </Stage>
    </ThemeProvider>
  );
};

// Vignette, a faint scanline grid and a low bloom, so the frame reads as
// a photographed monitor wall rather than a flat browser screenshot.
const ScreenTexture: React.FC = () => {
  const t = useTheme();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {t.bloomOpacity > 0 ? (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(70% 55% at 50% 45%, rgba(120,160,255,0.16), rgba(0,0,0,0) 70%)",
            opacity: t.bloomOpacity,
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, rgba(0,0,0,0.85) 0px, rgba(0,0,0,0.85) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)",
          opacity: t.scanlineOpacity,
        }}
      />
      <AbsoluteFill style={{ background: t.vignette }} />
      {/* Bezel seams between the four monitors. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: WINDOW_HEIGHT,
          width: DESIGN_WIDTH,
          height: BEZEL,
          background: t.desk,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: WINDOW_WIDTH,
          top: 0,
          width: BEZEL,
          height: DESIGN_HEIGHT,
          background: t.desk,
        }}
      />
    </AbsoluteFill>
  );
};
