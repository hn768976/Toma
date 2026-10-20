// Tegaki handwriting, frame-driven.
//
// Adapted from Tegaki's Remotion example (which renders <TegakiRenderer
// time={{ mode: 'controlled', value: frame / duration, unit: 'progress' }}>):
//  * we drive the TegakiEngine (tegaki/core) directly from a useLayoutEffect, so
//    each frame is drawn synchronously for exactly that frame, under delayRender;
//  * time is always 'controlled' (Tegaki's own requestAnimationFrame clock and
//    uncontrolled playback are never used), quantised on twos by the caller;
//  * the boil is our own Tegaki geometry/outline plugin keyed to floor(frame/3)
//    (Tegaki's boil plugin derives its drawing from the clock; ours is wrapped so
//    the drawing index comes from the frame instead);
//  * the Caveat files come from public/fonts (OFL) and are loaded once, via a
//    module-level promise awaited behind delayRender.
import React, { useLayoutEffect, useRef } from 'react';
import { continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import { boilPlugin, TegakiEngine, variationPlugin } from 'tegaki/core';
import type { TegakiPlugin } from 'tegaki/core';
import caveatBundle from 'tegaki/fonts/caveat';
import { boilStep } from './random';

const fontUrl = staticFile('fonts/Caveat-tegaki-subset.ttf');
const fullFontUrl = staticFile('fonts/Caveat.ttf');

export const CAVEAT = {
  ...caveatBundle,
  fontUrl,
  fullFontUrl,
  fontFaceCSS: `@font-face { font-family: '${caveatBundle.family}'; src: url(${fontUrl}); } @font-face { font-family: 'Caveat'; src: url(${fullFontUrl}); }`,
};

/** Fonts load once for the whole bundle. */
let fontsReady: Promise<void> | null = null;
const loadFonts = () => (fontsReady ??= TegakiEngine.preload(CAVEAT as never));

/** Boil plugin whose drawing comes from the frame (floor(frame/3)), not from Tegaki's clock. */
const boilBase = boilPlugin({ drawings: 8, fps: 10, amount: 0.006, detail: 0.35, width: 0.07, idle: true }) as TegakiPlugin;
/** Per-letter irregularity (Tegaki's variation plugin): no two letters drawn alike. */
const variation = variationPlugin({ amount: 1.3 }) as TegakiPlugin;
const boilCache = new Map<number, TegakiPlugin>();
const frameBoil = (step: number): TegakiPlugin => {
  const key = ((step % 997) + 997) % 997;
  let p = boilCache.get(key);
  if (!p) {
    p = {
      name: 'frame-boil',
      geometry: (path, g) => boilBase.geometry!(path, { ...g, step: key }),
      outline: (contour, o) => boilBase.outline!(contour, { ...o, step: key }),
    };
    boilCache.set(key, p);
  }
  return p;
};

export interface TegakiTextProps {
  text: string;
  /** 0..1 writing progress for this frame (caller quantises on twos) */
  progress: number;
  fontSize: number;
  color: string;
  seed: number;
  style?: React.CSSProperties;
}

export const TegakiText: React.FC<TegakiTextProps> = ({ text, progress, fontSize, color, seed, style }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLDivElement>(null);
  const engine = useRef<TegakiEngine | null>(null);

  useLayoutEffect(() => {
    const handle = delayRender(`tegaki ${text} @${frame}`);
    let live = true;
    loadFonts().then(() => {
      if (!live) return;
      const opts = {
        text,
        font: CAVEAT as never,
        seed,
        time: { mode: 'controlled' as const, value: Math.min(1, Math.max(0, progress)), unit: 'progress' as const },
        plugins: [variation, frameBoil(boilStep(frame))],
        quality: { pixelRatio: 2 },
        reducedMotion: 'never' as const,
      };
      if (!engine.current) engine.current = new TegakiEngine(ref.current!, opts);
      else engine.current.update(opts);
      continueRender(handle);
    });
    return () => {
      live = false;
      continueRender(handle);
    };
  }, [frame, text, progress, seed]);

  useLayoutEffect(
    () => () => {
      engine.current?.destroy();
      engine.current = null;
    },
    [],
  );

  return <div ref={ref} style={{ fontSize, color, lineHeight: 1, whiteSpace: 'nowrap', ...style }} />;
};
