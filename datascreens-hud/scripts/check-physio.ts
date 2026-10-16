// Physiology check (step 5), from the code: run with `npm run check:physio`.
import {
  BEATS, BREATHS, ECG, LOOP_S, PLETH_DELAY, RR, R_TIMES, ecg, pleth, pulseRate, resp, spo2,
} from "../src/looks/vitalmonitor/physio";

const FPS = 30;
const FRAMES = 600;
let ok = true;
const check = (name: string, cond: boolean, detail: string) => {
  ok = ok && cond;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}: ${detail}`);
};

// fine time grid (1 ms) for shape analysis
const DT = 0.001;
const N = Math.round(LOOP_S / DT);
const e = Array.from({ length: N }, (_, i) => ecg(i * DT));
const p = Array.from({ length: N }, (_, i) => pleth(i * DT));

// 1. R spikes over 600 frames: local maxima above 0.6 on the 1 ms grid
const rPeaks: number[] = [];
for (let i = 0; i < N; i++) {
  const a = e[(i - 1 + N) % N];
  const b = e[i];
  const c = e[(i + 1) % N];
  if (b > 0.6 && b >= a && b > c) rPeaks.push(i * DT);
}
check("R spikes in 600 frames", rPeaks.length === BEATS, `${rPeaks.length} (expected ${BEATS})`);
const rrSum = RR.reduce((a, b) => a + b, 0);
check("R-R intervals sum", Math.abs(rrSum - LOOP_S) < 1e-9, `${rrSum.toFixed(12)} s`);
const bpm = RR.map((x) => 60 / x);
console.log(`      R-R range ${Math.min(...RR).toFixed(4)}-${Math.max(...RR).toFixed(4)} s, mean ${(60 / (LOOP_S / BEATS)).toFixed(2)} bpm, beat-to-beat ${Math.min(...bpm).toFixed(1)}-${Math.max(...bpm).toFixed(1)} bpm`);

// 2. per-beat P, QRS, T order and intervals
const findAround = (center: number, from: number, to: number, mode: "max" | "min") => {
  let best = mode === "max" ? -Infinity : Infinity;
  let at = 0;
  for (let s = from; s <= to; s += DT) {
    const v = ecg(center + s);
    if (mode === "max" ? v > best : v < best) {
      best = v;
      at = s;
    }
  }
  return { at, v: best };
};
const onset = (center: number, peakAt: number, dir: -1 | 1, frac: number, peakV: number) => {
  // walk away from the peak until the wave drops below frac of its height
  let s = peakAt;
  while (Math.abs(ecg(center + s)) > Math.abs(peakV) * frac) s += dir * DT;
  return s;
};
let beatsOk = 0;
const prs: number[] = [];
const qrss: number[] = [];
for (const R of R_TIMES) {
  const P = findAround(R, -0.3, -0.08, "max");
  const Q = findAround(R, -0.05, -0.005, "min");
  const S = findAround(R, 0.005, 0.06, "min");
  const T = findAround(R, 0.1, 0.38, "max");
  const pOn = onset(R, P.at, -1, 0.05, P.v);
  const qOn = onset(R, Q.at, -1, 0.05, Q.v);
  const sOff = onset(R, S.at, 1, 0.05, S.v);
  const order = P.at < Q.at && Q.at < 0 && 0 < S.at && S.at < T.at && P.v > 0.05 && T.v > 0.1 && Q.v < 0 && S.v < 0;
  if (order) beatsOk++;
  prs.push(qOn - pOn);
  qrss.push(sOff - qOn);
}
check("P, QRS, T in order on every beat", beatsOk === BEATS, `${beatsOk}/${BEATS}`);
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
check("PR interval ~0.16 s", Math.abs(avg(prs) - 0.16) < 0.02, `${avg(prs).toFixed(3)} s (design ${ECG.PR})`);
check("QRS ~0.08 s", Math.abs(avg(qrss) - 0.08) < 0.015, `${avg(qrss).toFixed(3)} s (design ${ECG.QRS})`);

// flat baseline between T end and next P onset
let flat = true;
for (let k = 0; k < BEATS; k++) {
  const R = R_TIMES[k];
  const next = R + RR[k];
  for (let s = R + 0.34; s < next - 0.215; s += DT) if (Math.abs(ecg(s)) > 0.01) flat = false;
}
check("flat baseline between beats", flat, flat ? "|v| < 0.01 between T and P" : "baseline not flat");

// 3. pleth: peak after each R by ~0.2 s upstroke, dicrotic notch
let plethOk = 0;
const lags: number[] = [];
for (const R of R_TIMES) {
  // upstroke start: first time after R where slope exceeds 5% of max slope
  let maxSlope = 0;
  for (let s = 0; s < 0.5; s += DT) maxSlope = Math.max(maxSlope, (pleth(R + s + DT) - pleth(R + s)) / DT);
  let up = 0;
  for (let s = 0.05; s < 0.5; s += DT) {
    if ((pleth(R + s + DT) - pleth(R + s)) / DT > 0.1 * maxSlope) {
      up = s;
      break;
    }
  }
  // peak
  let pk = 0;
  let pv = -1;
  for (let s = up; s < up + 0.3; s += DT) if (pleth(R + s) > pv) { pv = pleth(R + s); pk = s; }
  // notch: a local minimum followed by a local maximum on the downslope
  let notch = false;
  let prev = pleth(R + pk);
  let falling = true;
  let minV = 0;
  for (let s = pk + DT; s < pk + 0.45; s += DT) {
    const v = pleth(R + s);
    if (falling && v > prev) { falling = false; minV = prev; }
    else if (!falling && v < prev) { notch = prev - minV > 0.005 && minV > 0.1 * pv; break; }
    prev = v;
  }
  lags.push(up);
  if (notch && Math.abs(up - PLETH_DELAY) < 0.06) plethOk++;
}
check("pleth upstroke ~0.2 s after R with dicrotic notch", plethOk === BEATS, `${plethOk}/${BEATS}, mean upstroke lag ${avg(lags).toFixed(3)} s`);

// 4. respiration cycles: count upward crossings of 0.5 over 600 frames
let crossings = 0;
for (let f = 0; f < FRAMES * 10; f++) {
  const a = resp((f / 10) / FPS);
  const b = resp(((f + 1) / 10) / FPS);
  if (a < 0.5 && b >= 0.5) crossings++;
}
check("respiration cycles in 600 frames", crossings === BREATHS, `${crossings} (expected ${BREATHS})`);

// 5. PLS readout per frame within 98-100 and matching the actual beat rate
let plsMin = 999;
let plsMax = 0;
let plsMatch = true;
for (let f = 0; f < FRAMES; f++) {
  const t = f / FPS;
  const v = pulseRate(t);
  plsMin = Math.min(plsMin, v);
  plsMax = Math.max(plsMax, v);
  if (Math.abs(v - 99) > 1) plsMatch = false;
}
check("PLS reads 98-100", plsMin >= 98 && plsMax <= 100, `range ${plsMin}-${plsMax} (actual rate 33 beats / 20 s = 99 bpm)`);
check("PLS matches beat rate", plsMatch, "within 1 bpm of the true 99 bpm on every frame");
const sp = new Set(Array.from({ length: FRAMES }, (_, f) => spo2(f / FPS)));
check("SpO2 within 97-99", [...sp].every((v) => v >= 97 && v <= 99), `values ${[...sp].sort().join(", ")}`);
// loop continuity of signals
const cont = Math.abs(ecg(0) - ecg(LOOP_S)) + Math.abs(pleth(0) - pleth(LOOP_S)) + Math.abs(resp(0) - resp(LOOP_S));
check("signals periodic over 20 s", cont < 1e-9, `|f(0)-f(20)| sum = ${cont.toExponential(2)}`);

console.log(ok ? "\nALL PHYSIOLOGY CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(ok ? 0 : 1);
