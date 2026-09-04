import React from 'react';
import { Layer } from './Layer';
import { KeyedFigure } from '../lib/figure';

type Props = {
  figure: KeyedFigure | null;
  /** Silhouette height as a fraction of the frame height. */
  height: number;
  /** Centre of the silhouette horizontally, as a fraction of the frame width. */
  cx: number;
  /** Underside of the figure, as a fraction of the frame height. */
  bottom: number;
};

/** Geometry of the placed silhouette, in composition pixels. */
export const figureBox = (
  figure: KeyedFigure,
  w: number,
  h: number,
  height: number,
  cx: number,
  bottom: number,
) => {
  const fh = height * h;
  const fw = fh / figure.aspect;
  return { x: cx * w - fw / 2, y: bottom * h - fh, w: fw, h: fh };
};

/**
 * Pure black, always sharp, and always the darkest thing in frame.
 *
 * This layer is composited *above* every nebula, ray and glow so that light
 * only ever passes behind and around the figure, never in front of it. The
 * chakra points and the heart glow are the two deliberate exceptions, and they
 * are drawn as their own layer on top of this one.
 *
 * The figure is completely still in all four compositions, so this is memoised:
 * the 4K canvas is painted on the first frame and left alone thereafter.
 */
export const MeditationFigure = React.memo<Props>(({ figure, height, cx, bottom }) => (
  <Layer
    res={1}
    draw={(ctx, w, h) => {
      if (!figure) return;
      const b = figureBox(figure, w, h, height, cx, bottom);
      ctx.drawImage(figure.canvas, b.x, b.y, b.w, b.h);
    }}
  />
));
MeditationFigure.displayName = 'MeditationFigure';
