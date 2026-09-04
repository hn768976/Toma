/** Two decimals, thousands-separated — the way a terminal prints a last price. */
export const formatPrice = (value: number): string =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Always signed, so the readout width never jumps when it crosses zero. */
export const formatChange = (value: number): string =>
  `${value < 0 ? "−" : "+"}${formatPrice(Math.abs(value))}`;

export const formatPercent = (value: number): string =>
  `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(2)}%`;

/** True tabular figures, so digits swapping never shifts the layout. */
export const TABULAR = {
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum" 1',
} as const;
