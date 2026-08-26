import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame} from 'remotion';
import {FONT_MONO, FONT_SANS, loadFonts} from './fonts';
import {HEIGHT, WIDTH} from './constants';
import {BUF_H, BUF_W, compositeDof, createBuffers} from './dof';
import {buildSeries} from './series';
import {drawScene} from './scene';
import {LIGHT, Theme} from './theme';
import {
  buildGrain,
  drawBloom,
  drawBreathe,
  drawGrain,
  drawHaze,
  drawVignette,
} from './finish';

export const CryptoTerminal: React.FC<{theme?: Theme}> = ({theme = LIGHT}) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender('Loading tabular fonts'));
  const [fontsReady, setFontsReady] = useState(false);
  const released = useRef(false);

  // The series is generated once and reused. Regenerating it per frame would
  // make the whole chart strobe.
  const series = useMemo(() => buildSeries(), []);
  const buffers = useMemo(() => createBuffers(), []);
  const grain = useMemo(() => buildGrain(theme), [theme]);
  const scratch = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = Math.round(WIDTH / 4);
    c.height = Math.round(HEIGHT / 4);
    return c;
  }, []);

  useEffect(() => {
    loadFonts()
      .then(() => setFontsReady(true))
      .catch((err) => cancelRender(err));
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontsReady) return;
    const out = canvas.getContext('2d');
    if (!out) return;

    // 1. The scene, drawn once into the master buffer.
    const master = buffers.master.getContext('2d') as CanvasRenderingContext2D;
    master.setTransform(1, 0, 0, 1, 0, 0);
    master.clearRect(0, 0, BUF_W, BUF_H);
    drawScene(master, frame, series, {mono: FONT_MONO, sans: FONT_SANS}, theme);

    // 2. Depth of field: three buffers, one blur each, composited far -> sharp.
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalCompositeOperation = 'source-over';
    out.globalAlpha = 1;
    out.filter = 'none';
    out.fillStyle = theme.bg;
    out.fillRect(0, 0, WIDTH, HEIGHT);
    compositeDof(out, buffers, theme);

    // 3. Finish.
    drawHaze(out, theme);
    drawBreathe(out, frame, theme);
    drawBloom(out, canvas, scratch, theme);
    drawVignette(out, theme);
    drawGrain(out, frame, grain, theme);

    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [frame, fontsReady, series, buffers, grain, scratch, handle, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{width: '100%', height: '100%', display: 'block', background: theme.bg}}
    />
  );
};
