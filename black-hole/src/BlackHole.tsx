import React, {useLayoutEffect, useRef, useState} from 'react';
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useCurrentScale,
  useVideoConfig,
} from 'remotion';
import {BlackHoleRenderer} from './gl/renderer';
import {LOOK, type PaletteId, PALETTE_INDEX} from './look';

export const BlackHole: React.FC<{palette: PaletteId}> = ({palette}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const scale = useCurrentScale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BlackHoleRenderer | null>(null);
  const [handle] = useState(() => delayRender('Initialising the lensing shader'));
  const readyRef = useRef(false);

  // Back the canvas with exactly as many device pixels as the output needs, so
  // a --scale=0.5 preview traces 1920x1080 rays rather than 3840x2160 of them.
  // useCurrentScale covers the Studio's preview zoom; devicePixelRatio covers
  // the renderer's --scale, which it applies as the page's device scale factor.
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const density = Math.min(scale * dpr, 1);
  const pxWidth = Math.max(2, Math.round(width * density));
  const pxHeight = Math.max(2, Math.round(height * density));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (!rendererRef.current) {
        rendererRef.current = new BlackHoleRenderer(canvas);
      }
      const renderer = rendererRef.current;
      if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
        canvas.width = pxWidth;
        canvas.height = pxHeight;
      }
      renderer.resize(pxWidth, pxHeight);
      renderer.render({
        // Normalised loop position. Every time-varying term in the shader is
        // periodic in this, so frame 900 would land exactly on frame 0.
        t: (frame % durationInFrames) / durationInFrames,
        palette: PALETTE_INDEX[palette],
        center: LOOK.center,
        ss: LOOK.supersample,
        exposure: LOOK.exposure,
        grain: LOOK.grain,
        grainSeed: frame % durationInFrames,
        bloomTight: LOOK.bloomTight,
        bloomWide: LOOK.bloomWide,
        bloomThreshold: LOOK.bloomThreshold,
      });
      if (!readyRef.current) {
        readyRef.current = true;
        continueRender(handle);
      }
    } catch (err) {
      cancelRender(err as Error);
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={pxWidth}
      height={pxHeight}
      style={{
        width,
        height,
        display: 'block',
        backgroundColor: '#000',
      }}
    />
  );
};
