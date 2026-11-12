import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";
import { useThreeScene } from "../lib/useThreeScene";
import { makeFinanceBuilder } from "./buildFinance";
import { FONT_FAMILY } from "./atlas";
import { STUDIO_GREY } from "./palettes";
import { ORBIT_GLIDE, SLOW_PUSH } from "./cameraRigs";

export type FinanceInfographicsProps = { variant: "v1" | "v2" };

const useFont = () => {
  const [handle] = useState(() => delayRender("Loading Inter Light"));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const font = new FontFace(
      FONT_FAMILY,
      `url('${staticFile("fonts/Inter-Light.otf")}') format('opentype')`,
      { weight: "300" },
    );
    font
      .load()
      .then((f) => {
        document.fonts.add(f);
        setLoaded(true);
        continueRender(handle);
      })
      .catch((err) => {
        console.error(err);
        continueRender(handle);
        throw err;
      });
  }, [handle]);
  return loaded;
};

export const FinanceInfographics: React.FC<FinanceInfographicsProps> = ({
  variant,
}) => {
  const fontReady = useFont();
  const builder = useMemo(
    () => makeFinanceBuilder(STUDIO_GREY, variant === "v1" ? SLOW_PUSH : ORBIT_GLIDE),
    [variant],
  );
  const canvasRef = useThreeScene(builder, fontReady);
  return (
    <AbsoluteFill style={{ backgroundColor: "#d0d0d0" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
