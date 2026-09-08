import { DURATION_IN_FRAMES } from "../constants";
import { rngFor } from "../random";
import type { IconKind } from "../icons/Icons";

export type Instrument = {
  name: string;
  icon: IconKind;
  /** Reference level the percentage change is measured against. Invented. */
  prevClose: number;
  decimals: number;
  /** Colour of the icon tile. */
  accent: string;
};

export type Section = {
  title: string;
  instruments: readonly Instrument[];
};

/**
 * Every number here is invented. Magnitudes are plausible for the instrument
 * (crude in the tens, gold in the thousands, grains in the hundreds) but the
 * board carries no date, no timestamp and no venue, so it makes no claim to be
 * real market data.
 */
export const SECTIONS: readonly Section[] = [
  {
    title: "ENERGY",
    instruments: [
      { name: "BRENT CRUDE", icon: "barrel", prevClose: 78.42, decimals: 2, accent: "#3f6fd8" },
      { name: "WTI CRUDE", icon: "droplet", prevClose: 74.86, decimals: 2, accent: "#3f8fd8" },
      { name: "NATURAL GAS", icon: "flame", prevClose: 3.184, decimals: 3, accent: "#e0532f" },
      { name: "HEATING OIL", icon: "burner", prevClose: 2.472, decimals: 3, accent: "#8a5a34" },
      { name: "GASOIL", icon: "canister", prevClose: 742.3, decimals: 2, accent: "#d8a12a" },
      { name: "COAL", icon: "lump", prevClose: 129.55, decimals: 2, accent: "#6f5b48" },
      { name: "ELECTRICITY", icon: "bolt", prevClose: 94.2, decimals: 2, accent: "#f2c528" },
      { name: "LNG", icon: "tank", prevClose: 12.38, decimals: 2, accent: "#20b3a4" },
    ],
  },
  {
    title: "METALS",
    instruments: [
      { name: "GOLD", icon: "disc", prevClose: 2345.8, decimals: 2, accent: "#d4a531" },
      { name: "SILVER", icon: "disc", prevClose: 28.42, decimals: 3, accent: "#b3bdc7" },
      { name: "COPPER", icon: "ingot", prevClose: 4.27, decimals: 3, accent: "#c0703f" },
      { name: "PLATINUM", icon: "ingot", prevClose: 968.4, decimals: 2, accent: "#8fa3b8" },
    ],
  },
  {
    title: "AGRICULTURE",
    instruments: [
      { name: "WHEAT", icon: "wheat", prevClose: 589.25, decimals: 2, accent: "#cfa53c" },
      { name: "CORN", icon: "corn", prevClose: 442.75, decimals: 2, accent: "#e3b423" },
      { name: "SOYBEANS", icon: "bean", prevClose: 1148.5, decimals: 2, accent: "#6ba24a" },
      { name: "COTTON", icon: "boll", prevClose: 71.86, decimals: 2, accent: "#b8c4ce" },
      { name: "SUGAR", icon: "cube", prevClose: 19.34, decimals: 2, accent: "#d0b98f" },
      { name: "COFFEE", icon: "coffee", prevClose: 236.55, decimals: 2, accent: "#7a4a2b" },
    ],
  },
  {
    title: "CRYPTO",
    instruments: [
      { name: "BITCOIN", icon: "hexagon", prevClose: 61480, decimals: 0, accent: "#f0921e" },
      { name: "ETHEREUM", icon: "diamond", prevClose: 3142.6, decimals: 2, accent: "#7a86e8" },
    ],
  },
];

export type Slot =
  | { kind: "bar"; title: string }
  | {
      kind: "row";
      instrument: Instrument;
      model: PriceModel;
      /** Position among the cycle's rows; drives the alternating row tint. */
      rowIndex: number;
    };

/**
 * How a row's number behaves over the loop.
 *
 * Price, percentage and direction marker are all read off ONE underlying
 * value - the percentage change - so they can never disagree. `tickPeriod`
 * divides 480, and every wave frequency is a whole number of cycles per loop,
 * so the whole schedule repeats exactly at frame 480.
 */
export type PriceModel = {
  tickPeriod: number;
  tickPhase: number;
  bias: number;
  waves: readonly { amp: number; cycles: number; phase: number }[];
};

/** Tick periods all divide 480, so no row is mid-tick when the loop wraps. */
const TICK_PERIODS = [10, 12, 15, 16, 20, 24] as const;

const buildModel = (name: string): PriceModel => {
  const rng = rngFor(`price:${name}`);
  const tickPeriod = TICK_PERIODS[Math.floor(rng() * TICK_PERIODS.length)];
  const tickPhase = Math.floor(rng() * tickPeriod);
  const ticksPerLoop = DURATION_IN_FRAMES / tickPeriod;

  // A handful of rows sit close to the flat line so they cross zero during the
  // loop and visibly flip direction, marker and colour.
  const crosses = rng() < 0.4;
  const bias = crosses ? (rng() - 0.5) * 0.22 : (rng() - 0.5) * 2.1;
  const headroom = 2.9 - Math.abs(bias);

  // Frequencies are whole cycles per loop, capped so the fastest wave still
  // gets ~6 ticks per cycle: the number drifts and wobbles rather than
  // flickering pseudo-randomly.
  const maxCycles = Math.max(2, Math.floor(ticksPerLoop / 6));
  const amps = [0.52, 0.3, 0.18].map((f) => f * headroom * (0.55 + rng() * 0.45));
  const waves = amps.map((amp, i) => ({
    amp,
    cycles: 1 + i + Math.floor(rng() * maxCycles),
    phase: rng() * Math.PI * 2,
  }));

  return { tickPeriod, tickPhase, bias, waves };
};

/**
 * One full scroll cycle: 4 section bars + 20 instrument rows. The row count is
 * even, so the alternating tint stays in phase from one cycle to the next.
 */
export const SLOTS: readonly Slot[] = (() => {
  let rowIndex = 0;
  return SECTIONS.flatMap((section): Slot[] => [
    { kind: "bar", title: section.title },
    ...section.instruments.map(
      (instrument): Slot => ({
        kind: "row",
        instrument,
        model: buildModel(instrument.name),
        rowIndex: rowIndex++,
      }),
    ),
  ]);
})();
