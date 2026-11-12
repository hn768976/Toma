import React, { useEffect, useState } from 'react';
import { Lottie, LottieAnimationData } from '@remotion/lottie';
import { cancelRender, continueRender, delayRender, Freeze, staticFile } from 'remotion';

const cache = new Map<string, LottieAnimationData>();

export const useLottie = (file: string) => {
  const [data, setData] = useState<LottieAnimationData | null>(() => cache.get(file) ?? null);
  const [handle] = useState(() => (cache.has(file) ? null : delayRender(`Loading Lottie ${file}`)));
  useEffect(() => {
    if (data) return;
    fetch(staticFile(`lottie/${file}`))
      .then((r) => r.json())
      .then((json: LottieAnimationData) => {
        cache.set(file, json);
        setData(json);
        if (handle !== null) continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [data, file, handle]);
  return data;
};

/**
 * Plays a Lottie at an explicit frame (driven by the Remotion frame, never by
 * its own clock). `frame` is clamped to the animation, or wrapped if `loop`.
 */
export const LottieAt: React.FC<{
  file: string;
  frame: number;
  loop?: boolean;
  style?: React.CSSProperties;
}> = ({ file, frame, loop, style }) => {
  const data = useLottie(file);
  if (!data) return null;
  const total = Math.round(Number(data.op) - Number(data.ip ?? 0));
  const f = loop ? ((Math.floor(frame) % total) + total) % total : Math.max(0, Math.min(total - 1, Math.floor(frame)));
  return (
    <Freeze frame={f}>
      <Lottie animationData={data} style={style} />
    </Freeze>
  );
};
