import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

// Loads a one-off asset (fonts, map data, generated textures) behind
// delayRender. The state only gates mounting; it never drives animation.
export function useAsync<T>(key: string, factory: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  const [handle] = useState(() => delayRender(`Loading ${key}`));
  useEffect(() => {
    let alive = true;
    factory().then((v) => {
      if (!alive) return;
      setValue(v);
      continueRender(handle);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}
