import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted and registered behind a delayRender() so no frame is ever
// captured with a fallback face. At this density a substituted font would
// break the column alignment of every table and readout at once.
const FACES: { family: string; file: string; weight: string }[] = [
  { family: "Barlow Semi Condensed", file: "BarlowSemiCondensed-Regular.woff2", weight: "400" },
  { family: "Barlow Semi Condensed", file: "BarlowSemiCondensed-SemiBold.woff2", weight: "600" },
  { family: "Roboto Mono", file: "RobotoMono-Regular.woff2", weight: "400" },
  { family: "Roboto Mono", file: "RobotoMono-Medium.woff2", weight: "500" },
];

const handle = delayRender("Loading dashboard fonts");

Promise.all(
  FACES.map(async ({ family, file, weight }) => {
    const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
      weight,
      style: "normal",
    });
    document.fonts.add(await face.load());
  }),
)
  .catch((err) => {
    console.error("Failed to load dashboard fonts", err);
  })
  .finally(() => {
    continueRender(handle);
  });
