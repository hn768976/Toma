import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import type * as THREE from 'three';
import {ROW_BY_ID, type Direction} from './data/rows';
import {loadFlagImage, loadHdri} from './scene/assets';
import {ChartScene} from './scene/ChartScene';
import {LOOK} from './scene/layout';

export const FlagChart: React.FC<{id: string; dir: Direction}> = ({id, dir}) => {
  const row = ROW_BY_ID[id];
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading flag and HDRI for ${id}`, {timeoutInMilliseconds: 120000}));
  const [loaded, setLoaded] = useState<{flagImg: HTMLImageElement; hdri: THREE.Texture} | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadFlagImage(row.flag), loadHdri()])
      .then(([flagImg, hdri]) => {
        if (!alive) return;
        setLoaded({flagImg, hdri});
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [row, handle, continueRender, cancelRender]);

  const dpr = useMemo(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio), []);

  return (
    <AbsoluteFill style={{backgroundColor: '#B4C8DC'}}>
      {loaded ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          shadows="basic"
          gl={{antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false}}
          camera={{fov: LOOK.fov, near: 0.5, far: 500, position: [0, 10, 30]}}
        >
          <ChartScene row={row} dir={dir} flagImg={loaded.flagImg} hdri={loaded.hdri} frame={frame} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
