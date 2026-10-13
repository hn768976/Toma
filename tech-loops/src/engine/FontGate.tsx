import React, { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/** Loads a local font once, holding the render until it is ready, then renders children. */
export const FontGate: React.FC<{ family: string; file: string; children: React.ReactNode }> = ({ family, file, children }) => {
  const [handle] = useState(() => delayRender(`Loading font ${family}`));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight: "700" });
    face
      .load()
      .then((f) => {
        (document.fonts as unknown as { add(f: FontFace): void }).add(f);
        return document.fonts.load(`700 64px "${family}"`);
      })
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        throw err;
      });
  }, [family, file, handle]);
  return ready ? <>{children}</> : null;
};
