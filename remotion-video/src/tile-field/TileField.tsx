import React, { useCallback, useEffect, useRef } from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { createTileFieldScene, type BackendPreference, type TileFieldScene } from './scene';
import { THEMES, type ThemeId } from './themes';

export type TileFieldProps = {
  themeId: ThemeId;
  /** 'auto' prefers WebGPU and drops to WebGL2 if the device is unusable. */
  backend?: BackendPreference;
};

/**
 * Remotion host for the three.js / WebGPU scene.
 *
 * The scene is a pure function of time, so a frame can be produced in isolation
 * and in any order -- which is exactly what Remotion's parallel renderer does.
 * Each frame is gated behind delayRender() until renderAsync() has resolved, so
 * the screenshot never catches a half-drawn buffer.
 */
export const TileField: React.FC<TileFieldProps> = ({ themeId, backend = 'auto' }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Promise<TileFieldScene> | null>(null);

  const theme = THEMES[themeId];

  const getScene = useCallback(() => {
    if (!sceneRef.current) {
      const container = containerRef.current;
      if (!container) {
        throw new Error('TileField: container is not mounted');
      }
      sceneRef.current = createTileFieldScene(container, theme, width, height, backend);
    }
    return sceneRef.current;
  }, [theme, width, height, backend]);

  useEffect(() => {
    return () => {
      const pending = sceneRef.current;
      sceneRef.current = null;
      pending?.then((scene) => scene.dispose()).catch(() => undefined);
    };
  }, [themeId, width, height, backend]);

  useEffect(() => {
    const handle = delayRender(`tile-field ${themeId} frame ${frame}`, {
      timeoutInMilliseconds: 300000,
    });

    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };

    (async () => {
      try {
        const scene = await getScene();
        scene.setTime(frame / fps);
        await scene.render();
        release();
      } catch (err) {
        released = true;
        cancelRender(err as Error);
      }
    })();

    return release;
  }, [frame, fps, getScene, themeId]);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.fogColor }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
