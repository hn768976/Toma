import { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CountdownRenderer } from "./CountdownRenderer";
import { FONT_FAMILY } from "./glyphs";
import { COOL, EMBER } from "./palette";

export type ParticleCountdownProps = {
  palette: "cool" | "ember";
};

let fontPromise: Promise<void> | null = null;
const loadFont = () => {
  if (!fontPromise) {
    const face = new FontFace(FONT_FAMILY, `url(${staticFile("fonts/Barlow-Medium.woff2")}) format("woff2")`, {
      weight: "500",
    });
    fontPromise = face.load().then((f) => {
      document.fonts.add(f);
    });
  }
  return fontPromise;
};

/**
 * Remotion wrapper. The WebGL 2 canvas renders at the composition's native size
 * (3840×2160); `--scale=0.5` supersamples that to a 1920×1080 deliverable.
 */
export const ParticleCountdown: React.FC<ParticleCountdownProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CountdownRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading font + building particle buffers"));
  const continued = useRef(false);

  useLayoutEffect(() => {
    let disposed = false;
    loadFont()
      .then(() => {
        if (disposed || !canvasRef.current) return;
        rendererRef.current = new CountdownRenderer(
          canvasRef.current,
          width,
          height,
          palette === "ember" ? EMBER : COOL,
        );
        setReady(true);
      })
      .catch((err) => cancelRender(err));
    return () => {
      disposed = true;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      setReady(false);
    };
  }, [width, height, palette]);

  useLayoutEffect(() => {
    if (!ready || !rendererRef.current) return;
    rendererRef.current.render(frame);
    if (!continued.current) {
      continued.current = true;
      continueRender(handle);
    }
  }, [frame, ready, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
