import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { continueRender, delayRender, useCurrentFrame } from 'remotion';
import { buildBuffers } from './board/buffers';
import { HEIGHT, SUBSTRATE, WIDTH } from './board/constants';
import { buildColumns, buildSchedule } from './board/data';
import { renderFrame } from './board/draw';
import { FONT_FAMILY, loadBoardFont } from './board/font';

const fontReady = loadBoardFont();
let FONT_LOADED = false;
fontReady.then(() => {
  FONT_LOADED = true;
});

/**
 * A macro shot of a market data screen.
 *
 * Everything here is a pure function of `useCurrentFrame()`. There is no
 * requestAnimationFrame, no Date.now, no CSS animation and no animation state:
 * the canvas is redrawn from scratch on every React render, so `remotion
 * render` produces the same pixels on every pass and the 1160-frame loop closes
 * exactly.
 */
export const TickerBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [ready, setReady] = useState(FONT_LOADED);
  const [handle] = useState(() =>
    FONT_LOADED ? null : delayRender('Loading Roboto Mono'),
  );
  const released = useRef(false);

  useEffect(() => {
    if (handle === null) return;
    let live = true;
    fontReady.then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [handle]);

  // Built once and reused for every frame. Regenerating the value lists per
  // frame is what would make every number on the board strobe.
  const columns = useMemo(() => buildColumns(), []);
  const schedule = useMemo(() => buildSchedule(columns), [columns]);
  const buffers = useMemo(() => (ready ? buildBuffers() : null), [ready]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffers || !ready) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, buffers, frame, columns, schedule, FONT_FAMILY);
  });

  // Only release the render once the first frame has actually been painted,
  // so nothing can be captured before the font is in place.
  useEffect(() => {
    if (ready && handle !== null && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [ready, handle]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{ width: '100%', height: '100%', backgroundColor: SUBSTRATE }}
    />
  );
};
