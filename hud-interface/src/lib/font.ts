import { continueRender, delayRender, staticFile } from "remotion";

export const HUD_FONT = "ShareTechMono";

let loaded = false;
export const loadHudFont = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("Loading HUD font");
  const face = new FontFace(
    HUD_FONT,
    `url(${staticFile("fonts/ShareTechMono-Regular.woff2")}) format("woff2")`,
  );
  face
    .load()
    .then((f) => {
      document.fonts.add(f);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};
