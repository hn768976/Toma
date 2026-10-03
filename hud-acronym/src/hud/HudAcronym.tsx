import { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, getRemotionEnvironment, staticFile, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { HudScene } from "./HudScene";
import { FONT_FAMILY, FONT_WEIGHT } from "./wordTexture";

export type HudAcronymProps = { text: string; loopCheck?: boolean };

// Font is loaded once per tab, behind delayRender, before the word texture is drawn.
let fontPromise: Promise<void> | null = null;
const loadFont = () => {
  if (!fontPromise) {
    const face = new FontFace(FONT_FAMILY, `url(${staticFile("fonts/Oxanium-SemiBold.woff2")}) format("woff2")`, {
      weight: String(FONT_WEIGHT),
    });
    fontPromise = face.load().then((f) => {
      (document.fonts as unknown as Set<FontFace>).add(f);
    });
  }
  return fontPromise;
};

export const HudAcronym: React.FC<HudAcronymProps> = ({ text }) => {
  const { width, height } = useVideoConfig();
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading Oxanium font"));

  useEffect(() => {
    loadFont()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        throw e;
      });
  }, [handle]);

  // While rendering, Remotion's --scale sets devicePixelRatio, so the WebGL buffer
  // matches the output size. In the Studio, cap the buffer at 1920px wide.
  const dpr = getRemotionEnvironment().isRendering ? window.devicePixelRatio : 1920 / width;

  return (
    <AbsoluteFill style={{ backgroundColor: "#03131A" }}>
      {ready ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" }}
        >
          <HudScene text={text} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
