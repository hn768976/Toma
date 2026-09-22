import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import type { CanvasTexture } from "three";
import { getDigitTexture } from "./digitTexture";

/**
 * Resolves the module-level digit texture and holds the frame until it exists.
 * The texture itself is built once per JS context, not once per call.
 */
export const useDigitTexture = (): CanvasTexture | null => {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  const [handle] = useState(() => delayRender("Building the binary digit field"));

  useEffect(() => {
    let alive = true;
    getDigitTexture()
      .then((t) => {
        if (!alive) return;
        setTexture(t);
        continueRender(handle);
      })
      .catch((err) => {
        console.error("digit texture failed", err);
        continueRender(handle);
      });
    return () => {
      alive = false;
    };
  }, [handle]);

  return texture;
};
