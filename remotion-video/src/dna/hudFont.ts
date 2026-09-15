import { continueRender, delayRender, staticFile } from "remotion";

/**
 * The HUD versions use a self-hosted monospace so the project renders
 * identically on any machine, rather than depending on a system font being
 * installed on whoever renders the 4K compositions.
 */
export const HUD_MONO = "DnaHudMono";
export const HUD_SANS = "DnaHudSans";

const register = (family: string, file: string, weight: string) => {
  const handle = delayRender(`Loading HUD font ${family} ${weight}`);
  new FontFace(family, `url(${staticFile(`fonts/${file}`)})`, {
    weight,
    style: "normal",
  })
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(`Failed to load ${family}`, err);
      continueRender(handle);
    });
};

register(HUD_MONO, "DejaVuSansMono.ttf", "400");
register(HUD_MONO, "DejaVuSansMono-Bold.ttf", "700");
register(HUD_SANS, "DejaVuSans.ttf", "400");
