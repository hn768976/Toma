import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { loadMusicFont } from "./font";

// Loads the bundled music font, then runs an expensive, deterministic asset
// builder once. Rendering is held with delayRender until the assets exist.
export const useCanvasAssets = <T,>(build: () => T, key: string): T | null => {
  const [assets, setAssets] = useState<T | null>(null);
  const [handle] = useState(() => delayRender(`Building assets: ${key}`));

  useEffect(() => {
    let cancelled = false;
    loadMusicFont()
      .then(() => {
        if (cancelled) return;
        setAssets(build());
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return assets;
};
