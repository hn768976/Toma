/**
 * The quote universe.
 *
 * Every number here is invented. `base` is the pair's notional previous
 * close: the displayed rate is always base * (1 + drift), the absolute
 * change is base * drift and the percentage is drift * 100, so the three
 * printed figures are derived from one value and cannot disagree.
 *
 * Nothing in this file is dated, and no broker, exchange or venue is named.
 * ISO 4217 currency codes are not trademarks; YEN is used in place of JPY
 * to match the informal styling of a public quote board.
 */

export type Pair = {
  readonly code: string;
  readonly base: number;
};

export const PAIRS: readonly Pair[] = [
  { code: "EUR/USD", base: 1.1072 },
  { code: "EUR/CHF", base: 0.9481 },
  { code: "USD/YEN", base: 151.44 },
  { code: "EUR/ZAR", base: 20.686 },
  { code: "EUR/TRY", base: 40.716 },
  { code: "EUR/SGD", base: 1.4327 },
  { code: "EUR/AED", base: 4.0276 },
  { code: "EUR/MXN", base: 21.487 },
  { code: "EUR/CAD", base: 1.5063 },
  { code: "EUR/GBP", base: 0.8372 },
  { code: "EUR/NOK", base: 11.173 },
  { code: "EUR/YEN", base: 161.37 },
  { code: "USD/CHF", base: 0.9587 },
  { code: "USD/CAD", base: 1.4309 },
  { code: "GBP/USD", base: 1.2748 },
  { code: "AUD/USD", base: 0.6531 },
  { code: "NZD/USD", base: 0.5904 },
  { code: "EUR/SEK", base: 11.482 },
  { code: "EUR/DKK", base: 7.4589 },
  { code: "EUR/PLN", base: 4.2718 },
  { code: "EUR/CZK", base: 25.126 },
  { code: "EUR/HUF", base: 397.42 },
  { code: "EUR/RON", base: 4.9762 },
  { code: "EUR/BGN", base: 1.9558 },
  { code: "EUR/ISK", base: 149.36 },
  { code: "EUR/INR", base: 92.145 },
  { code: "EUR/BRL", base: 6.0988 },
  { code: "EUR/CNY", base: 7.8559 },
  { code: "EUR/KRW", base: 1547.3 },
  { code: "EUR/AUD", base: 1.6558 },
  { code: "EUR/NZD", base: 1.8412 },
  { code: "EUR/HKD", base: 8.4127 },
  { code: "EUR/ILS", base: 3.9814 },
  { code: "EUR/THB", base: 37.482 },
  { code: "EUR/MYR", base: 4.8213 },
  { code: "EUR/TWD", base: 35.174 },
  { code: "EUR/PHP", base: 62.147 },
  { code: "EUR/CLP", base: 1042.6 },
  { code: "USD/GBP", base: 0.7846 },
  { code: "USD/SEK", base: 10.617 },
  { code: "USD/NOK", base: 10.468 },
  { code: "USD/MXN", base: 19.874 },
  { code: "USD/ZAR", base: 19.386 },
  { code: "USD/INR", base: 85.213 },
  { code: "USD/SGD", base: 1.3247 },
  { code: "USD/CNY", base: 7.2574 },
  { code: "GBP/CHF", base: 1.1207 },
  { code: "CHF/YEN", base: 159.62 },
] as const;

export const PAIR_COUNT = PAIRS.length;

/**
 * Decimal places for the rate, chosen from the magnitude the way a quote
 * board does: four for the sub-10 majors, three up to 100, two up to 1000,
 * one above. Derived from `base`, never from the live value, so the column
 * width can never change mid-tick.
 */
export const rateDecimals = (base: number): number => {
  const v = Math.abs(base);
  if (v < 10) return 4;
  if (v < 100) return 3;
  if (v < 1000) return 2;
  return 1;
};

/** The absolute change carries three decimals, two for four-figure rates. */
export const changeDecimals = (base: number): number =>
  Math.abs(base) < 1000 ? 3 : 2;
