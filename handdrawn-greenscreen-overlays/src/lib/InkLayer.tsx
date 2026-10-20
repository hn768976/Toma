import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { GREEN, H, W } from './config';
import { Pt } from './geom';
import { onTwos } from './random';
import { Stroke, strokeGeom, strokeWindow } from './pen';
import { STREAK } from './config';

export interface Fill {
  poly: Pt[];
  color: string;
  /** paint-marker passes that fill the shape in (clipped to poly) */
  paint: Stroke[];
  /** solid from this frame (after the paint pass) until exitAt */
  solidFrom: number;
  exitAt: number;
}

export interface Element {
  id: string;
  strokes: Stroke[];
  fill?: Fill;
  /** SVG transform for the element at a frame (pop-ins, twinkles) - evaluated on twos */
  transform?: (frame: number) => string | undefined;
}

const polyPath = (p: Pt[]) => 'M' + p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('L') + 'Z';

const StrokePath: React.FC<{ s: Stroke; frame: number; clip?: boolean }> = ({ s, frame }) => {
  const g = strokeGeom(s, frame);
  if (!g || !g.outline) return null;
  const blend = s.blend ?? 'multiply';
  const clipId = `c-${s.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const hasTex = g.streaks.length > 0;
  return (
    <g style={{ mixBlendMode: blend }}>
      {g.outlines.map((d, i) => (
        <path key={i} d={d} fill={s.color} style={i ? { mixBlendMode: blend } : undefined} />
      ))}
      {hasTex ? (
        <>
          <clipPath id={clipId}>
            <path d={g.outline} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            {g.streaks.map((d, i) => (
              <path key={i} d={d} fill={s.edge ?? STREAK} />
            ))}
          </g>
        </>
      ) : null}
    </g>
  );
};

export const InkElements: React.FC<{ elements: Element[] }> = ({ elements }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {elements.map((el) => {
        const visible = el.strokes.some((s) => strokeWindow(s, frame)) || (el.fill && el.fill.paint.some((s) => strokeWindow(s, frame)));
        if (!visible) return null;
        const tf = el.transform?.(onTwos(frame));
        const f = el.fill;
        const fid = `f-${el.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const fq = onTwos(frame);
        return (
          <g key={el.id} transform={tf}>
            {f ? (
              <>
                <clipPath id={fid}>
                  <path d={polyPath(f.poly)} />
                </clipPath>
                <g clipPath={`url(#${fid})`}>
                  {fq >= f.solidFrom && fq < f.exitAt ? <path d={polyPath(f.poly)} fill={f.color} /> : f.paint.map((s) => <StrokePath key={s.id} s={s} frame={frame} />)}
                </g>
              </>
            ) : null}
            {el.strokes.map((s) => (
              <StrokePath key={s.id} s={s} frame={frame} />
            ))}
          </g>
        );
      })}
    </>
  );
};

/** Green screen + an isolated ink layer (multiply never touches the green). */
export const GreenScreen: React.FC<{ children: React.ReactNode; svgStyle?: React.CSSProperties }> = ({ children, svgStyle }) => (
  <AbsoluteFill style={{ backgroundColor: GREEN }}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, isolation: 'isolate', ...svgStyle }}>
      <g style={{ isolation: 'isolate' }}>{children}</g>
    </svg>
  </AbsoluteFill>
);
