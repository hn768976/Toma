#!/usr/bin/env node
/**
 * Render helper for the Tech Loops project (Node API, same settings as
 * remotion.config.ts).
 *
 *   node scripts/render.mjs previews [ids…]   1080p PNG sequence → H.264 mp4 (CRF 16, yuv420p, 30 fps)
 *   node scripts/render.mjs stills [ids…]     2 stills per composition at 6000×3375 (PNG)
 *   node scripts/render.mjs loopcheck [ids…]  frames 0 and 600 of the 601-frame variant (PNG)
 *   node scripts/render.mjs bench [ids…]      timed frame range (BENCH_FRAMES, SCALE, CONCURRENCY), no encode
 *
 * Output goes to ./out (git-ignored). Timings → out/timings/<id>.json.
 */
import { bundle } from "@remotion/bundler";
import { renderFrames, renderStill, selectComposition, getCompositions } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "out");
const PW = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(PW) ? PW : null;
const chromiumOptions = { gl: process.env.GL ?? "angle" }; // WebGL2 for look 5
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const SCALE = Number(process.env.SCALE ?? 0.5);

// composition id → preview file name, and still frames
const FILES = {
  "BinaryWord-BinaryCode": "BinaryWord_BinaryCode",
  "BinaryWord-DataStream": "BinaryWord_DataStream",
  "SoftSpinner-Amber": "SoftSpinner_Amber",
  "SoftSpinner-IceBlue": "SoftSpinner_IceBlue",
  "SecurityDashboard-Teal": "SecurityDashboard_Teal",
  "SecurityDashboard-IceViolet": "SecurityDashboard_IceViolet",
  "ModelTraining-LLM": "ModelTraining_LLM",
  "ModelTraining-FineTuning": "ModelTraining_FineTuning",
  "AICoreTunnel-Cyan": "AICoreTunnel_Cyan",
  "AICoreTunnel-Violet": "AICoreTunnel_Violet",
};
const LOOPING = (id) => !id.startsWith("ModelTraining");
const STILL_FRAMES = (id) => (LOOPING(id) ? [90, 390] : [280, 560]); // look 4: mid-typing, near the end
const PREVIEW_STILL = (id) => (LOOPING(id) ? 300 : 450);

const [mode = "previews", ...rest] = process.argv.slice(2);
const ids = rest.length ? rest : Object.keys(FILES);

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

log("bundling");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts"), onProgress: () => {} });
// NOTE: no shared browser instance — renderFrames/renderStill must open their
// own so Chromium gets forceDeviceScaleFactor = scale (otherwise frames are
// drawn at 4K and downsampled, and canvases see devicePixelRatio = 1).
mkdirSync(path.join(OUT, "timings"), { recursive: true });

const select = (id, inputProps = {}) => selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions });

try {
  if (mode === "previews") {
    for (const id of ids) {
      const file = FILES[id];
      const composition = await select(id);
      const frameDir = path.join(OUT, "frames", file);
      rmSync(frameDir, { recursive: true, force: true });
      mkdirSync(frameDir, { recursive: true });
      log(`render ${id}: ${composition.durationInFrames} frames @ scale ${SCALE}, concurrency ${CONCURRENCY}`);
      const t0 = performance.now();
      await renderFrames({
        composition,
        serveUrl,
        outputDir: frameDir,
        inputProps: {},
        imageFormat: "png",
        scale: SCALE,
        concurrency: CONCURRENCY,
        frameRange: process.env.FRAMES ? process.env.FRAMES.split("-").map(Number) : null,
        chromiumOptions,
        browserExecutable,
        onStart: () => {},
        onFrameUpdate: (n) => {
          if (n % 100 === 0) log(`  ${id} ${n}/${composition.durationInFrames}`);
        },
      });
      const secs = (performance.now() - t0) / 1000;
      log(`  frames rendered in ${secs.toFixed(1)} s`);
      const frames = readdirSync(frameDir).filter((f) => f.endsWith(".png")).sort();
      // normalise names → frame-0000.png
      frames.forEach((f, i) => {
        const to = path.join(frameDir, `frame-${String(i).padStart(4, "0")}.png`);
        if (path.join(frameDir, f) !== to) execFileSync("mv", [path.join(frameDir, f), to]);
      });
      mkdirSync(path.join(OUT, "previews"), { recursive: true });
      const mp4 = path.join(OUT, "previews", `${file}.mp4`);
      const t1 = performance.now();
      execFileSync("ffmpeg", [
        "-v", "error", "-y",
        "-framerate", "30",
        "-i", path.join(frameDir, "frame-%04d.png"),
        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-c:v", "libx264", "-preset", "medium", "-crf", "16",
        "-pix_fmt", "yuv420p", "-r", "30",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        "-movflags", "+faststart", "-an",
        mp4,
      ]);
      const encode = (performance.now() - t1) / 1000;
      mkdirSync(path.join(OUT, "stills-1080p"), { recursive: true });
      copyFileSync(
        path.join(frameDir, `frame-${String(PREVIEW_STILL(id)).padStart(4, "0")}.png`),
        path.join(OUT, "stills-1080p", `${file}.png`),
      );
      // keep only what the determinism check needs (frame 300) unless KEEP_FRAMES=1
      if (process.env.KEEP_FRAMES !== "1") {
        for (const f of readdirSync(frameDir)) if (f !== "frame-0300.png") rmSync(path.join(frameDir, f));
      }
      const timing = {
        frames: frames.length,
        scale: SCALE,
        concurrency: CONCURRENCY,
        renderSeconds: +secs.toFixed(1),
        wallMsPerFrame: Math.round((secs * 1000) / frames.length),
        threadMsPerFrame: Math.round((secs * 1000 * CONCURRENCY) / frames.length),
        encodeSeconds: +encode.toFixed(1),
      };
      writeFileSync(path.join(OUT, "timings", `${id}.json`), JSON.stringify(timing, null, 2));
      log(`  done ${id}: ${secs.toFixed(1)} s (${timing.wallMsPerFrame} ms/frame wall), encode ${encode.toFixed(1)} s`);
    }
  } else if (mode === "stills") {
    const dir = path.join(OUT, "stills-6000");
    mkdirSync(dir, { recursive: true });
    for (const id of ids) {
      const composition = await select(id);
      for (const frame of STILL_FRAMES(id)) {
        const output = path.join(dir, `${FILES[id]}_f${String(frame).padStart(3, "0")}.png`);
        const t0 = performance.now();
        await renderStill({
          composition,
          serveUrl,
          output,
          frame,
          imageFormat: "png",
          scale: 6000 / 3840, // 6000×3375
          chromiumOptions,
          browserExecutable,
          overwrite: true,
        });
        log(`still ${id} f${frame} ${((performance.now() - t0) / 1000).toFixed(1)} s → ${path.relative(ROOT, output)}`);
      }
    }
  } else if (mode === "loopcheck") {
    const dir = path.join(OUT, "loopcheck");
    mkdirSync(dir, { recursive: true });
    for (const id of ids.filter(LOOPING)) {
      const inputProps = { loopCheck: true };
      const composition = await select(id, inputProps);
      if (composition.durationInFrames !== 601) throw new Error(`${id}: loopCheck did not give 601 frames`);
      for (const frame of [0, 600]) {
        await renderStill({
          composition,
          serveUrl,
          output: path.join(dir, `${FILES[id]}_${frame}.png`),
          frame,
          inputProps,
          imageFormat: "png",
          scale: SCALE,
          chromiumOptions,
          browserExecutable,
          overwrite: true,
        });
      }
      log(`loopcheck rendered ${id}`);
    }
  } else if (mode === "bench") {
    // isolated timing: BENCH_FRAMES (default 270-329) at SCALE, no encode, frames discarded
    const [a, b] = (process.env.BENCH_FRAMES ?? "270-329").split("-").map(Number);
    mkdirSync(path.join(OUT, "bench"), { recursive: true });
    for (const id of ids) {
      const composition = await select(id);
      const dir = path.join(OUT, "bench", `${id}-${SCALE}`);
      rmSync(dir, { recursive: true, force: true });
      const t0 = performance.now();
      await renderFrames({
        composition, serveUrl, outputDir: dir, inputProps: {}, imageFormat: "png", scale: SCALE,
        concurrency: CONCURRENCY, chromiumOptions, browserExecutable, frameRange: [a, b],
        onStart: () => {}, onFrameUpdate: () => {},
      });
      const secs = (performance.now() - t0) / 1000;
      const n = b - a + 1;
      const res = { id, scale: SCALE, concurrency: CONCURRENCY, frames: n, seconds: +secs.toFixed(1), msPerFrame: Math.round((secs * 1000) / n) };
      writeFileSync(path.join(OUT, "bench", `${id}-${SCALE}.json`), JSON.stringify(res, null, 2));
      rmSync(dir, { recursive: true, force: true });
      log(`bench ${id} scale ${SCALE}: ${res.msPerFrame} ms/frame (${n} frames, concurrency ${CONCURRENCY})`);
    }
  } else if (mode === "list") {
    const comps = await getCompositions(serveUrl, { browserExecutable, chromiumOptions });
    for (const c of comps) console.log(c.id, c.width, c.height, c.fps, c.durationInFrames);
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
} finally {
  // nothing to close
}
