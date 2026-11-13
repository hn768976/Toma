import { useEffect, useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useDelayRender } from 'remotion';
import { PixiMap, type MapStyle } from './pixiMap';

export const dpr = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

// A PixiJS map canvas placed at (x, y, w, h) in 4K composition pixels.
// `draw` is called synchronously for every frame; it must be a pure function of the frame.
export const MapCanvas: React.FC<{
  style: MapStyle; x?: number; y?: number; w: number; h: number; cssStyle?: React.CSSProperties;
  draw: (map: PixiMap, frame: number) => void;
}> = ({ style, x = 0, y = 0, w, h, cssStyle, draw }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<PixiMap | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const k = dpr();
  const pxW = Math.round(w * k), pxH = Math.round(h * k);

  useEffect(() => {
    const handle = delayRender('Building PixiJS map geometry');
    let dead = false;
    PixiMap.create(ref.current!, pxW, pxH, pxW / w, style)
      .then((m) => {
        if (dead) { m.destroy(); return; }
        mapRef.current = m;
        drawRef.current(m, frameRef.current);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      dead = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (mapRef.current) drawRef.current(mapRef.current, frame);
  }, [frame]);

  return (
    <canvas
      ref={ref}
      width={pxW}
      height={pxH}
      style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...cssStyle }}
    />
  );
};
