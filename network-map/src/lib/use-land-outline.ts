import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import type {LandOutline} from './land-mask';

/**
 * Module-level cache so the 900 KB outline is fetched and parsed once per
 * render tab rather than once per frame.
 */
let cached: LandOutline | null = null;
let pending: Promise<LandOutline> | null = null;

const load = (src: string): Promise<LandOutline> => {
  if (!pending) {
    pending = fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`Land outline: HTTP ${res.status}`);
        return res.json() as Promise<LandOutline>;
      })
      .then((data) => {
        cached = data;
        return data;
      });
  }
  return pending;
};

export const useLandOutline = (): LandOutline | null => {
  const src = staticFile('land-50m.json');
  const [outline, setOutline] = useState<LandOutline | null>(cached);
  const [handle] = useState<number | null>(() =>
    cached === null
      ? delayRender('Loading land outline', {timeoutInMilliseconds: 120000})
      : null,
  );

  useEffect(() => {
    if (handle === null) return;
    let active = true;
    load(src)
      .then((data) => {
        if (active) setOutline(data);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err as Error));
    return () => {
      active = false;
    };
  }, [src, handle]);

  return outline;
};
