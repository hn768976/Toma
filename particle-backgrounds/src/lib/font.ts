import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

export const MONO = "JetBrains Mono";

let fontPromise: Promise<void> | null = null;

const loadMono = () => {
  if (!fontPromise) {
    const face = new FontFace(MONO, `url(${staticFile("fonts/JetBrainsMono-Medium.ttf")}) format("truetype")`, {
      weight: "500",
    });
    fontPromise = face.load().then((f) => {
      document.fonts.add(f);
    });
  }
  return fontPromise;
};

/** Blocks the frame (delayRender) until JetBrains Mono is loaded. */
export const useMonoFont = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading JetBrains Mono"));
  useEffect(() => {
    loadMono()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        console.error(err);
        continueRender(handle);
      });
  }, [handle]);
  return ready;
};
