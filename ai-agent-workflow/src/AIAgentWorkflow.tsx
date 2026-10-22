import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { NoToneMapping } from "three";
import { FONT_LABEL, FONT_MONO } from "./draw/panels";
import { T } from "./layout";
import { World } from "./scene/World";
import { PALETTES, type CompProps } from "./theme";
import { rgba } from "./util";

const FONTS: [string, string, string][] = [
  [FONT_LABEL, "fonts/rajdhani-latin-700-normal.woff2", "700"],
  [FONT_LABEL, "fonts/rajdhani-latin-600-normal.woff2", "600"],
  [FONT_MONO, "fonts/jetbrains-mono-latin-400-normal.woff2", "400"],
];

/** Canvas 2D needs the faces loaded before the first texture is painted. */
const useFonts = () => {
  const [ready, setReady] = useState(false);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    Promise.all(
      FONTS.map(([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        document.fonts.add(face);
        return face.load();
      }),
    )
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle, continueRender, cancelRender]);
  return ready;
};

export const AIAgentWorkflow: React.FC<CompProps> = ({ palette }) => {
  const pal = PALETTES[palette];
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const fontsReady = useFonts();
  const fade = interpolate(frame, T.sceneFadeIn, [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: pal.bgEdge }}>
      {fontsReady && (
        <ThreeCanvas
          width={width}
          height={height}
          // Remotion's --scale sets devicePixelRatio; never exceed the comp size.
          dpr={Math.min(window.devicePixelRatio || 1, 1)}
          gl={{ antialias: true, toneMapping: NoToneMapping, preserveDrawingBuffer: true }}
          flat
        >
          <World pal={pal} />
        </ThreeCanvas>
      )}
      {/* Lens vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 75% at 38% 40%, rgba(0,0,0,0) 50%, ${rgba(pal.bgEdge, 0.8)} 100%), linear-gradient(90deg, rgba(0,0,0,0) 55%, ${rgba(pal.bgEdge, 0.5)} 100%)`,
        }}
      />
      {/* Opening fade from the bare backdrop */}
      <AbsoluteFill
        style={{
          opacity: fade,
          background: `radial-gradient(ellipse 70% 70% at 42% 42%, ${pal.bgCenter} 0%, ${pal.bgMid} 50%, ${pal.bgEdge} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
