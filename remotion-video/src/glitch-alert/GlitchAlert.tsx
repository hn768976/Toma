import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { areFontsReady, fontsReady } from "./fonts";
import { BASE_WIDTH, BG_COLOR, FPS } from "./constants";
import { renderFrame, type Layers } from "./render-frame";
import type { Scene } from "./draw";

export const glitchAlertSchema = z.object({
  /** The word set under the warning triangle. */
  headline: z.string().min(1),
});

export type GlitchAlertProps = z.infer<typeof glitchAlertSchema>;

export const glitchAlertDefaults: GlitchAlertProps = {
  headline: "PHISHING ATTACK",
};

/**
 * A cyber-alert warning screen: a red alert triangle and headline over an
 * animated blue pixel-mosaic field, interrupted by scheduled signal
 * glitches.
 *
 * The whole picture is painted into one canvas on every frame. Output
 * size is the only thing that differs between the 1080p and 4K
 * compositions — geometry is authored at 1920x1080 and multiplied by
 * `width / 1920`, so both renders show an identical image.
 */
export const GlitchAlert: React.FC<GlitchAlertProps> = ({ headline }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layersRef = useRef<Layers | null>(null);

  const scene: Scene = useMemo(
    () => ({
      frame,
      seconds: frame / FPS,
      scale: width / BASE_WIDTH,
      width,
      height,
    }),
    [frame, width, height],
  );

  // Allocating the offscreen layers on every frame would mean ~130 MB of
  // canvas churn per frame at 4K, so they are created once and resized
  // only if the composition dimensions change.
  const getLayers = (): Layers => {
    const existing = layersRef.current;
    if (existing && existing.background.width === width) return existing;

    const make = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };
    const layers: Layers = {
      background: make(),
      foreground: make(),
      scratch: make(),
      tint: make(),
    };
    layersRef.current = layers;
    return layers;
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The headline is drawn with fillText, which silently falls back to a
  // system face if Archivo Black is not registered yet. Gate the first
  // paint on the fonts, and hold the render open until that paint has
  // actually happened.
  const [fontsLoaded, setFontsLoaded] = useState(areFontsReady);
  const fontHandle = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (fontsLoaded) return;
    fontHandle.current = delayRender("Waiting for glitch-alert fonts");
    let cancelled = false;
    fontsReady.then(() => {
      if (!cancelled) setFontsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded]);

  // useLayoutEffect, not useEffect: it runs before the browser paints, so
  // Remotion never captures a frame showing the previous frame's pixels.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontsLoaded) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    renderFrame(ctx, getLayers(), scene, headline);

    if (fontHandle.current !== undefined) {
      continueRender(fontHandle.current);
      fontHandle.current = undefined;
    }
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
