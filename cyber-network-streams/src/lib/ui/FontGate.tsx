import React, { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { loadFonts } from "../fonts";

// Mounts children only after Inter + JetBrains Mono are loaded, so canvas
// textures and text never draw with a fallback face.
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ok, setOk] = useState(false);
  const [handle] = useState(() => delayRender("FontGate"));
  useEffect(() => {
    loadFonts().then(() => {
      setOk(true);
      continueRender(handle);
    });
  }, [handle]);
  return ok ? <>{children}</> : null;
};
