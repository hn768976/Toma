import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

// Resolve a promise behind delayRender so Remotion never captures a frame
// before the asset exists. The handle is released only after the commit in
// which the asset (and therefore any children that register their own
// delayRender, like <ThreeCanvas/>) has mounted.
export const useAsset = <T,>(load: () => Promise<T>, label: string): T | null => {
  const [handle] = useState(() => delayRender(label, { timeoutInMilliseconds: 120000 }));
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    load()
      .then((v) => setValue(() => v))
      .catch((e) => cancelRender(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (value !== null) continueRender(handle);
  }, [value, handle]);
  return value;
};
