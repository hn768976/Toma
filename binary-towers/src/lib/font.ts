import { staticFile } from "remotion";
import { MONO_FAMILY } from "../constants";

let promise: Promise<void> | null = null;

/**
 * The monospace face is embedded in the project, not fetched from a CDN: a
 * substituted font changes the glyph advance and the character cell would no
 * longer line up with the integer UV scroll that makes the loop seamless.
 */
export const loadMonoFont = (): Promise<void> => {
  if (promise) return promise;
  if (typeof document === "undefined") return Promise.resolve();

  const faces: FontFace[] = [
    new FontFace(MONO_FAMILY, `url(${staticFile("fonts/JetBrainsMono-400.woff2")})`, {
      weight: "400",
    }),
    new FontFace(MONO_FAMILY, `url(${staticFile("fonts/JetBrainsMono-700.woff2")})`, {
      weight: "700",
    }),
  ];

  promise = Promise.all(
    faces.map((face) =>
      face.load().then((loaded) => {
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(loaded);
      }),
    ),
  ).then(async () => {
    // Warm the 2D-canvas font cache before any texture is drawn.
    await document.fonts.load(`400 40px "${MONO_FAMILY}"`, "01");
    await document.fonts.load(`700 40px "${MONO_FAMILY}"`, "01");
  });

  return promise;
};
