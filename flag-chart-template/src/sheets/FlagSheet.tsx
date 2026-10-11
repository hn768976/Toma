import React, {useEffect, useState} from 'react';
import {AbsoluteFill, useDelayRender} from 'remotion';
import {ROWS} from '../data/rows';
import {FLAGS} from '../flags/flags';
import {flagSvgText} from '../scene/assets';

// Every flag alone, uncropped, at its card ratio. `anonymous` shows numbers
// only (for the independent flag check), otherwise names + source + ratio.
export const FlagSheet: React.FC<{anonymous: boolean}> = ({anonymous}) => {
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender('flags'));
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    Promise.all(ROWS.map(async (r) => [r.id, URL.createObjectURL(new Blob([await flagSvgText(r.flag)], {type: 'image/svg+xml'}))] as const))
      .then((pairs) => {
        setUrls(Object.fromEntries(pairs));
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [handle, continueRender, cancelRender]);
  const cols = 5;
  const cw = 1280 / cols;
  const ch = 720 / 5;
  return (
    <AbsoluteFill style={{background: '#E9EDF2', fontFamily: 'sans-serif'}}>
      {urls &&
        ROWS.map((r, i) => {
          const def = FLAGS[r.flag];
          const s = Math.min((cw - 40) / def.w, (ch - 40) / def.h);
          return (
            <div key={r.id} style={{position: 'absolute', left: (i % cols) * cw, top: Math.floor(i / cols) * ch, width: cw, height: ch, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5}}>
              <img src={urls[r.id]} style={{width: def.w * s, height: def.h * s, boxShadow: '0 0 0 1px rgba(0,0,0,0.3)'}} />
              <div style={{fontSize: 13, color: '#2A2E35'}}>
                {anonymous ? `${i + 1}` : `${r.label} (${def.source === 'code' ? 'code' : 'Wikimedia PD'}, ${def.h}:${def.w})`}
              </div>
            </div>
          );
        })}
    </AbsoluteFill>
  );
};
