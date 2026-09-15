// Fetches and parses the baked arch exactly once per render worker.
//
// This suspends rather than using state, because `<ThreeCanvas />` only
// calls three's `advance()` when the Remotion frame changes. A late
// `setState` would update React but never trigger a redraw, so the frame
// would be captured with an empty canvas. Suspending instead lets
// ThreeCanvas hold its own `delayRender` until the buffer lands, and
// remounting on resume re-runs the advance effect and draws the mesh.

import { use } from "react";
import { staticFile } from "remotion";
import { MandibleData, parseMandible } from "./mandible";

let cached: Promise<MandibleData> | null = null;

export const loadMandible = (): Promise<MandibleData> => {
  if (!cached) {
    cached = fetch(staticFile("models/mandible.bin"))
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `Failed to fetch mandible.bin: ${res.status} ${res.statusText}`,
          );
        }
        return res.arrayBuffer();
      })
      .then(parseMandible);
  }
  return cached;
};

export const useMandible = (): MandibleData => use(loadMandible());
