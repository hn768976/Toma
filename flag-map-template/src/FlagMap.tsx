import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import type * as THREE from 'three';
import {ROW_BY_ID} from './data/rows';
import {buildShape, type ShapeData} from './geo/buildShape';
import {loadDots, loadFlagImage, loadFont, loadHdri, loadSources, type Dots} from './scene/assets';
import {FlagMapScene} from './scene/FlagMapScene';
import {LOOK} from './scene/layout';

type Loaded = {shape: ShapeData; flagImg: HTMLImageElement | null; hdri: THREE.Texture; dots: Dots};

// Shapes are computed once per page (one composition per page when rendering).
const shapeCache = new Map<string, ShapeData>();

export const FlagMap: React.FC<{id: string}> = ({id}) => {
  const row = ROW_BY_ID[id];
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading map data, flag, font and HDRI for ${id}`, {timeoutInMilliseconds: 120000}));
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadSources(), loadDots(), loadFont(), loadHdri(), 'flag' in row.top ? loadFlagImage(row.top.flag) : Promise.resolve(null)])
      .then(([sources, dots, , hdri, flagImg]) => {
        if (!alive) return;
        let shape = shapeCache.get(id);
        if (!shape) {
          shape = buildShape(row, sources);
          shapeCache.set(id, shape);
        }
        setLoaded({shape, flagImg, hdri, dots});
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [id, row, handle, continueRender, cancelRender]);

  const dpr = useMemo(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio), []);

  return (
    <AbsoluteFill style={{backgroundColor: '#C9CFD9'}}>
      {loaded ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          shadows="basic"
          gl={{antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false}}
          camera={{fov: LOOK.fov, near: 1, far: 500, position: [0, 6, 8]}}
        >
          <FlagMapScene row={row} shape={loaded.shape} flagImg={loaded.flagImg} hdri={loaded.hdri} dots={loaded.dots} frame={frame} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
