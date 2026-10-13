import React, { useEffect, useMemo, useState } from "react";
import { useDelayRender } from "remotion";
import { loadGlyphAtlas } from "../lib/glyphAtlas";
import { ThreeStage } from "../lib/ThreeStage";
import { BinaryVersion, makeBinary } from "./binary";

// Waits (delayRender) for the font + glyph atlas before mounting the scene.
export const BinaryStage: React.FC<{ v: BinaryVersion }> = ({ v }) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading JetBrains Mono glyph atlas"));
  const [atlas, setAtlas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    loadGlyphAtlas().then((c) => { setAtlas(c); continueRender(handle); }).catch((e) => cancelRender(e));
  }, [handle, continueRender, cancelRender]);
  const build = useMemo(() => (atlas ? makeBinary(v, atlas) : null), [atlas, v]);
  return build ? <ThreeStage build={build} /> : null;
};
