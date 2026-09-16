import React, {useEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {PALETTES, type GlassLatticeProps} from './theme';
import {resolveForceWebGL} from './three/backend';
import {createLatticeScene, type LatticeScene} from './three/scene';

type Instance = {
  scene: LatticeScene;
  source: HTMLCanvasElement;
};

export const GlassLattice: React.FC<GlassLatticeProps> = ({palette, mirrored}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<Promise<Instance> | null>(null);

  // A fresh handle per frame: Remotion will not screenshot the page until the
  // three.js render for *this* frame has resolved.
  const handle = useMemo(
    () => delayRender(`glass-lattice frame ${frame}`, {timeoutInMilliseconds: 180_000}),
    [frame],
  );

  useEffect(() => {
    let done = false;

    const run = async () => {
      if (!instanceRef.current) {
        // three renders into its own canvas; we blit the result onto a 2D
        // canvas so the pixels survive until Remotion captures the frame,
        // regardless of the backend's swap-chain behaviour.
        const source = document.createElement('canvas');
        source.width = width;
        source.height = height;
        instanceRef.current = createLatticeScene(
          source,
          width,
          height,
          PALETTES[palette],
          resolveForceWebGL(),
        ).then((scene) => ({scene, source}));
      }

      const {scene, source} = await instanceRef.current;
      await scene.renderFrame(frame);

      const context = canvasRef.current?.getContext('2d');
      if (context) {
        context.clearRect(0, 0, width, height);
        context.drawImage(source, 0, 0);
      }
    };

    run()
      .catch((err) => {
        done = true;
        cancelRender(err);
      })
      .finally(() => {
        if (!done) {
          continueRender(handle);
        }
      });
  }, [frame, handle, width, height, palette]);

  return (
    <AbsoluteFill style={{backgroundColor: PALETTES[palette].background}}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          // The mirrored variant is a true horizontal flip of the finished
          // image, so the drift mirrors along with the lattice.
          transform: mirrored ? 'scaleX(-1)' : undefined,
        }}
      />
    </AbsoluteFill>
  );
};
