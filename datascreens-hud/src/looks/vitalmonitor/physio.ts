import { mulberry32 } from "../../lib/random";

// Illustrative physiology, every value a pure function of time t (seconds).
// 99 bpm = exactly 33 beats in the 20 s loop; 18 breaths/min = 6 in 20 s.

export const LOOP_S = 20;
export const BEATS = 33;
export const BREATHS = 6;
export const SWEEP_S = 5; // one sweep across the screen; 4 per loop

// R-R intervals: tiny seeded variation, normalised to sum to exactly 20 s.
const rrRng = mulberry32(0x0c99b9);
const raw = Array.from({ length: BEATS }, () => 1 + 0.009 * (rrRng() * 2 - 1));
const rawSum = raw.reduce((a, b) => a + b, 0);
export const RR: number[] = raw.map((v) => (v / rawSum) * LOOP_S);
// fix float drift so the sum is 20 to the last bit we can manage
RR[BEATS - 1] = LOOP_S - RR.slice(0, BEATS - 1).reduce((a, b) => a + b, 0);

const R0 = 0.37;
export const R_TIMES: number[] = [];
{
  let acc = R0;
  for (let k = 0; k < BEATS; k++) {
    R_TIMES.push(acc);
    acc += RR[k];
  }
}

// ECG timing (seconds relative to the R peak)
export const ECG = {
  P: { at: -0.152, sd: 0.023, amp: 0.13 }, // P onset ~ -0.20 s
  Q: { at: -0.022, sd: 0.0062, amp: -0.11 },
  R: { at: 0, sd: 0.0102, amp: 1.0 },
  S: { at: 0.023, sd: 0.0068, amp: -0.14 },
  T: { at: 0.235, sdL: 0.048, sdR: 0.038, amp: 0.32 },
  PR: 0.16, // P onset -> QRS onset
  QRS: 0.08,
};

export const PLETH_DELAY = 0.2; // upstroke starts 0.2 s after R

const wrap = (x: number) => {
  // to [-LOOP_S/2, LOOP_S/2)
  let d = x % LOOP_S;
  if (d < -LOOP_S / 2) d += LOOP_S;
  if (d >= LOOP_S / 2) d -= LOOP_S;
  return d;
};

const g = (x: number, mu: number, sd: number) => {
  const z = (x - mu) / sd;
  return Math.exp(-0.5 * z * z);
};
const ag = (x: number, mu: number, sdL: number, sdR: number) => g(x, mu, x < mu ? sdL : sdR);

/** index of the nearest R peak and the signed offset to it */
const nearestBeat = (t: number) => {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < BEATS; k++) {
    const d = wrap(t - R_TIMES[k]);
    if (Math.abs(d) < Math.abs(bestD)) {
      bestD = d;
      best = k;
    }
  }
  return { k: best, d: bestD };
};

/** Lead II ECG, roughly in mV. Flat baseline between beats. */
export const ecg = (t: number) => {
  let v = 0;
  for (let k = 0; k < BEATS; k++) {
    const d = wrap(t - R_TIMES[k]);
    if (d < -0.35 || d > 0.45) continue;
    v += ECG.P.amp * g(d, ECG.P.at, ECG.P.sd);
    v += ECG.Q.amp * g(d, ECG.Q.at, ECG.Q.sd);
    v += ECG.R.amp * g(d, ECG.R.at, ECG.R.sd);
    v += ECG.S.amp * g(d, ECG.S.at, ECG.S.sd);
    v += ECG.T.amp * ag(d, ECG.T.at, ECG.T.sdL, ECG.T.sdR);
  }
  return v;
};

/** Pleth: one rounded peak per beat, upstroke 0.2 s after R, dicrotic notch. 0..~1 */
export const pleth = (t: number) => {
  let v = 0;
  for (let k = 0; k < BEATS; k++) {
    const tau = wrap(t - R_TIMES[k] - PLETH_DELAY);
    if (tau < -0.2 || tau > 1.0) continue;
    v += 1.0 * ag(tau, 0.15, 0.06, 0.085); // systolic peak
    v += 0.2 * g(tau, 0.35, 0.038); // dicrotic wave (notch just before it)
    v += 0.17 * g(tau, 0.42, 0.12); // diastolic run-off
  }
  return v;
};

/** Respiration: 6 cycles per loop, inspiration ~40% of the cycle. 0..1 */
export const resp = (t: number) => {
  const period = LOOP_S / BREATHS;
  const ph = (((t % period) + period) % period) / period;
  return ph < 0.4 ? 0.5 - 0.5 * Math.cos((Math.PI * ph) / 0.4) : 0.5 + 0.5 * Math.cos((Math.PI * (ph - 0.4)) / 0.6);
};

/** index of the last R peak at or before t (cyclic) */
export const lastBeat = (t: number) => {
  const tt = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  let k = BEATS - 1; // before R_TIMES[0] the last beat is the previous loop's final one
  for (let i = 0; i < BEATS; i++) if (R_TIMES[i] <= tt) k = i;
  return k;
};

/** displayed pulse: rate from the last 4 R-R intervals, whole numbers */
export const pulseRate = (t: number) => {
  const k = lastBeat(t);
  let sum = 0;
  for (let j = 0; j < 4; j++) sum += RR[(k - 1 - j + BEATS * 2) % BEATS];
  return Math.round(60 / (sum / 4));
};

/** seconds since the last R peak */
export const sinceBeat = (t: number) => {
  const tt = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  const k = lastBeat(tt);
  return ((tt - R_TIMES[k]) % LOOP_S + LOOP_S) % LOOP_S;
};

const SPO2_STEPS: [number, number][] = [
  [0, 98],
  [3.6, 99],
  [8.2, 98],
  [12.4, 97],
  [15.6, 98],
];
export const spo2 = (t: number) => {
  const tt = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  let v = SPO2_STEPS[0][1];
  for (const [at, val] of SPO2_STEPS) if (tt >= at) v = val;
  return v;
};

export const RESP_RATE = 18;

export { nearestBeat };
