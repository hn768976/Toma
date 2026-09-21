import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { continueRender, delayRender, useCurrentFrame } from 'remotion';

/**
 * Re-draws the scene once React has fully committed the frame.
 *
 * @remotion/three renders with frameloop="never" and calls advance() from a
 * passive effect. @react-three/postprocessing publishes its composer through
 * React state, so on the commit where the composer is created its useFrame
 * closure still sees `composerState === null` and draws nothing — the canvas
 * stays black for the first frame every render thread handles.
 *
 * Waiting two animation frames puts the extra advance() after the state update
 * has been processed, and the delayRender keeps Remotion from screenshotting
 * until that draw has happened.
 */
export const ComposerSync: React.FC = () => {
  const advance = useThree((s) => s.advance);
  const frame = useCurrentFrame();

  useEffect(() => {
    const handle = delayRender(
      `Waiting for the effect composer to draw frame ${frame}`,
    );
    let done = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        advance(performance.now());
        done = true;
        continueRender(handle);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (!done) continueRender(handle);
    };
  }, [frame, advance]);

  return null;
};
