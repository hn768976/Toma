import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH } from "./constants";
import { fontPromise, isFontReady } from "./load-archivo";
import { Buffers, createBuffers, drawFrame } from "./render";
import { clearBandCache } from "./strip";

/**
 * Macro shot of a physical LED stock ticker board: six bands of financial
 * data scrolling at an angle across a tilted dot-matrix panel.
 *
 * The canvas is repainted once per React render straight from the current
 * frame number — no requestAnimationFrame, no component state driving motion —
 * so `npx remotion render` is deterministic and every worker agrees.
 */
export const LedTicker: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buffersRef = useRef<Buffers | null>(null);
  const [fontReady, setFontReady] = useState(isFontReady);

  useEffect(() => {
    if (fontReady) {
      return;
    }
    let live = true;
    fontPromise.then(() => {
      if (live) {
        // Anything sampled with the fallback face is stale.
        clearBandCache();
        setFontReady(true);
      }
    });
    return () => {
      live = false;
    };
  }, [fontReady]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontReady) {
      return;
    }
    if (!buffersRef.current) {
      buffersRef.current = createBuffers();
    }
    drawFrame(canvas, buffersRef.current, frame);
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        backgroundColor: "#000000",
      }}
    />
  );
};
