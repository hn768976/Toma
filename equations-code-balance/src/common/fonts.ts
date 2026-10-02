import { continueRender, delayRender, staticFile } from "remotion";

/**
 * All fonts ship inside /public, so a render never depends on the network.
 *   - Inter (SIL OFL 1.1)          interface text, tabular figures
 *   - JetBrains Mono (SIL OFL 1.1) code
 *   - KaTeX fonts (SIL OFL 1.1) + KaTeX CSS (MIT)  equations
 * Remotion waits on the delayRender() handle until every face is loaded, so
 * no frame is ever captured with a fallback font.
 */
export const INTER = "Inter ECB";
export const MONO = "JetBrains Mono ECB";

const faces: Array<[string, string, string]> = [
  [INTER, "fonts/inter/inter-latin-400-normal.woff2", "400"],
  [INTER, "fonts/inter/inter-latin-500-normal.woff2", "500"],
  [INTER, "fonts/inter/inter-latin-600-normal.woff2", "600"],
  [INTER, "fonts/inter/inter-latin-700-normal.woff2", "700"],
  [MONO, "fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2", "400"],
  [MONO, "fonts/jetbrains-mono/jetbrains-mono-latin-700-normal.woff2", "700"],
];

// Every KaTeX face the formulas can touch. Loading them all up front is cheap
// (~300 KB) and guarantees no glyph is drawn with a fallback.
const katexFaces = [
  "normal 400 16px KaTeX_Main",
  "normal 700 16px KaTeX_Main",
  "italic 400 16px KaTeX_Main",
  "italic 700 16px KaTeX_Main",
  "italic 400 16px KaTeX_Math",
  "italic 700 16px KaTeX_Math",
  "normal 400 16px KaTeX_AMS",
  "normal 400 16px KaTeX_Size1",
  "normal 400 16px KaTeX_Size2",
  "normal 400 16px KaTeX_Size3",
  "normal 400 16px KaTeX_Size4",
  "normal 400 16px KaTeX_SansSerif",
  "normal 400 16px KaTeX_Caligraphic",
  "normal 400 16px KaTeX_Script",
];

const loadKatexCss = () =>
  new Promise<void>((resolve, reject) => {
    const id = "katex-css";
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = staticFile("katex/katex.min.css");
    link.onload = () => resolve();
    link.onerror = () => reject(new Error("Could not load KaTeX CSS"));
    document.head.appendChild(link);
  });

const handle = delayRender("Loading Inter, JetBrains Mono and KaTeX fonts");

Promise.all([
  ...faces.map(([family, file, weight]) =>
    new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
      weight,
      style: "normal",
    })
      .load()
      .then((f) => {
        (document.fonts as unknown as Set<FontFace>).add(f);
      }),
  ),
  loadKatexCss().then(() =>
    Promise.all(katexFaces.map((f) => document.fonts.load(f, "x"))),
  ),
])
  .then(() => document.fonts.ready)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error(err);
    // Fail loudly rather than render with fallback fonts.
    throw err;
  });
