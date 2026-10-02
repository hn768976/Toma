/**
 * Balance Screen data. Every version is one row: change the figures or the
 * currency label here (e.g. add a EUR or GBP row) and register it in Root.tsx.
 * Amounts are in cents so the count never suffers float rounding.
 */
export type BalanceVersion = {
  id: string;
  startCents: number;
  endCents: number;
  currency: string;
};

export const BALANCE_VERSIONS: Record<"drain" | "grow", BalanceVersion> = {
  drain: { id: "BalanceScreen-Drain", startCents: 23090843, endCents: 0, currency: "USD" },
  grow: { id: "BalanceScreen-Grow", startCents: 0, endCents: 24856000, currency: "USD" },
};

/** Timing (frames at 30fps). Look 3 is one-way; it does NOT loop. */
export const DURATION = 300;
export const COUNT_START = 30;
export const COUNT_END = 210;

/** Format cents as 230,908.43, with correct thousands separators at every value. */
export const formatCents = (cents: number) => {
  const c = Math.max(0, Math.round(cents));
  const whole = Math.floor(c / 100);
  const frac = String(c % 100).padStart(2, "0");
  const digits = String(whole);
  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ",";
    grouped += digits[i];
  }
  return `${grouped}.${frac}`;
};

/** Ease-out: fast at first, slowing to land on the end value. */
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

export const centsAtFrame = (v: BalanceVersion, frame: number) => {
  if (frame <= COUNT_START) return v.startCents;
  if (frame >= COUNT_END) return v.endCents;
  const t = (frame - COUNT_START) / (COUNT_END - COUNT_START);
  return Math.round(v.startCents + (v.endCents - v.startCents) * easeOutQuart(t));
};
