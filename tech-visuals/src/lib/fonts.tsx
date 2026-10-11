import React, { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Inter (SIL OFL 1.1) — files + licence in public/fonts.
const FACES: [string, string][] = [
  ["400", "fonts/inter-latin-400-normal.woff2"],
  ["500", "fonts/inter-latin-500-normal.woff2"],
  ["600", "fonts/inter-latin-600-normal.woff2"],
  ["700", "fonts/inter-latin-700-normal.woff2"],
];

let loading: Promise<void> | null = null;
const loadInter = () => {
  if (!loading) {
    loading = Promise.all(
      FACES.map(async ([weight, file]) => {
        const face = new FontFace("Inter", `url(${staticFile(file)}) format("woff2")`, { weight });
        await face.load();
        (document.fonts as unknown as Set<FontFace>).add(face);
      }),
    ).then(() => undefined);
  }
  return loading;
};

/** Renders children only once Inter is loaded; holds the render (delayRender) until then. */
export const WithInter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading Inter"));
  useEffect(() => {
    loadInter()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
  }, [handle]);
  return ready ? <>{children}</> : null;
};
