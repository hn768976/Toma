import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, useCurrentFrame, useDelayRender} from 'remotion';
import {Application} from 'pixi.js';
import {loadLand, loadPlaces} from '../lib/geo';
import {CYAN, DigitalMapScene, H, W} from './DigitalMapScene';

export type DigitalWorldMapProps = {loopCheck?: boolean};

export const DigitalWorldMap: React.FC<DigitalWorldMapProps> = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [initHandle] = useState(() => delayRender('Initialising PixiJS', {timeoutInMilliseconds: 120000}));
  // Loading gate only: null until the Pixi app and scene exist.
  const [scene, setScene] = useState<DigitalMapScene | null>(null);

  useEffect(() => {
    let alive = true;
    let app: Application | null = null;
    (async () => {
      const [land, places] = await Promise.all([loadLand(), loadPlaces()]);
      app = new Application();
      await app.init({
        canvas: canvasRef.current!,
        width: W,
        height: H,
        resolution: window.devicePixelRatio,
        autoDensity: true,
        preference: 'webgl',
        antialias: true,
        autoStart: false,
        preserveDrawingBuffer: true,
        backgroundColor: 0x000000,
        backgroundAlpha: 1,
      });
      app.ticker.stop();
      if (!alive) return;
      setScene(new DigitalMapScene(app, CYAN, land, places));
    })().catch((e) => cancelRender(e));
    return () => {
      alive = false;
      app?.destroy();
    };
  }, [cancelRender]);

  // One app.render() per Remotion frame, derived from the frame number only.
  useLayoutEffect(() => {
    scene?.render(frame);
  }, [scene, frame]);

  useEffect(() => {
    if (scene) continueRender(initHandle);
  }, [scene, initHandle, continueRender]);

  return (
    <AbsoluteFill style={{backgroundColor: '#020A10'}}>
      <canvas ref={canvasRef} style={{width: W, height: H}} />
    </AbsoluteFill>
  );
};
