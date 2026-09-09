import { continueRender, delayRender, staticFile } from "remotion";

// Inter, SIL Open Font License 1.1 (see public/fonts/Inter-LICENSE.txt).
// Self-hosted and embedded so a render never depends on a network fetch and
// never silently falls back to a system font.
export const FONT_FAMILY = "Inter";

const FACES: { file: string; weight: string }[] = [
  { file: "fonts/Inter-Medium.woff2", weight: "500" },
  { file: "fonts/Inter-SemiBold.woff2", weight: "600" },
  { file: "fonts/Inter-Bold.woff2", weight: "700" },
];

const handle = delayRender("Loading Inter");

Promise.all(
  FACES.map(async ({ file, weight }) => {
    const face = new FontFace(
      FONT_FAMILY,
      `url(${staticFile(file)}) format("woff2")`,
      { weight, style: "normal" },
    );
    document.fonts.add(await face.load());
  }),
)
  .catch((err) => {
    // Continue rather than hang the render; the frames will show the fallback
    // and the failure is loud in the log.
    console.error("Failed to load Inter", err);
  })
  .finally(() => {
    continueRender(handle);
  });
