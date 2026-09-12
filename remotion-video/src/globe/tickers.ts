import { FIELD_X, FIELD_Y, FIELD_Z_FAR, FIELD_Z_NEAR } from "./constants";
import { makeRng, pick, range } from "./rng";

const INDEX_NAMES = [
  "S&P 500", "FTSE 100 Index", "Dow Jones", "SZSE Component", "Hang Seng Index",
  "Nikkei 225", "US 30", "DAX", "CAC 40", "Nasdaq 100", "KOSPI", "Nifty 50",
  "Taiwan Weighted Index", "Vietnam Index", "SET 50", "Sensex", "ASX 200",
  "IBEX 35", "FTSE MIB", "Euro Stoxx 50", "Shanghai Composite", "BOVESPA",
  "S&P/TSX", "Straits Times", "JSE Top 40", "OMX 30", "SMI", "AEX",
  "MOEX Index", "TA-35", "PSEi", "Jakarta Composite", "Russell 2000",
  "FTSE China A50", "Nikkei Volatility", "KLCI",
] as const;

export type TickerKind = "label" | "chip" | "solid" | "number" | "arrow";

export type Ticker = {
  readonly kind: TickerKind;
  readonly label: string;
  readonly value: string;
  readonly up: boolean;
  /** Base position in master units; z is the position at frame 0. */
  readonly x: number;
  readonly y: number;
  readonly z0: number;
  /** Periodic sideways/vertical sway so the field never wraps visibly. */
  readonly swayX: number;
  readonly swayY: number;
  readonly phase: number;
  readonly fontScale: number;
  readonly dim: number;
};

const KINDS: { kind: TickerKind; weight: number }[] = [
  { kind: "label", weight: 32 },
  { kind: "chip", weight: 20 },
  { kind: "solid", weight: 17 },
  { kind: "number", weight: 23 },
  { kind: "arrow", weight: 10 },
];

const weightedKind = (rng: () => number): TickerKind => {
  const total = KINDS.reduce((a, k) => a + k.weight, 0);
  let r = rng() * total;
  for (const k of KINDS) {
    r -= k.weight;
    if (r <= 0) return k.kind;
  }
  return "label";
};

export const buildTickers = (count: number, seed: number): Ticker[] => {
  const rng = makeRng(seed);
  const out: Ticker[] = [];
  for (let i = 0; i < count; i++) {
    const up = rng() > 0.46;
    const magnitude = range(rng, 3, 99);
    out.push({
      kind: weightedKind(rng),
      label: pick(rng, INDEX_NAMES),
      value:
        rng() > 0.62
          ? `${up ? "+" : "-"}${range(rng, 0.05, 4.2).toFixed(2)}%`
          : magnitude.toFixed(2),
      up,
      x: range(rng, -FIELD_X, FIELD_X),
      y: range(rng, -FIELD_Y, FIELD_Y),
      // Spread evenly through the slab, then jitter, so density is uniform.
      z0: FIELD_Z_NEAR + ((i + rng()) / count) * (FIELD_Z_FAR - FIELD_Z_NEAR),
      swayX: range(rng, 18, 130),
      swayY: range(rng, 6, 46),
      phase: rng() * Math.PI * 2,
      fontScale: range(rng, 0.72, 1.45),
      dim: range(rng, 0.42, 0.98),
    });
  }
  return out;
};

export type Stream = {
  readonly y: number;
  readonly z: number;
  readonly dotGap: number;
  readonly speed: number;
  readonly phase: number;
  readonly alpha: number;
};

/** Long dotted horizontal lines that give the field its perspective grid. */
export const buildStreams = (count: number, seed: number): Stream[] => {
  const rng = makeRng(seed);
  const out: Stream[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      y: range(rng, -FIELD_Y * 1.25, FIELD_Y * 1.25),
      z: range(rng, 1400, FIELD_Z_FAR),
      dotGap: range(rng, 34, 90),
      // Whole cycles per loop keeps the dash scroll seamless.
      speed: Math.round(range(rng, 1, 4)) * (rng() > 0.5 ? 1 : -1),
      phase: rng(),
      alpha: range(rng, 0.2, 0.75),
    });
  }
  return out;
};
