/**
 * Counter values are pure functions of the frame number — no state, no
 * accumulation, because Remotion renders frames out of order across threads.
 *
 * The curve is an exponential ease-out (fast off the line, slowing hard) plus a
 * small linear term so the number never actually settles: at frame 600 all three
 * are still climbing.
 */
export type Metric = {
  label: string;
  /** Value the exponential term approaches. */
  target: number;
  /** Decay constant — higher means it slows down sooner. */
  k: number;
  /** Weight of the linear term that keeps it moving at the end. */
  drift: number;
};

export const METRICS: Metric[] = [
  {label: 'Views', target: 87412, k: 6.2, drift: 0.004},
  {label: 'Likes', target: 24860, k: 6.6, drift: 0.006},
  {label: 'Comments', target: 2190, k: 7.2, drift: 0.022},
];

export const counterValue = (
  metric: Metric,
  frame: number,
  durationInFrames: number,
): number => {
  const t = Math.max(0, Math.min(1, frame / durationInFrames));
  const eased = 1 - Math.exp(-metric.k * t);
  return metric.target * (eased * (1 - metric.drift) + metric.drift * t);
};

/**
 * Group digits in threes. Written out rather than using toLocaleString so the
 * output cannot depend on the ICU data of whatever Chrome renders the frame.
 */
export const formatCount = (value: number): string => {
  const digits = String(Math.floor(value));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      out += ',';
    }
    out += digits[i];
  }
  return out;
};
