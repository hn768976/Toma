import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ROWS} from '../data/rows';

// Verification sheet: frame 300 of all 38 compositions. Expects the frames to
// have been rendered to public/_sheet/<id>.png first (see README, "Checks").
export const ShapeSheet: React.FC = () => {
  const cols = 7;
  const cw = 1280 / cols;
  const ch = 720 / 6;
  return (
    <AbsoluteFill style={{background: '#20242B'}}>
      {ROWS.map((r, i) => (
        <div key={r.id} style={{position: 'absolute', left: (i % cols) * cw, top: Math.floor(i / cols) * ch, width: cw, height: ch}}>
          <Img src={staticFile(`_sheet/${r.id}.png`)} style={{width: cw - 4, height: ((cw - 4) * 9) / 16, margin: 2}} />
          <div style={{position: 'absolute', left: 4, bottom: 2, fontSize: 11, color: '#fff', fontFamily: 'sans-serif'}}>{r.id}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
