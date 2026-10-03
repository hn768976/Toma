// One row per version. To add a version, add a row here; a <Composition>
// is registered for it in Root.tsx automatically. Everything else derives
// from the row. (Remotion composition ids may not contain "_", so ids use
// "-"; the rendered files are named with "_" as delivered.)

export type SignalLabel = "Buy" | "Strong buy" | "Sell" | "Neutral";

export type Version = {
  id: string;
  /** Seed for every random series in this version. */
  seed: number;
  /** Mean log-return per candle of the main price walk (negative = falling). */
  drift: number;
  /** Per-candle volatility of the main price walk. */
  vol: number;
  /** Price of the first generated candle. */
  startPrice: number;
  /** Drift per point of the big (left) area chart. */
  areaDrift: number;
  /** Drift per point of the small (right) area chart. */
  areaSmallDrift: number;
  /** Share of the 10 signal cells showing each label (held on every frame). */
  signalMix: Record<SignalLabel, number>;
};

export const VERSIONS: Record<string, Version> = {
  TradingTerminal_Bear: {
    id: "TradingTerminal-Bear",
    seed: 1016,
    drift: -0.0045,
    vol: 0.015,
    startPrice: 380,
    areaDrift: -0.0042,
    areaSmallDrift: 0.003,
    signalMix: { Sell: 0.5, Neutral: 0.2, Buy: 0.2, "Strong buy": 0.1 },
  },
  TradingTerminal_Bull: {
    id: "TradingTerminal-Bull",
    seed: 1052,
    drift: 0.0045,
    vol: 0.015,
    startPrice: 62,
    areaDrift: 0.0042,
    areaSmallDrift: -0.003,
    signalMix: { "Strong buy": 0.5, Buy: 0.2, Neutral: 0.2, Sell: 0.1 },
  },
};
