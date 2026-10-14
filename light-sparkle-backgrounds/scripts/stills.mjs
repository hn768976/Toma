// Usage: node scripts/stills.mjs <outDir> <frame> [scale] [ids...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [outDir, frame = "300", scale = "0.3333333333333333", ...ids] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const exe = fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell") ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" : undefined;
const chromiumOptions = { gl: "angle" };
const all = ["SpotlightSparkles-Blue","SpotlightSparkles-Gold","PastelBokeh-PinkLavender","PastelBokeh-MintAqua","SunFlare-Midday","SunFlare-GoldenHour","StarTwinkle-Black","SilkLight-PaleBlue"];
const list = ids.length ? ids : all;
const inputProps = process.env.LOOPCHECK ? { loopCheck: true } : {};
for (const id of list) {
  const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable: exe, chromiumOptions });
  const t = Date.now();
  await renderStill({ composition, serveUrl, inputProps, output: path.join(outDir, `${id}_f${frame}.png`), frame: Number(frame), scale: Number(scale), browserExecutable: exe, chromiumOptions,
    onBrowserLog: (l) => { if (l.type === "error") console.log("[browser]", id, l.text); } });
  console.log(id, "still", Date.now() - t, "ms");
}
