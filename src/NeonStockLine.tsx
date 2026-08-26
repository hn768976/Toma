import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {buildScene, drawFrame} from './lib/draw';
import {FONT_FAMILY, fontPromise, isFontReady} from './lib/font';
import {Variant, resolveVariant} from './lib/variants';

export type NeonStockLineProps = {
  /** which piece this is: the rising green one, or the falling red one */
  variant: Variant;
};

export const NeonStockLine: React.FC<NeonStockLineProps> = ({variant}) => {
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

  // Generated ONCE per variant. Regenerating the price series per frame would
  // make the whole line strobe; rebuilding the label tiles per frame would tank
  // the render.
  const cfg = resolveVariant(variant);
  const scene = useMemo(() => buildScene(cfg), [cfg]);

  // Drawn once per React render, synchronously before paint. No
  // requestAnimationFrame anywhere — the frame number is the only clock.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawFrame(canvas, scene, frame, width, FONT_FAMILY, ready);
  });

  return (
    <AbsoluteFill style={{backgroundColor: cfg.theme.bg}}>
      <canvas
        ref={canvasRef}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
    </AbsoluteFill>
  );
};
