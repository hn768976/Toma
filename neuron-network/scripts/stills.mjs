/**
 * Still harvest.
 *
 * Three stills per composition at 6000x3375, at the frames stored in each
 * look row (chosen so a pulse sits well), plus one 1080p still each.
 * PNG, so anything that bands here came from the render, not the encode.
 */
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const ids = args.filter((a) => !a.startsWith("--"));
const width = Number(flag("width", "6000"));
const outDir = flag("out", "out/stills");
const only1080 = flag("only1080", "false") === "true";

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const common = { browserExecutable, chromiumOptions: { gl: "angle" }, timeoutInMilliseconds: 600000 };

mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => {} });
const comps = await getCompositions(serveUrl, { browserExecutable });
const targets = comps.filter((c) => ids.length === 0 || ids.includes(c.id));

for (const comp of targets) {
  const look = comp.props.look;
  const frames = look.stillFrames;

  // One 1080p still per composition, alongside the video.
  const t0 = Date.now();
  await renderStill({
    composition: comp, serveUrl, frame: frames[0], scale: 0.5,
    output: path.join(outDir, `${look.file}_1080.png`), overwrite: true, ...common,
  });
  console.log(`${look.file}_1080.png  ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (only1080) continue;

  // Three high-resolution stills at different frames.
  for (const frame of frames) {
    const start = Date.now();
    const output = path.join(outDir, `${look.file}_f${frame}_6000.png`);
    await renderStill({
      composition: comp, serveUrl, frame,
      scale: width / comp.width, output, overwrite: true, ...common,
    });
    console.log(`${path.basename(output)}  ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }
}
