/**
 * Verifies that a rendered clip loops seamlessly.
 *
 * A loop is seamless when the wrap (last frame back to the first) is no more
 * abrupt than an ordinary frame-to-frame step. This pulls the first two frames
 * and the last frame out of the encoded file and compares the two steps.
 *
 * Usage: node tools/check-loop.mjs out/V1_FoggyForestTeal.mp4 [more.mp4 ...]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openBrowser, stashPixels } from "./cdp.mjs";

const videos = process.argv.slice(2).map((f) => resolve(f));
if (!videos.length) throw new Error("usage: check-loop.mjs <video.mp4>...");
for (const v of videos) if (!existsSync(v)) throw new Error(`missing ${v}`);

const ff = (args) =>
  execFileSync("npx", ["remotion", "ffmpeg", ...args], { stdio: "pipe" });

const { evaluate, close } = await openBrowser(9342);

let failed = false;
for (const video of videos) {
  const dir = mkdtempSync(join(tmpdir(), "loopcheck-"));
  // Remotion's bundled ffmpeg is built with most filters compiled out, so the
  // frames are picked with seeks rather than the `select` filter. Seeking from
  // the end also avoids having to know the frame count.
  ff(["-y", "-i", video, "-frames:v", "1", join(dir, "a.png")]);
  ff(["-y", "-i", video, "-ss", "0.0334", "-frames:v", "1", join(dir, "b.png")]);
  ff(["-y", "-sseof", "-0.2", "-i", video, "-update", "1", join(dir, "z.png")]);

  await evaluate(stashPixels("a", join(dir, "a.png")));
  await evaluate(stashPixels("b", join(dir, "b.png")));
  await evaluate(stashPixels("z", join(dir, "z.png")));
  rmSync(dir, { recursive: true, force: true });

  const { step, wrap } = JSON.parse(
    await evaluate(`(() => {
      const diff = (p, q) => {
        let s = 0, n = 0;
        for (let i = 0; i < p.length; i += 4) {
          s += Math.abs(p[i] - q[i]) + Math.abs(p[i+1] - q[i+1]) + Math.abs(p[i+2] - q[i+2]);
          n += 3;
        }
        return s / n;
      };
      const { a, b, z } = window.__px;
      return JSON.stringify({ step: diff(a.d, b.d), wrap: diff(z.d, a.d) });
    })()`),
  );

  const ratio = wrap / step;
  const ok = ratio <= 2.5;
  if (!ok) failed = true;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${video.split("/").pop()}  ` +
      `ordinary step=${step.toFixed(3)}  wrap step=${wrap.toFixed(3)}  ` +
      `ratio=${ratio.toFixed(2)}x (want <= 2.5x)`,
  );
}

close();
process.exit(failed ? 1 : 0);
