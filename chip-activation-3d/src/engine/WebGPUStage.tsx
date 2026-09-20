import React, { useEffect, useRef } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../themes';
import { createStage, type Stage } from './stage';

const TIMEOUT = 300000;

export interface WebGPUStageProps {
  theme: Theme;
  /** Diagnostics: render through the WebGL2 backend instead of WebGPU. */
  forceWebGL?: boolean;
  /** Diagnostics: skip bloom/DOF/grade for a fast preview. */
  disablePost?: boolean;
  /** Diagnostics: pin the procedural texture resolution. */
  textureSizeOverride?: number;
}

/**
 * Bridges Remotion's frame clock to a three.js WebGPU renderer.
 *
 * The renderer, scene and textures are created once per browser tab and
 * cached in a ref; every frame then calls `renderFrame(seconds)` and holds
 * a `delayRender` handle until the GPU has actually finished, so Remotion
 * never screenshots a half-drawn canvas.
 */
export const WebGPUStage: React.FC<WebGPUStageProps> = ({
  theme,
  forceWebGL,
  disablePost,
  textureSizeOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<Promise<Stage> | null>(null);

  // Texture density follows output resolution so 4K gains real detail while
  // the 1080p render keeps its memory footprint sane.
  const textureSize = textureSizeOverride ?? (width >= 2560 ? 4096 : 2048);

  useEffect(() => {
    const handle = delayRender(`Rendering frame ${frame} with WebGPU`, {
      timeoutInMilliseconds: TIMEOUT,
    });

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas not mounted');

        if (!stageRef.current) {
          stageRef.current = createStage({
            canvas,
            theme,
            width,
            height,
            textureSize,
            forceWebGL,
            enablePost: !disablePost,
          });
        }

        const stage = await stageRef.current;
        await stage.renderFrame(frame / fps);
        continueRender(handle);
      } catch (err) {
        cancelRender(err as Error);
      }
    })();
    // `frame` is the only value that changes during a render; the rest are
    // fixed per composition but listed so the stage rebuilds if they ever do.
  }, [frame, fps, width, height, theme, textureSize, forceWebGL, disablePost]);

  useEffect(() => {
    const pending = stageRef.current;
    return () => {
      pending?.then((s) => s.dispose()).catch(() => undefined);
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background[0] }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </AbsoluteFill>
  );
};
