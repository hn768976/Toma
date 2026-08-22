// Bundles the Remotion composition and @remotion/player into ONE self-contained
// HTML file: no network requests, no sibling assets, nothing to serve. Open it
// in a browser and screen-record the 1920x1080 frame.
//
//   node scripts/build-standalone.mjs
//
// Output: dist/kurzgesagt-vault.html

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const OUT_DIR = "dist";
const OUT_FILE = `${OUT_DIR}/kurzgesagt-vault.html`;

const result = await build({
  entryPoints: ["src/standalone/entry.tsx"],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome110", "firefox110", "safari16"],
  jsx: "automatic",
  loader: { ".css": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

const js = result.outputFiles[0].text;

// Same face the composition registers at runtime, so the shell matches even
// before React has mounted.
const fontBase64 = readFileSync("public/fonts/Nunito-Bold-latin.woff2").toString("base64");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=2000" />
    <title>the vault — leptin explainer</title>
    <style>
      @font-face {
        font-family: "Nunito Vault";
        font-weight: 700;
        font-style: normal;
        font-display: block;
        src: url(data:font/woff2;base64,${fontBase64}) format("woff2");
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #05101d;
        color: #f7f3e9;
      }
      /* Fixed canvas on purpose: a responsive layout would reflow mid-record. */
      body {
        min-width: 1960px;
        display: block;
      }
      #root {
        width: 1920px;
        margin: 20px;
      }
      button:hover { filter: brightness(1.12); }
      button:active { transform: translateY(1px); }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>${js}</script>
  </body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`Wrote ${OUT_FILE} (${kb} KB, single file, no external requests)`);
