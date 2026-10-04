import { useEffect, useState } from "react";
import { cancelRender, useDelayRender } from "remotion";

// Runs an async builder once (per key) behind delayRender, so the first frame
// is never captured before data, fonts and textures are ready.
export const useAsyncResource = <T,>(key: string, build: () => Promise<T>, label: string): T | null => {
  const { delayRender, continueRender } = useDelayRender();
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let done = false;
    let released = false;
    const handle = delayRender(label, { timeoutInMilliseconds: 600000 });
    const release = () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };
    build()
      .then((v) => {
        if (done) return;
        setValue(v);
        release();
      })
      .catch((err) => cancelRender(err));
    return () => {
      done = true;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
};
