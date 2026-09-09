import React, { useEffect, useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useCurrentScale,
  useVideoConfig,
} from "remotion";
import { StaticRenderer, type StaticVariant } from "./render-frame";

export type TVStaticProps = {
  variant: StaticVariant;
};

export const TVStatic: React.FC<TVStaticProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  // In the Studio this is the preview zoom; during a render it is 1.
  const previewScale = useCurrentScale();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<{
    renderer: StaticRenderer;
    image: ImageData;
    key: string;
  } | null>(null);

  // One delayRender handle per frame: acquired while rendering, released once
  // the pixels are on the canvas, so Remotion never captures a blank frame.
  const handleRef = useRef<number | null>(null);
  if (handleRef.current === null) {
    handleRef.current = delayRender(`TVStatic ${variant} frame ${frame}`);
  }

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Remotion implements `--scale` with the browser's device scale factor, so
    // devicePixelRatio is the render flag: 0.5 for the 1080p preview, 1 for
    // the 4K render. Multiplying by the preview zoom keeps the Studio
    // responsive. Either way the canvas holds exactly as many pixels as the
    // screenshot will, so the speckle is generated at output resolution and
    // never resampled — which is the whole point of the effect.
    const pixelScale = previewScale * (window.devicePixelRatio || 1);
    const outWidth = Math.max(1, Math.round(width * pixelScale));
    const outHeight = Math.max(1, Math.round(height * pixelScale));

    if (canvas.width !== outWidth || canvas.height !== outHeight) {
      canvas.width = outWidth;
      canvas.height = outHeight;
    }

    const key = `${outWidth}x${outHeight}:${variant}:${durationInFrames}`;
    if (!rendererRef.current || rendererRef.current.key !== key) {
      rendererRef.current = {
        renderer: new StaticRenderer(
          outWidth,
          outHeight,
          durationInFrames,
          variant,
        ),
        image: new ImageData(outWidth, outHeight),
        key,
      };
    }

    const { renderer, image } = rendererRef.current;
    renderer.render(frame, image.data);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.putImageData(image, 0, 0);
    }

    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  });

  useEffect(() => {
    return () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#7a7a7c" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          // Analogue speckle is a pixel-scale phenomenon; smoothing turns it
          // to mush.
          imageRendering: "pixelated",
        }}
      />
    </AbsoluteFill>
  );
};
