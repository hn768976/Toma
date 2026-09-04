import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted so a render never depends on a network fetch. Both files are the
// Google Fonts `latin` subset of the variable font, which covers everything the
// subject lines use -- including U+2212 MINUS SIGN and U+2026 HORIZONTAL
// ELLIPSIS.
export const UI_FONT = "Inter";
export const MONO_FONT = "Roboto Mono";

export const UI_FONT_STACK = `"${UI_FONT}", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
export const MONO_FONT_STACK = `"${MONO_FONT}", ui-monospace, "SF Mono", Menlo, monospace`;

const faces: [string, string, string][] = [
  [UI_FONT, "fonts/Inter-Variable-latin.woff2", "100 900"],
  [MONO_FONT, "fonts/RobotoMono-Variable-latin.woff2", "100 700"],
];

const handle = delayRender("Loading Inter / Roboto Mono");

Promise.all(
  faces.map(async ([family, file, weight]) => {
    const face = new FontFace(
      family,
      `url(${staticFile(file)}) format("woff2")`,
      { weight, style: "normal", display: "block" },
    );
    document.fonts.add(await face.load());
  }),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    // Never wedge a render on a font problem -- fall back to the system stack.
    // eslint-disable-next-line no-console
    console.error("Failed to load embedded fonts", err);
    continueRender(handle);
  });
