import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { CODE_FONT_FAMILY } from "./code-sheets";
import { PALETTES } from "./palettes";
import { createCodeGridScene, type CodeGridScene } from "./scene";

export const codeGridSchema = z.object({
  palette: z.enum(["cyberBlue", "emberGold"]),
});

export type CodeGridProps = z.infer<typeof codeGridSchema>;

const loadCodeFont = async () => {
  const face = new FontFace(
    CODE_FONT_FAMILY,
    `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")}) format("woff2")`,
    { weight: "500", style: "normal", featureSettings: '"liga" 0, "calt" 0' },
  );
  document.fonts.add(await face.load());
};

// A wall of glowing glass cubes, each holding a scrolling code screen,
// seen from inside the lattice. Rendered with three.js (WebGL2) + bloom
// into a single canvas at the composition's native size.
export const CodeGrid: React.FC<CodeGridProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CodeGridScene | null>(null);
  const [ready, setReady] = useState(false);
  const [setupHandle] = useState(() => delayRender("Building code-grid scene"));
  const releasedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadCodeFont()
      .catch((err) => console.error("Code font failed to load", err))
      .then(() => {
        if (cancelled || !canvasRef.current) return;
        sceneRef.current = createCodeGridScene(canvasRef.current, width, height, PALETTES[palette]);
        setReady(true);
      });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setReady(false);
    };
  }, [width, height, palette]);

  useLayoutEffect(() => {
    if (!ready || !sceneRef.current) return;
    sceneRef.current.render(frame);
    if (!releasedRef.current) {
      releasedRef.current = true;
      continueRender(setupHandle);
    }
  }, [frame, ready, setupHandle]);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTES[palette].background }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
