import { loadFont } from "@remotion/fonts";
import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Both families are SIL Open Font License 1.1 and are shipped in
 * public/fonts/ so the project renders identically on any machine — no system
 * font and no network fetch at render time. Licences are alongside them.
 */
export const UI_FONT = "Inter";
export const MONO_FONT = "JetBrains Mono";

const handle = delayRender("loading OFL fonts");

Promise.all([
  loadFont({ family: UI_FONT, url: staticFile("fonts/Inter-300.woff2"), weight: "300", format: "woff2" }),
  loadFont({ family: UI_FONT, url: staticFile("fonts/Inter-400.woff2"), weight: "400", format: "woff2" }),
  loadFont({ family: UI_FONT, url: staticFile("fonts/Inter-500.woff2"), weight: "500", format: "woff2" }),
  loadFont({ family: UI_FONT, url: staticFile("fonts/Inter-600.woff2"), weight: "600", format: "woff2" }),
  loadFont({ family: UI_FONT, url: staticFile("fonts/Inter-700.woff2"), weight: "700", format: "woff2" }),
  loadFont({ family: MONO_FONT, url: staticFile("fonts/JetBrainsMono-400.woff2"), weight: "400", format: "woff2" }),
  loadFont({ family: MONO_FONT, url: staticFile("fonts/JetBrainsMono-500.woff2"), weight: "500", format: "woff2" }),
  loadFont({ family: MONO_FONT, url: staticFile("fonts/JetBrainsMono-700.woff2"), weight: "700", format: "woff2" }),
])
  .then(() => continueRender(handle))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("font load failed", err);
    continueRender(handle);
  });

/** Tabular figures everywhere a number changes, or the digits jitter. */
export const NUM: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
};
