import { useEffect, useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useDelayRender } from 'remotion';
import { loadFonts } from '../lib/fonts';
import { dpr } from '../render/MapCanvas';

// Canvas 2D HUD layer. `draw` receives a context already scaled so that
// drawing coordinates are 4K composition pixels.
export const HudCanvas: React.FC<{
  w?: number; h?: number; x?: number; y?: number; z?: number;
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void;
}> = ({ w = 3840, h = 2160, x = 0, y = 0, z = 2, draw }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const ready = useRef(false);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const k = dpr();
  const pxW = Math.round(w * k), pxH = Math.round(h * k);
  const paint = (f: number) => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxH);
    ctx.setTransform(pxW / w, 0, 0, pxH / h, 0, 0);
    drawRef.current(ctx, f);
  };
  useEffect(() => {
    const handle = delayRender('Loading HUD fonts');
    loadFonts()
      .then(() => { ready.current = true; paint(frameRef.current); continueRender(handle); })
      .catch((e) => cancelRender(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    if (ready.current) paint(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);
  return <canvas ref={ref} width={pxW} height={pxH} style={{ position: 'absolute', left: x, top: y, width: w, height: h, zIndex: z }} />;
};
