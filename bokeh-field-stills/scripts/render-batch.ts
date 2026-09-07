/**
 * Renders the full batch of 36 stills to out/stills/ at 4K.
 *
 *   npm run batch                     all 36
 *   npm run batch -- --palette=cyan   just one palette
 *   npm run batch -- --only=bokeh-cyan-medium-f35
 *   npm run batch -- --cli            shell out to `npx remotion still` instead
 *
 * By default the project is bundled once and all 36 stills are rendered
 * against that one bundle through Remotion's Node API, reusing a single
 * browser. Running `npx remotion still` 36 times re-bundles every time and is
 * many times slower; `--cli` does exactly that if you want the literal
 * command, and the README shows the single-image form.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { buildMatrix, type Variant } from "./lib/matrix.ts";
import { findRoot } from "./lib/root.ts";

const COMPOSITION_ID = "BokehField";
const ROOT = findRoot();
const OUT_DIR = path.join(ROOT, "out", "stills");
const TIMEOUT = 180_000;

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. remotion.config.ts does not apply
// to the Node APIs, so the same fallback is repeated here.
const PLAYWRIGHT_SHELL =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(PLAYWRIGHT_SHELL) ? PLAYWRIGHT_SHELL : null;

const flag = (name: string) => {
  const match = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
};

const selectVariants = (): Variant[] => {
  let variants = buildMatrix();
  const only = flag("only");
  const palette = flag("palette");
  const density = flag("density");
  if (only) variants = variants.filter((variant) => variant.name === only);
  if (palette) variants = variants.filter((variant) => variant.props.palette === palette);
  if (density) variants = variants.filter((variant) => variant.props.density === density);
  return variants;
};

const renderViaCli = (variants: Variant[]) => {
  variants.forEach((variant, index) => {
    const output = path.join(OUT_DIR, variant.file);
    console.log(`[${index + 1}/${variants.length}] ${variant.name}`);
    execFileSync(
      "npx",
      [
        "remotion",
        "still",
        COMPOSITION_ID,
        output,
        `--props=${JSON.stringify(variant.props)}`,
      ],
      { cwd: ROOT, stdio: "inherit" },
    );
  });
};

const renderViaApi = async (variants: Variant[]) => {
  console.log("Bundling once for the whole batch...");
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    onProgress: () => undefined,
  });

  const browser = await openBrowser("chrome", {
    browserExecutable,
    chromiumOptions: { gl: "angle" },
  });

  try {
    for (const [index, variant] of variants.entries()) {
      const started = Date.now();
      const composition = await selectComposition({
        serveUrl,
        id: COMPOSITION_ID,
        inputProps: variant.props,
        puppeteerInstance: browser,
        browserExecutable,
      });

      await renderStill({
        composition,
        serveUrl,
        output: path.join(OUT_DIR, variant.file),
        inputProps: variant.props,
        imageFormat: "png",
        overwrite: true,
        puppeteerInstance: browser,
        browserExecutable,
        timeoutInMilliseconds: TIMEOUT,
      });

      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `[${index + 1}/${variants.length}] ${variant.file}  ${composition.width}x${composition.height}  ${seconds}s`,
      );
    }
  } finally {
    await browser.close({ silent: true });
  }
};

const main = async () => {
  const variants = selectVariants();
  if (variants.length === 0) {
    console.error("No variants matched the given filters.");
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Rendering ${variants.length} still${variants.length === 1 ? "" : "s"} to ${OUT_DIR}`);

  if (process.argv.includes("--cli")) {
    renderViaCli(variants);
  } else {
    await renderViaApi(variants);
  }

  console.log("Done.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
