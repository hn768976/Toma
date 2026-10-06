import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

// Gate rendering on async assets (fonts, map data). The boolean only
// mounts the scene once; it never drives any animated value.
export const useAssets = (load: () => Promise<unknown>, label: string) => {
  const [handle] = useState(() => delayRender(`Loading ${label}`, { timeoutInMilliseconds: 120000 }));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    load()
      .then(() => {
        if (!alive) return;
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready;
};
