import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { NoToneMapping } from 'three';
import { Scene } from './ribbon/Scene';
import { DURATION_IN_FRAMES } from './ribbon/params';
import { CAMERA, VERSIONS, type VersionConfig } from './ribbon/versions';

export type TwistedRibbonProps = { version: 'light' | 'dark' };

const devicePixelRatio = () =>
  typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

export const TwistedRibbon: React.FC<TwistedRibbonProps> = ({ version }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cfg: VersionConfig = VERSIONS[version];

  // The loop PERIOD, not the composition length. They are the same number for
  // the delivered compositions, but keeping the period a constant is what lets
  // the loop-closure check extend the composition to 301 frames and compare
  // frame 300 against frame 0 — with the period tied to durationInFrames,
  // extending the composition would silently change the rotation per frame and
  // the check could never pass.
  const period = DURATION_IN_FRAMES;

  // Every value on screen derives from this. No clock, no Date.now, no state.
  const progress = frame / period;
  // Grain is fed the wrapped frame so it is periodic over the loop.
  const grainFrame = frame % period;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={devicePixelRatio()}
        shadows
        flat
        camera={{
          fov: CAMERA.fov,
          near: CAMERA.near,
          far: CAMERA.far,
          position: CAMERA.position,
        }}
        gl={{
          antialias: false, // EffectComposer does MSAA into a float target
          alpha: false,
          stencil: false,
          depth: true,
          toneMapping: NoToneMapping, // handled by the ToneMapping effect
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
      >
        <Scene cfg={cfg} frame={grainFrame} progress={progress} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
