import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { drawBase } from "./base";
import { PALETTE } from "./constants";
import { direct } from "./director";
import { fontsLoaded, fontsReady } from "./fonts";
import { applyGlitch } from "./glitch";
import { invalidateStrips } from "./layers";

export const cyberAttackSchema = z.object({
  /**
   * Extra multiplier on the glitch, if the edit needs to be pushed harder
   * or pulled back without re-timing the director.
   */
  intensityScale: z.number().min(0).max(2),
});

export const cyberAttackDefaults: z.infer<typeof cyberAttackSchema> = {
  intensityScale: 1,
};

/**
 * "Cyber Attack / System Hacked" — a 20s broken-signal loop.
 *
 * The frame is composed twice: once clean into an offscreen canvas, then
 * torn apart onto the visible one. Nothing is resolution-baked, so the
 * 1080p and 4K compositions render the identical edit at two sizes.
 */
export const CyberAttack: React.FC<z.infer<typeof cyberAttackSchema>> = ({
  intensityScale,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(() => fontsLoaded());

  // Frame 0's effect can run before the faces are measurable. Hold a
  // render handle until they are, then drop the strips that were
  // rasterised with the fallback font and redraw.
  useEffect(() => {
    if (ready) return;
    const handle = delayRender("cyber-attack: waiting for fonts");
    let live = true;
    fontsReady.then(() => {
      if (!live) return;
      invalidateStrips();
      setReady(true);
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const visible = canvasRef.current;
    if (!visible) return;

    if (
      !cleanRef.current ||
      cleanRef.current.width !== width ||
      cleanRef.current.height !== height
    ) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      cleanRef.current = c;
    }
    const clean = cleanRef.current;
    const cleanCtx = clean.getContext("2d", { alpha: false });
    const outCtx = visible.getContext("2d", { alpha: false });
    if (!cleanCtx || !outCtx) return;

    const state = direct(frame);
    const scaled = {
      ...state,
      intensity: Math.min(1, state.intensity * intensityScale),
      flash: state.flash * Math.min(1, intensityScale),
      invert: state.invert && intensityScale > 0.5,
    };

    cleanCtx.save();
    cleanCtx.globalCompositeOperation = "source-over";
    cleanCtx.globalAlpha = 1;
    drawBase(cleanCtx, scaled, frame, width, height);
    cleanCtx.restore();

    outCtx.save();
    applyGlitch(outCtx, clean, scaled, frame, width, height);
    outCtx.restore();
  }, [frame, width, height, ready, intensityScale]);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.backdrop }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
