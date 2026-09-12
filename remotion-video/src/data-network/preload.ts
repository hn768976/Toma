// Blocks the first rendered frame until the board's fonts and bitmaps are in
// the browser. The halftone map and the grain are applied as CSS
// mask/background images, which Remotion cannot wait on by itself.

import { continueRender, delayRender, staticFile } from "remotion";

export const MONO_FONT_FAMILY = "JetBrains Mono";

const loadFont = (file: string, weight: string) => {
  const handle = delayRender(`Loading ${MONO_FONT_FAMILY} ${weight}`);
  new FontFace(MONO_FONT_FAMILY, `url(${staticFile(file)}) format("truetype")`, {
    weight,
    style: "normal",
  })
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(`Failed to load ${MONO_FONT_FAMILY} ${weight}`, err);
      continueRender(handle);
    });
};

const loadImage = (file: string) => {
  const handle = delayRender(`Loading ${file}`);
  const image = new Image();
  image.onload = () => continueRender(handle);
  image.onerror = () => {
    console.error(`Failed to load ${file}`);
    continueRender(handle);
  };
  image.src = staticFile(file);
};

loadFont("fonts/JetBrainsMono-Regular.ttf", "400");
loadFont("fonts/JetBrainsMono-Bold.ttf", "700");
loadImage("world-dots.png");
loadImage("grain.png");
