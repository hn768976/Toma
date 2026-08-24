import React, { useLayoutEffect, useRef } from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { createScene, drawFrame } from './engine/cyber-alert.js';

/**
 * Thin Remotion host around the canvas engine.
 *
 * The engine is a pure function of the frame index, so Remotion can seek to
 * any frame in any order and still get the correct pixels — no playback state
 * to keep in sync. The scene (strip sprites, bokeh sprites, glitch schedule)
 * is built once and cached on a ref, since Remotion reuses the same page
 * across the frames it renders.
 */
export const CyberAlert: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);

  useLayoutEffect(() => {
    const handle = delayRender(`cyber-alert frame ${frame}`);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      if (
        !sceneRef.current ||
        sceneRef.current.width !== width ||
        sceneRef.current.height !== height
      ) {
        sceneRef.current = createScene(width, height);
      }

      drawFrame(ctx, sceneRef.current, frame);
    } finally {
      continueRender(handle);
    }
  }, [frame, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </AbsoluteFill>
  );
};
