import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

const FONTS = [
  "400 20px 'Barlow Condensed'",
  "500 20px 'Barlow Condensed'",
  "600 20px 'Barlow Condensed'",
  "400 20px 'Share Tech Mono'",
];

/** Blocks rendering until the bundled HUD fonts are loaded. */
export const useFonts = () => {
  const [handle] = useState(() => delayRender("Loading HUD fonts"));
  useEffect(() => {
    Promise.all(FONTS.map((f) => document.fonts.load(f)))
      .then(() => continueRender(handle))
      .catch((err) => {
        console.error(err);
        continueRender(handle);
      });
  }, [handle]);
};
