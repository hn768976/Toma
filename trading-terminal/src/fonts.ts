import { staticFile } from "remotion";

// Self-hosted OFL fonts (see public/fonts/*-OFL.txt). Canvas text needs the
// faces registered before drawing, so the draw effect waits on this promise
// behind delayRender().
const FACES: [string, string, string][] = [
  ["Inter", "inter-latin-400-normal.woff2", "400"],
  ["Inter", "inter-latin-500-normal.woff2", "500"],
  ["Inter", "inter-latin-600-normal.woff2", "600"],
  ["JetBrains Mono", "jetbrains-mono-latin-500-normal.woff2", "500"],
  ["JetBrains Mono", "jetbrains-mono-latin-600-normal.woff2", "600"],
];

let ready = false;

export const fontsPromise: Promise<void> =
  typeof window === "undefined"
    ? Promise.resolve()
    : Promise.all(
        FACES.map(([family, file, weight]) =>
          new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
            weight,
            style: "normal",
          })
            .load()
            .then((f) => {
              (document.fonts as unknown as { add: (x: FontFace) => void }).add(f);
            }),
        ),
      ).then(() => {
        ready = true;
      });

export const fontsReady = () => ready;
