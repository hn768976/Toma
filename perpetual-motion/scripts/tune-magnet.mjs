// Solves Wilkins' ramp cycle: the speed the ball leaves the J-curl with (the
// chute's physics decides it), and the crawl speed on the climb for which the
// whole cycle lasts exactly RAMP.period. Prints the constant for magnet.spec.ts.
import { RAMP, simulate } from "../src/machines/magnet.spec.ts";

// for each pull scale, the J-curl's exit speed is a fixed point of the cycle
const closed = (crawl) => {
  let v0 = 120;
  let c;
  for (let i = 0; i < 40; i++) {
    c = simulate(crawl, v0);
    if (!c.ok || Math.abs(c.vEnd - v0) < 1e-9) break;
    v0 = c.vEnd;
  }
  return { ...c, v0 };
};
const TARGET = Number(process.argv[2] ?? RAMP.period);
let lo = 0.2, hi = 60;
for (let i = 0; i < 80; i++) {
  const mid = (lo + hi) / 2;
  const c = closed(mid);
  if (c.T > TARGET) lo = mid;
  else hi = mid;
}
const c = closed(hi);
// (the cycle is played over RAMP.period frames by fraction, so a natural period
// shorter than RAMP.period is the same physics on a proportionally larger machine)
console.log(JSON.stringify({ crawl: hi, v0: c.v0, T: c.T, vEnd: c.vEnd, closes: Math.abs(c.vEnd - c.v0), minRampSpeed: c.minRampSpeed, ok: c.ok }));
