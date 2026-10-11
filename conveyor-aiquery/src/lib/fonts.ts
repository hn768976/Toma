import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Inter (SIL OFL 1.1, see public/fonts/OFL.txt), loaded once per tab.
const WEIGHTS = [400, 600, 700] as const;
let loading: Promise<void> | null = null;
export const loadInter = () => {
  if (!loading) {
    loading = Promise.all(
      WEIGHTS.map(async (w) => {
        const face = new FontFace("Inter", `url(${staticFile(`fonts/inter-latin-${w}-normal.woff2`)}) format("woff2")`, { weight: String(w) });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return loading;
};

// Blocks rendering until Inter is available (textures draw text with it).
export const useInterReady = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading Inter"));
  useEffect(() => {
    loadInter().then(() => setReady(true));
  }, []);
  // Release only after the dependants have mounted (and registered their own
  // delayRender handles), so there is no gap where nothing blocks the frame.
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
};
