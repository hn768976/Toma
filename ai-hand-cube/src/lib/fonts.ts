// OFL fonts loaded once from /public, before the first frame.
import { staticFile } from "remotion";

export const FONT_AI = "Exo2SemiBold";
export const FONT_HUD = "JetBrainsMonoHUD";

let promise: Promise<void> | null = null;

export const loadFonts = () => {
  if (!promise) {
    const faces = [
      new FontFace(FONT_AI, `url(${staticFile("fonts/Exo2-SemiBold.woff2")}) format("woff2")`, {
        weight: "600",
      }),
      new FontFace(FONT_HUD, `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")}) format("woff2")`, {
        weight: "500",
      }),
    ];
    promise = Promise.all(
      faces.map((f) =>
        f.load().then((loaded) => {
          (document.fonts as unknown as Set<FontFace>).add(loaded);
        }),
      ),
    ).then(() => undefined);
  }
  return promise;
};
