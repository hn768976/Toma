import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  cancelRender,
  continueRender,
  delayRender,
  random,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import * as C from './constants';
import {FONT_FAMILY, loadMonoFont} from './font';
import {buildField} from './field';
import {buildGrainTiles, buildSprites, makeMeasure, makeScratch} from './sprites';
import {drawFrame} from './draw';

/**
 * Module-scoped so that only the first mounted instance in a render worker
 * pays the font wait; every later frame finds it already true.
 */
let fontsReady = false;

const ensureFonts = async () => {
  await loadMonoFont();
  fontsReady = true;
};

export const CodeFlythrough: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Held until the fonts have loaded AND the first real frame has been
  // rastered, so nothing is ever captured half-drawn.
  const handleRef = useRef<number | null>(null);
  if (handleRef.current === null && !fontsReady) {
    handleRef.current = delayRender('CodeFlythrough: font + first raster');
  }

  const [ready, setReady] = useState(fontsReady);

  useEffect(() => {
    if (ready) return;
    let alive = true;
    ensureFonts()
      .then(() => {
        if (alive) setReady(true);
      })
      .catch((err) => cancelRender(err as Error));
    return () => {
      alive = false;
    };
  }, [ready]);

  useEffect(
    () => () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    },
    [],
  );

  // ---- generated once, reused for all 540 frames -------------------------
  const field = useMemo(
    () => (ready ? buildField(makeMeasure(FONT_FAMILY)) : null),
    [ready],
  );

  const sprites = useMemo(
    () => (field ? buildSprites(field, FONT_FAMILY) : null),
    [field],
  );

  /** Far to near, so close elements occlude distant ones. */
  const order = useMemo(() => {
    if (!field) return null;
    return field
      .map((_, i) => i)
      .sort((a, b) => (field[a] as {z: number}).z - (field[b] as {z: number}).z);
  }, [field]);

  const grain = useMemo(() => (ready ? buildGrainTiles(random) : null), [ready]);
  const scratch = useMemo(() => makeScratch(width, height), [width, height]);

  // ---- one draw per React render, no rAF ---------------------------------
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', {alpha: false});
    if (!ctx) return;

    if (!field || !sprites || !order || !grain) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = C.COLORS.bg;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    drawFrame({
      ctx,
      canvas,
      field,
      sprites,
      order,
      grain,
      scratch,
      frame,
      width,
      height,
      rand: random,
      fontFamily: FONT_FAMILY,
    });

    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        backgroundColor: C.COLORS.bg,
      }}
    />
  );
};
