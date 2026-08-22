// Bundles each explainer and @remotion/player into ONE self-contained HTML
// file: no network requests, no sibling assets, nothing to serve. Open it in
// a browser and screen-record the 1920x1080 frame.
//
//   node scripts/build-standalone.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const OUT_DIR = "dist";

const PAGES = [
  {
    entry: "src/standalone/vault-entry.tsx",
    out: "kurzgesagt-vault.html",
    title: "the vault — leptin explainer",
    page: "#05101d",
    text: "#f7f3e9",
    fonts: [
      { family: "Nunito Vault", weight: 700, file: "public/fonts/Nunito-Bold-latin.woff2" },
    ],
  },
  {
    entry: "src/standalone/pen-entry.tsx",
    out: "minutephysics-alarm.html",
    title: "the alarm — a pen-and-paper explainer",
    page: "#dcdcdf",
    text: "#000000",
    fonts: [
      { family: "Caveat Pen", weight: 600, file: "public/fonts/Caveat-SemiBold-latin.woff2" },
    ],
  },
];

const fontFace = ({ family, weight, file }) => `
      @font-face {
        font-family: "${family}";
        font-weight: ${weight};
        font-style: normal;
        font-display: block;
        src: url(data:font/woff2;base64,${readFileSync(file).toString("base64")}) format("woff2");
      }`;

mkdirSync(OUT_DIR, { recursive: true });

for (const page of PAGES) {
  const result = await build({
    entryPoints: [page.entry],
    bundle: true,
    write: false,
    minify: true,
    format: "iife",
    platform: "browser",
    target: ["chrome110", "firefox110", "safari16"],
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=2000" />
    <title>${page.title}</title>
    <style>${page.fonts.map(fontFace).join("")}
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: ${page.page};
        color: ${page.text};
      }
      /* Fixed canvas on purpose: a responsive layout would reflow mid-record. */
      body { min-width: 1960px; display: block; }
      #root { width: 1920px; margin: 20px; }
      button:hover { filter: brightness(1.12); }
      button:active { transform: translateY(1px); }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>${result.outputFiles[0].text}</script>
  </body>
</html>
`;

  const path = `${OUT_DIR}/${page.out}`;
  writeFileSync(path, html);
  console.log(
    `Wrote ${path} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, single file, no external requests)`,
  );
}
