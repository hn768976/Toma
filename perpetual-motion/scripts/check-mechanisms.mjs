// Mechanism checks read from the code's own models (verify step 5), plus the
// in-plane rotation check (step 4): a turning circle must stay on one ellipse.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { root } from "./render-lib.mjs";

const out = join(root, "renders", ".mech-entry.mjs");
await build({ entryPoints: [join(root, "scripts", "mech-entry.ts")], bundle: true, platform: "node", format: "esm", jsx: "automatic", outfile: out, logLevel: "error" });
const M = await import(pathToFileURL(out).href);
const LOOP = 600;
const ok = (c) => (c ? "PASS" : "FAIL");
const mod = (a, n) => ((a % n) + n) % n;

// 1. hammers: s = degrees past the top in the turning direction; the
// descending side is 0 < s < 180 for a clockwise wheel
{
  let outTotal = 0, outDesc = 0, riseUpper = 0, riseUpperFolded = 0;
  for (let f = 0; f < LOOP; f++) {
    for (let i = 0; i < M.WHEEL.hammers; i++) {
      const a = (360 / M.WHEEL.hammers) * i + M.hammerWheelAngle(f);
      const sPos = mod(a + 90, 360);
      const phi = M.HAMMER.at(a);
      if (phi > -10) { outTotal++; if (sPos > 0 && sPos < 200) outDesc++; }
      if (sPos > 260 && sPos < 360) { riseUpper++; if (phi < M.WHEEL.folded + 2) riseUpperFolded++; }
    }
  }
  const flip = [...Array(3600).keys()].map((k) => k / 10).find((sp) => M.HAMMER.at(sp - 90) > -10);
  const folded = [...Array(3600).keys()].map((k) => k / 10).find((sp) => sp > 180 && M.HAMMER.at(sp - 90) < M.WHEEL.folded + 2);
  console.log(`hammers: ${(100 * outDesc / outTotal).toFixed(1)}% of extended hammers are on the descending side or hanging plumb just past the bottom (s < 200°); ${(100 * riseUpperFolded / riseUpper).toFixed(1)}% folded on the peg over the rising side's upper half; flip past the top at s≈${flip}°, folded again by s≈${folded}° past the bottom; periodic residual ${M.HAMMER.residual.toExponential(1)}° → ${ok(outDesc === outTotal && riseUpperFolded === riseUpper && flip > 0 && flip < 90 && folded > 180)}`);
  console.log(`wheel 1 turns ${M.hammerWheelAngle(LOOP)}° per loop = ${M.hammerWheelAngle(LOOP) / 30} hammer spacings → ${ok(M.hammerWheelAngle(LOOP) % 30 === 0)}`);
}
// 2. rolling balls: radius by side, by channel (hub end's side)
{
  let rDesc = 0, nD = 0, rRise = 0, nR = 0;
  for (let f = 0; f < LOOP; f++) {
    for (let i = 0; i < M.ROLLING.channels; i++) {
      const a = (360 / M.ROLLING.channels) * i + M.ballWheelAngle(f);
      const x = Math.cos((a * Math.PI) / 180);
      const p = M.CHANNEL.point(M.BALL.at(a));
      const r = Math.hypot(p[0], p[1]);
      if (x > 0.25) { rDesc += r; nD++; }
      if (x < -0.25) { rRise += r; nR++; }
    }
  }
  const d = rDesc / nD, r = rRise / nR;
  console.log(`balls: mean radius on descending side ${d.toFixed(1)} cm, rising side ${r.toFixed(1)} cm (rim ${M.ROLLING.r1}, hub ${M.ROLLING.r0}) → ${ok(d > r + 15)}; residual ${M.BALL.residual.toExponential(1)} cm`);
  console.log(`wheel 5 turns ${M.ballWheelAngle(LOOP)}° per loop = ${M.ballWheelAngle(LOOP) / 45} channel spacings → ${ok(M.ballWheelAngle(LOOP) % 45 === 0)}`);
}
// 3. gears and screw
{
  const a0 = M.millAngles(0, LOOP), a1 = M.millAngles(1, LOOP), aL = M.millAngles(LOOP, LOOP);
  const dW = a1.wheel - a0.wheel, dG = a1.g2 - a0.g2, dS = a1.screw - a0.screw;
  const ratio = -dG / dW;
  console.log(`spur pair: G1 ${dW.toFixed(3)}°/frame, G2 ${dG.toFixed(3)}°/frame → opposite ${ok(Math.sign(dW) !== Math.sign(dG))}, ratio ${ratio.toFixed(3)} = ${M.MILL.g1.teeth}/${M.MILL.g2.teeth} ${ok(Math.abs(ratio - M.MILL.g1.teeth / M.MILL.g2.teeth) < 1e-9)}`);
  console.log(`crown→lantern: screw/wheel speed ${(Math.abs(dS / dW)).toFixed(3)} = ${M.MILL.crown.pins}/${M.MILL.lantern.pins} ${ok(Math.abs(Math.abs(dS / dW) - M.MILL.crown.pins / M.MILL.lantern.pins) < 1e-9)}`);
  // pockets: crossing t_k = (ψ − 90 − 360k)·p/360 rises as ψ rises
  const dt = (dS * M.MILL.screw.pitch) / 360;
  console.log(`screw: pockets move ${dt > 0 ? "UP" : "DOWN"} the axis at ${(dt * 30).toFixed(1)} cm/s → ${ok(dt > 0)}`);
  const whole = (x, n) => Math.abs(x / n - Math.round(x / n)) < 1e-9;
  console.log(`loop closes: wheel ${aL.wheel - a0.wheel}°, G2 ${(aL.g2 - a0.g2).toFixed(1)}° (teeth ${whole(aL.g2 - a0.g2, 360 / 16)}), screw ${(aL.screw - a0.screw).toFixed(1)}° → ${ok(whole(aL.wheel - a0.wheel, 360 / 16) && whole(aL.g2 - a0.g2, 360) && whole(aL.screw - a0.screw, 360))}`);
}
// 4. magnet ramp: one closed path, two balls half a cycle apart
{
  const p0 = M.ballAt(0).p, pN = M.ballAt(M.CYCLE_FRAMES).p, pH = M.ballAt(M.CYCLE_FRAMES / 2).p;
  const last = M.CYCLE.samples[M.CYCLE.samples.length - 1].p, first = M.CYCLE.samples[0].p;
  const gap = Math.hypot(last[0] - first[0], last[1] - first[1], last[2] - first[2]);
  console.log(`magnet: path closes (end→start ${gap.toFixed(3)} cm), speed at close ${M.CYCLE.vEnd.toFixed(2)} cm/s, cycle ${M.CYCLE_FRAMES} frames, ball 2 = ball 1 + ${M.CYCLE_FRAMES / 2} frames, frame 0 == frame 300: ${ok(p0.every((v, i) => v === pN[i]))}; ball 2 at frame 0 at x=${pH[0].toFixed(1)}`);
}
// 5. in-plane rotation: rotate a circle on the wheel's face; every point stays on one ellipse
{
  const F = M.faceX([0, 0, 128]);
  const m = M.faceAffine(M.OB_P, F, 0);
  const inv = (x, y) => {
    const det = m[0] * m[3] - m[1] * m[2];
    const dx = x - m[4], dy = y - m[5];
    return [(m[3] * dx - m[2] * dy) / det, (-m[1] * dx + m[0] * dy) / det];
  };
  let worst = 0;
  for (let deg = 0; deg < 360; deg += 7) {
    const p = M.rot2([80, 0], deg);
    const s = [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
    const q = inv(s[0], s[1]);
    worst = Math.max(worst, Math.abs(Math.hypot(q[0], q[1]) - 80));
  }
  console.log(`isoFace·rotate(θ): a rim point at every θ lands on the face ellipse, worst error ${worst.toExponential(1)} cm → ${ok(worst < 1e-6)}`);
}
