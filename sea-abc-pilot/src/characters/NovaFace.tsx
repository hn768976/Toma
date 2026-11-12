import React from 'react';
import { C } from '../theme';
import { fa, STROKE } from './novaArt';

export type Mouth = 'smile' | 'o' | 'ah' | 'ee' | 'grin';

export type FaceState = {
  mouth: Mouth;
  blink: number; // 0 open .. 1 closed
  pupil: [number, number];
  brow: number; // px, negative = raised
  hornRot: number; // deg, added to rest angle
  finRot: number; // deg, near pectoral fin
  farFinRot: number;
  stroke?: number;
};

/** Horn in local coords: base centre at (0,0), pointing along +x. */
export const Horn: React.FC<{ length?: number; width?: number; sw?: number }> = ({
  length = 150,
  width = 34,
  sw = STROKE,
}) => {
  const h = width / 2;
  const L = length;
  const stripes = [0.24, 0.47, 0.68].map((t) => {
    const x = L * t;
    const hw = h * (1 - t) + 2;
    return `M ${x - 7} ${-hw} L ${x + 7} ${hw}`;
  });
  return (
    <g>
      <path
        d={`M 0 ${-h} C ${L * 0.4} ${-h * 0.82} ${L * 0.86} ${-h * 0.24} ${L} 0 C ${L * 0.86} ${h * 0.24} ${L * 0.4} ${h * 0.82} 0 ${h} C -6 ${h * 0.5} -6 ${-h * 0.5} 0 ${-h} Z`}
        fill={C.yellow}
        stroke={C.navy}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {stripes.map((d, i) => (
        <path key={i} d={d} stroke={C.navy} strokeWidth={sw * 0.7} strokeLinecap="round" />
      ))}
    </g>
  );
};

const MOUTH = fa(508, 202);
const NEAR_EYE = { ...fa(456, 120), rx: 33, ry: 40, pr: 18 };
const FAR_EYE = { ...fa(516, 114), rx: 21, ry: 33, pr: 13 };
const HORN_BASE = fa(490, 70);
const HORN_LEN = 190;
const HORN_REST = -30;
const NEAR_FIN = fa(392, 230);
const FAR_FIN = fa(422, 222);

const MouthShape: React.FC<{ mouth: Mouth; sw: number }> = ({ mouth, sw }) => {
  switch (mouth) {
    case 'smile':
      return <path d="M -17 -4 Q 0 11 15 -6" stroke={C.navy} strokeWidth={sw * 1.8} fill="none" strokeLinecap="round" />;
    case 'o':
      return <ellipse cx={0} cy={2} rx={8} ry={10} fill={C.navy} />;
    case 'ee':
      return <path d="M -19 -5 Q 0 0 17 -7 Q 13 9 -1 11 Q -14 10 -19 -5 Z" fill={C.navy} stroke={C.navy} strokeWidth={2} strokeLinejoin="round" />;
    case 'ah':
    case 'grin': {
      const big = mouth === 'grin';
      const d = big
        ? 'M -23 -8 Q 0 -1 21 -10 Q 21 20 0 26 Q -20 23 -23 -8 Z'
        : 'M -17 -6 Q 0 -2 15 -7 Q 15 20 -1 24 Q -16 21 -17 -6 Z';
      return (
        <g>
          <clipPath id={`mclip-${mouth}`}>
            <path d={d} />
          </clipPath>
          <path d={d} fill={C.navy} />
          <ellipse cx={-1} cy={big ? 22 : 20} rx={big ? 12 : 9} ry={big ? 8 : 7} fill={C.coralDark} clipPath={`url(#mclip-${mouth})`} />
          <path d={d} fill="none" stroke={C.navy} strokeWidth={2} strokeLinejoin="round" />
        </g>
      );
    }
  }
};

const Eye: React.FC<{
  e: { x: number; y: number; rx: number; ry: number; pr: number };
  blink: number;
  pupil: [number, number];
  id: string;
  sw: number;
}> = ({ e, blink, pupil, id, sw }) => {
  const lidY = e.y - e.ry - 2 + blink * (e.ry * 2 + 4);
  return (
    <g>
      <clipPath id={id}>
        <ellipse cx={e.x} cy={e.y} rx={e.rx} ry={e.ry} />
      </clipPath>
      <ellipse cx={e.x} cy={e.y} rx={e.rx} ry={e.ry} fill={C.white} />
      <g clipPath={`url(#${id})`}>
        <ellipse cx={e.x + 6 + pupil[0]} cy={e.y + 4 + pupil[1]} rx={e.pr} ry={e.pr * 1.08} fill={C.navy} />
        <circle cx={e.x + 1 + pupil[0]} cy={e.y - 4 + pupil[1]} r={e.pr * 0.42} fill={C.white} />
        <circle cx={e.x + 12 + pupil[0]} cy={e.y + 10 + pupil[1]} r={e.pr * 0.2} fill={C.white} />
        {blink > 0.02 ? (
          <>
            <rect x={e.x - e.rx - 4} y={e.y - e.ry - 6} width={e.rx * 2 + 8} height={lidY - (e.y - e.ry - 6)} fill={C.coral} />
            <line x1={e.x - e.rx - 4} x2={e.x + e.rx + 4} y1={lidY} y2={lidY} stroke={C.navy} strokeWidth={sw} />
          </>
        ) : null}
      </g>
      <ellipse cx={e.x} cy={e.y} rx={e.rx} ry={e.ry} fill="none" stroke={C.navy} strokeWidth={sw} />
    </g>
  );
};

const FinShape: React.FC<{ color: string; sw: number }> = ({ color, sw }) => (
  <path
    d="M 4 -10 C -20 -12 -48 -2 -66 24 C -70 34 -60 42 -48 38 C -30 32 -10 22 6 10 C 10 4 10 -6 4 -10 Z"
    fill={color}
    stroke={C.navy}
    strokeWidth={sw}
    strokeLinejoin="round"
  />
);

/** Drawn BEHIND the body (under the Pixi canvas). */
export const NovaBackParts: React.FC<{ s: FaceState }> = ({ s }) => {
  const sw = s.stroke ?? STROKE;
  return (
    <g transform={`translate(${FAR_FIN.x} ${FAR_FIN.y}) rotate(${-30 + s.farFinRot}) scale(-0.85 0.85)`}>
      <FinShape color={C.coralDark} sw={sw / 0.85} />
    </g>
  );
};

/** Drawn ON TOP of the body: horn, eyes, brows, mouth, near fin. */
export const NovaFrontParts: React.FC<{ s: FaceState; idPrefix: string }> = ({ s, idPrefix }) => {
  const sw = s.stroke ?? STROKE;
  return (
    <g>
      <g transform={`translate(${NEAR_FIN.x} ${NEAR_FIN.y}) rotate(${s.finRot})`}>
        <FinShape color={C.coral} sw={sw} />
      </g>
      <g transform={`translate(${HORN_BASE.x} ${HORN_BASE.y}) rotate(${HORN_REST + s.hornRot})`}>
        <Horn sw={sw} length={HORN_LEN} width={40} />
      </g>
      {/* blush */}
      <ellipse cx={fa(458, 186).x} cy={fa(458, 186).y} rx={22} ry={12} fill={C.coralDark} />
      <Eye e={FAR_EYE} blink={s.blink} pupil={s.pupil} id={`${idPrefix}-fe`} sw={sw} />
      <Eye e={NEAR_EYE} blink={s.blink} pupil={s.pupil} id={`${idPrefix}-ne`} sw={sw} />
      {/* brows */}
      <g transform={`translate(0 ${s.brow})`} stroke={C.navy} strokeWidth={sw * 1.7} strokeLinecap="round" fill="none">
        <path d={`M ${NEAR_EYE.x - 24} ${NEAR_EYE.y - 46} Q ${NEAR_EYE.x - 2} ${NEAR_EYE.y - 58} ${NEAR_EYE.x + 20} ${NEAR_EYE.y - 48}`} />
        <path d={`M ${FAR_EYE.x - 12} ${FAR_EYE.y - 42} Q ${FAR_EYE.x + 2} ${FAR_EYE.y - 52} ${FAR_EYE.x + 16} ${FAR_EYE.y - 44}`} />
      </g>
      <g transform={`translate(${MOUTH.x} ${MOUTH.y})`}>
        <MouthShape mouth={s.mouth} sw={sw} />
      </g>
    </g>
  );
};

/** Horn tip position in face-anchor coords (for aiming). */
export const hornTip = (hornRot: number) => {
  const a = ((HORN_REST + hornRot) * Math.PI) / 180;
  return { x: HORN_BASE.x + Math.cos(a) * HORN_LEN, y: HORN_BASE.y + Math.sin(a) * HORN_LEN };
};
