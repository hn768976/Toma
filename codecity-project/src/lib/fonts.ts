import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Both fonts are OFL (see public/fonts/*-OFL.txt). They are loaded once, and
// every canvas texture that draws text waits for this promise.
const load = async () => {
  const faces = [
    new FontFace("JetBrains Mono", `url(${staticFile("fonts/JetBrainsMono-Regular.woff2")})`, { weight: "400" }),
    new FontFace("Inter", `url(${staticFile("fonts/Inter-Bold.woff2")})`, { weight: "700" }),
  ];
  await Promise.all(faces.map((f) => f.load()));
  faces.forEach((f) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(f));
};

let promise: Promise<void> | null = null;
export const fontsReady = () => {
  if (!promise) {
    const handle = delayRender("Loading fonts");
    promise = load().then(() => continueRender(handle));
  }
  return promise;
};

// True once the fonts are loaded. Mount the canvas only when this is true;
// the frame is held (delayRender) until then.
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Waiting for fonts"));
  useEffect(() => {
    fontsReady().then(() => {
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (ready) {
      // By now the <ThreeCanvas> has mounted and registered its own
      // delayRender, which holds the frame until R3F has drawn it.
      continueRender(handle);
    }
  }, [ready, handle]);
  return ready;
};
