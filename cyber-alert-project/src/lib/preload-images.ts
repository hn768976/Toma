import { continueRender, delayRender, staticFile } from "remotion";

// Images used through CSS (background-image / mask-image) are not awaited by
// Remotion the way <Img> is. Load and fully decode each one before any frame
// is captured, so no frame is ever drawn while one is still decoding.
const CSS_IMAGES = ["noise/grain.png", "noise/colornoise.png", "map/world-fill.png"];

const keep: HTMLImageElement[] = [];

if (typeof document !== "undefined") {
  const handle = delayRender("Decoding CSS images");
  Promise.all(
    CSS_IMAGES.map((file) => {
      const img = new Image();
      keep.push(img); // hold a reference so the decoded image stays cached
      img.src = staticFile(file);
      return img.decode();
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error("CSS image preload failed", err);
      continueRender(handle);
    });
}
