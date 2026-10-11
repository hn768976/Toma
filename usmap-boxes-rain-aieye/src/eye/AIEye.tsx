import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill } from "remotion";
import { loadFonts } from "../lib/fonts";
import { ThreeStage } from "../lib/ThreeStage";
import { createEyePipeline, EyePalette } from "./eyePipeline";

export const AIEye: React.FC<{ palette: EyePalette }> = ({ palette }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setReady(true));
  }, []);
  const factory = useMemo(() => createEyePipeline(palette), [palette]);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgBottom }}>
      {ready ? <ThreeStage factory={factory} /> : null}
    </AbsoluteFill>
  );
};
