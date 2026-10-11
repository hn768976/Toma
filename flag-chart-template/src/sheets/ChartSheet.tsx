import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ROWS, type Direction} from '../data/rows';

// Frame 300 of all 25 compositions of one direction, labelled. Expects the
// frames in public/_sheet/<id>-<dir>.png (scripts/contact-sheets.mjs).
export const ChartSheet: React.FC<{dir: Direction}> = ({dir}) => {
  const cols = 5;
  const cw = 1280 / cols;
  const ch = 720 / 5;
  return (
    <AbsoluteFill style={{background: '#20242B'}}>
      {ROWS.map((r, i) => (
        <div key={r.id} style={{position: 'absolute', left: (i % cols) * cw, top: Math.floor(i / cols) * ch, width: cw, height: ch}}>
          <Img src={staticFile(`_sheet/${r.id}-${dir}.png`)} style={{width: cw - 4, height: ch - 4, margin: 2, objectFit: 'cover'}} />
          <div style={{position: 'absolute', left: 6, bottom: 5, fontSize: 12, color: '#fff', fontFamily: 'sans-serif', textShadow: '0 1px 2px #000'}}>
            {r.id} · {dir}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
