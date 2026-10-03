import {useFrame} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {DataTexture} from 'three';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {BackgroundId, COLOURS} from './data';
import {MoleculeRenderer} from './scene/MoleculeRenderer';

export type BeautyMoleculeProps = {
  background: BackgroundId;
  colour: string;
  loopCheck?: boolean;
  /** Testing only: draw the background gradient alone (banding check). */
  bgOnly?: boolean;
};

// Studio Small 03 by Sergej Majboroda, Poly Haven (CC0). See public/hdri/LICENSE.txt
const HDRI = staticFile('hdri/studio_small_03_1k.hdr');

const Driver: React.FC<{renderer: MoleculeRenderer}> = ({renderer}) => {
  // The frame number is the only input. It is read during React's render
  // phase (before @remotion/three advances R3F), and the priority-1
  // useFrame callback takes over rendering. R3F's clock/delta are ignored.
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useFrame(({gl}) => renderer.render(gl, frameRef.current), 1);
  return null;
};

export const BeautyMolecule: React.FC<BeautyMoleculeProps> = ({background, colour, bgOnly}) => {
  const {width, height} = useVideoConfig();
  const [env, setEnv] = useState<DataTexture | null>(null);
  const [handle] = useState(() => delayRender('Loading HDRI'));

  useEffect(() => {
    new HDRLoader().load(
      HDRI,
      (tex) => setEnv(tex as DataTexture),
      undefined,
      (err) => cancelRender(err),
    );
  }, []);

  const colourRow = COLOURS.find((c) => c.id === colour) ?? COLOURS[0];
  const renderer = useMemo(
    () => (env ? new MoleculeRenderer(env, background, colourRow, Boolean(bgOnly)) : null),
    [env, background, colourRow, bgOnly],
  );
  useEffect(() => () => renderer?.dispose(), [renderer]);

  // Release the HDRI handle only once the canvas (which holds its own
  // delayRender until the first frame is drawn) has mounted.
  useEffect(() => {
    if (renderer) continueRender(handle);
  }, [renderer, handle]);

  return (
    <AbsoluteFill style={{backgroundColor: colourRow.bgLight}}>
      {renderer ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={typeof window === 'undefined' ? 1 : window.devicePixelRatio}
          flat
          linear
          gl={{
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
          }}
        >
          <Driver renderer={renderer} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
