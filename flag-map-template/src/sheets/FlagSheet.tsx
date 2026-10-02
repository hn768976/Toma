import React, {useEffect, useState} from 'react';
import {AbsoluteFill, useDelayRender} from 'remotion';
import {ROWS} from '../data/rows';
import {FLAGS, type FlagId} from '../flags/flags';
import {FONT_FAMILY, flagSvgText, loadFont} from '../scene/assets';

// Verification sheet: every flag alone, uncropped, at its official proportions.
const ITEMS: {id: FlagId; label: string}[] = [
  ...ROWS.filter((r) => r.kind === 'country' && 'flag' in r.top).map((r) => ({id: (r.top as {flag: FlagId}).flag, label: r.label})),
  {id: 'EU', label: 'European Union'},
];

export const FlagSheet: React.FC = () => {
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender('flags'));
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    Promise.all([loadFont(), ...ITEMS.map(async (it) => [it.id, URL.createObjectURL(new Blob([await flagSvgText(it.id)], {type: 'image/svg+xml'}))] as const)])
      .then(([, ...pairs]) => {
        setUrls(Object.fromEntries(pairs as [string, string][]));
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [handle, continueRender, cancelRender]);
  const cols = 6;
  const cw = 1280 / cols;
  const chh = 720 / 5;
  return (
    <AbsoluteFill style={{background: '#E9ECF1', fontFamily: FONT_FAMILY}}>
      {urls &&
        ITEMS.map((it, i) => {
          const def = FLAGS[it.id];
          const maxW = cw - 36;
          const maxH = chh - 46;
          const s = Math.min(maxW / def.w, maxH / def.h);
          return (
            <div key={it.id} style={{position: 'absolute', left: (i % cols) * cw, top: Math.floor(i / cols) * chh, width: cw, height: chh, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6}}>
              <img src={urls[it.id]} style={{width: def.w * s, height: def.h * s, boxShadow: '0 0 0 1px rgba(0,0,0,0.25)'}} />
              <div style={{fontSize: 13, color: '#2A2E35'}}>
                {it.label} <span style={{color: '#7A808A'}}>({def.source === 'code' ? 'code' : 'Wikimedia PD'}, {def.w}:{def.h})</span>
              </div>
            </div>
          );
        })}
    </AbsoluteFill>
  );
};
