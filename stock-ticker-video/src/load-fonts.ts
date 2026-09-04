import { continueRender, delayRender, staticFile } from "remotion";

// Inter is self-hosted (variable woff2, latin subset) so a render never
// depends on a network fetch. delayRender() holds frame capture until the
// faces are live — otherwise the first frames would be measured against a
// fallback font and the layout would shift mid-render.
export const FONT_FAMILY = "Inter Terminal";

const faces: [string, string][] = [
  ["fonts/Inter-Variable-latin.woff2", "normal"],
  ["fonts/Inter-Variable-Italic-latin.woff2", "italic"],
];

const handle = delayRender("Loading Inter");

Promise.all(
  faces.map(([file, style]) =>
    new FontFace(FONT_FAMILY, `url(${staticFile(file)}) format("woff2")`, {
      weight: "100 900",
      style,
    })
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      }),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load Inter", err);
    continueRender(handle);
  });
