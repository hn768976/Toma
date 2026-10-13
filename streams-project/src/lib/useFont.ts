import { useEffect, useState } from "react";
import { staticFile, useDelayRender } from "remotion";

// Loads the bundled OFL font once, before the first frame is rendered.
let fontPromise: Promise<void> | null = null;
export const loadJetBrainsMono = () => {
  if (!fontPromise) {
    const face = new FontFace("JetBrains Mono", `url(${staticFile("fonts/JetBrainsMono-Regular.woff2")})`);
    fontPromise = face.load().then((f) => {
      document.fonts.add(f);
    });
  }
  return fontPromise;
};

export const useFontReady = () => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading JetBrains Mono"));
  useEffect(() => {
    loadJetBrainsMono()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle, continueRender, cancelRender]);
  return ready;
};
