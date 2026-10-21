import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

const loaded = new Map<string, Promise<void>>();

/** Loads a font from /public behind delayRender. Returns true once ready. */
export const useFont = (family: string, file: string) => {
  const [handle] = useState(() => delayRender(`font ${family}`));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let p = loaded.get(family);
    if (!p) {
      const face = new FontFace(family, `url(${staticFile(file)})`);
      p = face.load().then((f) => {
        (document.fonts as unknown as Set<FontFace>).add(f);
      });
      loaded.set(family, p);
    }
    p.then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [family, file, handle]);
  return ready;
};
