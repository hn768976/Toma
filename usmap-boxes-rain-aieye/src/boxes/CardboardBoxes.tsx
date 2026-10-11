import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill } from "remotion";
import { loadFonts } from "../lib/fonts";
import { ThreeStage } from "../lib/ThreeStage";
import { BoxesPalette, createBoxesPipeline } from "./boxesPipeline";

export const CardboardBoxes: React.FC<{ palette: BoxesPalette }> = ({ palette }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setReady(true));
  }, []);
  const factory = useMemo(() => createBoxesPipeline(palette), [palette]);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.haze }}>
      {ready ? <ThreeStage factory={factory} /> : null}
    </AbsoluteFill>
  );
};
