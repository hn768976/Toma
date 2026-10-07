import React, { useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { fontsReady } from "../../lib/fonts";
import { useCanvasSize } from "../../lib/canvasSize";
import { getMapRenderer } from "./MapRenderer";

/** Look 3: Glitch Dot Map (Canvas 2D, no GPU). Mono only. */
export const GlitchDotMap: React.FC<{ glyphStress?: number }> = ({ glyphStress = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { width: cw, height: ch } = useCanvasSize();
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("GlitchDotMap first draw"));
  const [released, setReleased] = useState(false);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    fontsReady.then(() => setReady(true));
  }, []);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !ready) return;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    getMapRenderer(cw, ch).draw(ctx, frame, glyphStress);
    if (!released) {
      setReleased(true);
      continueRender(handle);
    }
  }, [frame, ready, cw, ch, handle, released, glyphStress]);

  return (
    <div style={{ width, height, background: "#000" }}>
      <canvas ref={ref} width={cw} height={ch} style={{ width, height, display: "block" }} />
    </div>
  );
};
