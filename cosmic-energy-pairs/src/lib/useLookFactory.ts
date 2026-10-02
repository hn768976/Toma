import { useCallback } from "react";
import { Look } from "./Stage";

/** Stable factory for a look: re-created only when the colour row's values change. */
export const useLookFactory = <C>(colours: C, make: (c: C) => Look) => {
  const key = JSON.stringify(colours);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(() => make(JSON.parse(key) as C), [key]);
};
