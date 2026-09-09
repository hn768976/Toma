import React, {useCallback, useEffect, useRef} from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {SceneConfig} from '../config';
import {DataFlowRenderer} from '../gl/renderer';

/**
 * Drives the WebGL pipeline straight off `useCurrentFrame()`. Nothing in the
 * render path reads the clock or Math.random, so any frame can be rendered in
 * isolation and always looks the same.
 */
export const DataFlowScene: React.FC<{config: SceneConfig}> = ({config}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DataFlowRenderer | null>(null);
  const engineKeyRef = useRef<string>('');
  const handleRef = useRef<number | null>(null);

  if (handleRef.current === null) {
    handleRef.current = delayRender(`data-flow ${config.id}`);
  }

  const release = useCallback(() => {
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Build the field once and reuse it for every frame. Switching composition
    // in Studio changes the config or the size, so rebuild in that case only.
    const key = `${config.id}:${width}x${height}`;
    if (engineKeyRef.current !== key) {
      engineRef.current?.dispose();
      engineRef.current = new DataFlowRenderer(canvas, config, width, height);
      engineKeyRef.current = key;
    }
    engineRef.current?.render(frame);
    release();
  }, [frame, width, height, config, release]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      engineKeyRef.current = '';
    };
  }, []);

  return (
    <AbsoluteFill style={{backgroundColor: config.background.base}}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
    </AbsoluteFill>
  );
};
