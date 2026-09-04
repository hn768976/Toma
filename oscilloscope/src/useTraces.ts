import { useMemo } from "react";
import { buildTraces } from "./traces";

export type { Trace } from "./traces";

/** Memoised per frame; the work itself is pure and lives in `traces.ts`. */
export const useTraces = (frame: number) =>
  useMemo(() => buildTraces(frame), [frame]);
