import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AMBER_PALETTE, BLUE_PALETTE } from "./palettes";
import { cameraAt, drawPlexusFrame, FONT_FAMILY } from "./renderer";
import { buildWorld } from "./world";

export type PlexusProps = {
  palette: "blue" | "amber";
  seed: number;
};

let fontPromise: Promise<void> | null = null;
const loadFont = () => {
  if (!fontPromise) {
    const face = new FontFace(
      FONT_FAMILY,
      `url(${staticFile("fonts/RobotoMono-Medium.woff2")}) format("woff2")`,
      { weight: "500" },
    );
    fontPromise = face.load().then((f) => {
      document.fonts.add(f);
    });
  }
  return fontPromise;
};

export const PlexusNetwork: React.FC<PlexusProps> = ({ palette, seed }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useMemo(() => buildWorld(seed), [seed]);
  const pal = palette === "amber" ? AMBER_PALETTE : BLUE_PALETTE;

  const [fontHandle] = useState(() => delayRender("Loading Roboto Mono"));
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    loadFont()
      .then(() => {
        setFontReady(true);
        continueRender(fontHandle);
      })
      .catch((err) => {
        console.error(err);
        continueRender(fontHandle);
      });
  }, [fontHandle]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const t = frame / fps;
    drawPlexusFrame(ctx, width, height, world, pal, cameraAt(t), t);
  }, [frame, fps, width, height, world, pal, fontReady]);

  return (
    <AbsoluteFill style={{ backgroundColor: pal.bgTop }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />
    </AbsoluteFill>
  );
};
