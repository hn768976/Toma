import { staticFile } from "remotion";

// OFL fonts shipped in public/fonts. Loaded once per page; callers wait on the
// promise (behind delayRender) before drawing any canvas texture with text.
export const FONT_BADGE = "Blinker";
export const FONT_HUD = "JetBrains Mono";

let fontsPromise: Promise<void> | null = null;

export const loadFonts = () => {
  if (!fontsPromise) {
    const faces = [
      new FontFace(FONT_BADGE, `url(${staticFile("fonts/Blinker-SemiBold.woff2")}) format("woff2")`, { weight: "600" }),
      new FontFace(FONT_HUD, `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")}) format("woff2")`, { weight: "500" }),
    ];
    fontsPromise = Promise.all(
      faces.map(async (f) => {
        await f.load();
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(f);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};
