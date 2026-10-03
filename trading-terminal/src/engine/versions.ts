// One data row per version. Add a version by adding a row here; Root.tsx
// registers a composition for every row automatically.

export type ShotKind = "overview" | "orderbook" | "macro";
export type Rating = "Strong buy" | "Buy" | "Neutral" | "Sell";

export interface Version {
  id: string;
  shot: ShotKind;
  /** Seed for every random series in this version. */
  seed: number;
  /** Mean log-return per candle. Negative = bear, positive = bull. */
  drift: number;
  /** Std-dev of the per-candle shock (before momentum smoothing). */
  vol: number;
  /** AR(1) momentum of returns – higher = longer swings / bounces. */
  momentum: number;
  startPrice: number;
  /** Relative weights used when a signal row picks a new rating. */
  signalMix: Record<Rating, number>;
}

export const VERSIONS: Version[] = [
  {
    id: "TradingTerminal_Bear",
    shot: "overview",
    seed: 6,
    drift: -0.0017,
    vol: 0.0052,
    momentum: 0.5,
    startPrice: 41800,
    signalMix: { "Strong buy": 0.03, Buy: 0.1, Neutral: 0.2, Sell: 0.67 },
  },
  {
    id: "TradingTerminal_Bull",
    shot: "overview",
    seed: 2,
    drift: 0.0017,
    vol: 0.0052,
    momentum: 0.5,
    startPrice: 33200,
    signalMix: { "Strong buy": 0.55, Buy: 0.22, Neutral: 0.15, Sell: 0.08 },
  },
  {
    id: "OrderBook_Bear",
    shot: "orderbook",
    seed: 17,
    drift: -0.0016,
    vol: 0.0075,
    momentum: 0.55,
    startPrice: 40650,
    signalMix: { "Strong buy": 0.03, Buy: 0.1, Neutral: 0.2, Sell: 0.67 },
  },
  {
    id: "OrderBook_Bull",
    shot: "orderbook",
    seed: 9,
    drift: 0.0016,
    vol: 0.0075,
    momentum: 0.55,
    startPrice: 34480,
    signalMix: { "Strong buy": 0.55, Buy: 0.22, Neutral: 0.15, Sell: 0.08 },
  },
  {
    id: "IndicatorsMacro",
    shot: "macro",
    seed: 5519,
    drift: 0,
    vol: 0.0042,
    momentum: 0.35,
    startPrice: 3.42,
    signalMix: { "Strong buy": 0.22, Buy: 0.26, Neutral: 0.26, Sell: 0.26 },
  },
];

export const getVersion = (id: string) => {
  const v = VERSIONS.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown version ${id}`);
  return v;
};

/** Remotion composition id for a version (underscores are not allowed). */
export const compositionId = (id: string) => id.replace(/_/g, "-");
