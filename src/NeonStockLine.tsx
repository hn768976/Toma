import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {buildScene, drawFrame} from './lib/draw';
import {FONT_FAMILY, fontPromise, isFontReady} from './lib/font';
import {COLOR} from './lib/theme';

export const NeonStockLine: React.FC = () => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The only piece of state in the composition, and it is not animation state:
  // it flips once when the webfont resolves so the Studio repaints. Every
  // rendered frame is still a pure function of the frame number, because
  // delayRender() guarantees this is already true before any capture.
  const [ready, setReady] = useState(isFontReady);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    fontPromise.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ready]);

  // Generated ONCE. Regenerating the price series per frame would make the
  // whole line strobe; rebuilding the label tiles per frame would tank the
  // render.
  const scene = useMemo(() => buildScene(), []);

  // Drawn once per React render, synchronously before paint. No
  // requestAnimationFrame anywhere — the frame number is the only clock.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawFrame(canvas, scene, frame, width, FONT_FAMILY, ready);
  });

  return (
    <AbsoluteFill style={{backgroundColor: COLOR.bg}}>
      <canvas
        ref={canvasRef}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
    </AbsoluteFill>
  );
};
