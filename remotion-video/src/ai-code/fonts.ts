import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted so a render never depends on a network fetch. The code
// sheets are drawn into canvases during scene setup, and a canvas
// silently falls back to a default face if the font is not registered
// yet, so every sheet builder awaits `monoFontReady` first.
export const MONO_FONT_FAMILY = "JetBrains Mono";
export const MONO_FONT_STACK = `"${MONO_FONT_FAMILY}", "DejaVu Sans Mono", "Liberation Mono", monospace`;

const handle = delayRender("Loading JetBrains Mono");

const load = async () => {
  const faces = [
    new FontFace(
      MONO_FONT_FAMILY,
      `url(${staticFile("fonts/JetBrainsMono-Regular.woff2")}) format("woff2")`,
      { weight: "400", style: "normal" },
    ),
    new FontFace(
      MONO_FONT_FAMILY,
      `url(${staticFile("fonts/JetBrainsMono-Bold.woff2")}) format("woff2")`,
      { weight: "700", style: "normal" },
    ),
  ];
  const loaded = await Promise.all(faces.map((face) => face.load()));
  for (const face of loaded) {
    document.fonts.add(face);
  }
  await document.fonts.ready;
};

export const monoFontReady: Promise<void> = load()
  .catch((err) => {
    // The stack falls back to DejaVu/Liberation Mono, so a failed fetch
    // costs fidelity, not the render.
    console.error("Failed to load JetBrains Mono", err);
  })
  .then(() => {
    continueRender(handle);
  });
