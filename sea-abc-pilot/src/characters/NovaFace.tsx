import React, { useId } from 'react';
import { C } from '../theme';
import { fa } from './novaArt';

// No outlines anywhere: every part is a filled shape, separated from its
// neighbours by tone (base / darker shade / lighter highlight).

export type Mouth = 'smile' | 'o' | 'ah' | 'ee' | 'grin';

export type FaceState = {
  mouth: Mouth;
  blink: number; // 0 open .. 1 closed
  pupil: [number, number];
  brow: number; // px, negative = raised
  hornRot: number; // deg, added to rest angle
  finRot: number; // deg, near pectoral fin
  farFinRot: number;
};

const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');

/** Filled lens/crescent along a quadratic curve (used for brows, smiles, happy eyes). */
export const lens = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number) =>
  `M ${x0} ${y0} Q ${cx} ${cy - t} ${x1} ${y1} Q ${cx} ${cy + t} ${x0} ${y0} Z`;

/** Horn in local coords: base centre at (0,0), pointing along +x. */
export const Horn: React.FC<{ length?: number; width?: number }> = ({ length = 150, width = 34 }) => {
  const id = safeId(`horn${useId()}`);
  const h = width / 2;
  const L = length;
  const cone = `M 0 ${-h} C ${L * 0.4} ${-h * 0.82} ${L * 0.86} ${-h * 0.24} ${L} 0 C ${L * 0.86} ${h * 0.24} ${L * 0.4} ${h * 0.82} 0 ${h} C -6 ${h * 0.5} -6 ${-h * 0.5} 0 ${-h} Z`;
  // darker underside (~40% of the cone)
  const under = `M -3 ${h * 0.18} C ${L * 0.4} ${h * 0.26} ${L * 0.86} ${h * 0.08} ${L} 0 C ${L * 0.86} ${h * 0.24} ${L * 0.4} ${h * 0.82} 0 ${h} C -5 ${h * 0.6} -4 ${h * 0.35} -3 ${h * 0.18} Z`;
  // lighter top edge
  const top = `M 2 ${-h * 0.9} C ${L * 0.4} ${-h * 0.76} ${L * 0.8} ${-h * 0.22} ${L * 0.96} ${-1} C ${L * 0.78} ${-h * 0.08} ${L * 0.4} ${-h * 0.42} 2 ${-h * 0.55} Z`;
  return (
    <g>
      <clipPath id={id}>
        <path d={cone} />
      </clipPath>
      <path d={cone} fill={C.yellow} />
      <g clipPath={`url(#${id})`}>
        <path d={under} fill={C.yellowDark} />
        <path d={top} fill={C.yellowLight} />
        {[0.22, 0.45, 0.66].map((t, i) => {
          const x = L * t;
          const w = Math.max(5, width * 0.16);
          return (
            <polygon
              key={i}
              points={`${x - w},${-h - 2} ${x},${-h - 2} ${x + w * 1.6},${h + 2} ${x + w * 0.6},${h + 2}`}
              fill={C.yellowDark}
            />
          );
        })}
      </g>
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

const MouthShape: React.FC<{ mouth: Mouth; id: string }> = ({ mouth, id }) => {
  switch (mouth) {
    case 'smile':
      return <path d={lens(-18, -4, 0, 9, 16, -6, 5)} fill={C.navy} />;
    case 'o':
      return <ellipse cx={0} cy={2} rx={8} ry={10} fill={C.navy} />;
    case 'ee':
      return <path d="M -19 -5 Q 0 0 17 -7 Q 13 9 -1 11 Q -14 10 -19 -5 Z" fill={C.navy} />;
    case 'ah':
    case 'grin': {
      const big = mouth === 'grin';
      const d = big
        ? 'M -23 -8 Q 0 -1 21 -10 Q 21 20 0 26 Q -20 23 -23 -8 Z'
        : 'M -17 -6 Q 0 -2 15 -7 Q 15 20 -1 24 Q -16 21 -17 -6 Z';
      return (
        <g>
          <clipPath id={id}>
            <path d={d} />
          </clipPath>
          <path d={d} fill={C.navy} />
          <ellipse cx={-1} cy={big ? 22 : 20} rx={big ? 12 : 9} ry={big ? 8 : 7} fill={C.coralDark} clipPath={`url(#${id})`} />
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
}> = ({ e, blink, pupil, id }) => {
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
            {/* eyelid: body coral, with a darker lid edge so it reads against the white */}
            <rect x={e.x - e.rx - 4} y={e.y - e.ry - 6} width={e.rx * 2 + 8} height={lidY - (e.y - e.ry - 6)} fill={C.coral} />
            <rect x={e.x - e.rx - 4} y={lidY - 4} width={e.rx * 2 + 8} height={5} fill={C.coralDark} />
          </>
        ) : null}
      </g>
    </g>
  );
};

/** Pectoral fin: base tone with a darker trailing edge. */
const FinShape: React.FC<{ base: string; dark: string }> = ({ base, dark }) => (
  <g>
    <path d="M 4 -10 C -20 -12 -48 -2 -66 24 C -70 34 -60 42 -48 38 C -30 32 -10 22 6 10 C 10 4 10 -6 4 -10 Z" fill={base} />
    <path d="M -66 24 C -70 34 -60 42 -48 38 C -30 32 -10 22 6 10 C -14 18 -36 28 -66 24 Z" fill={dark} />
  </g>
);

/** Drawn BEHIND the body (under the Pixi canvas). */
export const NovaBackParts: React.FC<{ s: FaceState }> = ({ s }) => (
  <g transform={`translate(${FAR_FIN.x} ${FAR_FIN.y}) rotate(${-30 + s.farFinRot}) scale(-0.85 0.85)`}>
    <FinShape base={C.coralDark} dark="#C25E66" />
  </g>
);

/** Drawn ON TOP of the body: horn, eyes, brows, mouth, near fin. */
export const NovaFrontParts: React.FC<{ s: FaceState; idPrefix: string }> = ({ s, idPrefix }) => (
  <g>
    {/* soft darker tone on the body under the fin */}
    <ellipse cx={NEAR_FIN.x - 26} cy={NEAR_FIN.y + 14} rx={34} ry={13} fill={C.coralDark} transform={`rotate(${18 + s.finRot * 0.4} ${NEAR_FIN.x} ${NEAR_FIN.y})`} />
    <g transform={`translate(${NEAR_FIN.x} ${NEAR_FIN.y}) rotate(${s.finRot})`}>
      <FinShape base={C.coralLight} dark={C.coral} />
    </g>
    <g transform={`translate(${HORN_BASE.x} ${HORN_BASE.y}) rotate(${HORN_REST + s.hornRot})`}>
      <Horn length={HORN_LEN} width={40} />
    </g>
    {/* blush */}
    <ellipse cx={fa(458, 186).x} cy={fa(458, 186).y} rx={22} ry={12} fill={C.coralDark} />
    <Eye e={FAR_EYE} blink={s.blink} pupil={s.pupil} id={`${idPrefix}-fe`} />
    <Eye e={NEAR_EYE} blink={s.blink} pupil={s.pupil} id={`${idPrefix}-ne`} />
    {/* brows: filled navy crescents */}
    <g transform={`translate(0 ${s.brow})`} fill={C.navy}>
      <path d={lens(NEAR_EYE.x - 24, NEAR_EYE.y - 46, NEAR_EYE.x - 2, NEAR_EYE.y - 56, NEAR_EYE.x + 20, NEAR_EYE.y - 48, 3.5)} />
      <path d={lens(FAR_EYE.x - 12, FAR_EYE.y - 42, FAR_EYE.x + 2, FAR_EYE.y - 50, FAR_EYE.x + 16, FAR_EYE.y - 44, 3)} />
    </g>
    <g transform={`translate(${MOUTH.x} ${MOUTH.y})`}>
      <MouthShape mouth={s.mouth} id={`${idPrefix}-m-${s.mouth}`} />
    </g>
  </g>
);

/** Horn tip position in face-anchor coords (for aiming). */
export const hornTip = (hornRot: number) => {
  const a = ((HORN_REST + hornRot) * Math.PI) / 180;
  return { x: HORN_BASE.x + Math.cos(a) * HORN_LEN, y: HORN_BASE.y + Math.sin(a) * HORN_LEN };
};
