import { useMemo } from 'react';
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  ToneMapping,
} from '@react-three/postprocessing';
import { useThree } from '@react-three/fiber';
import { HalfFloatType, Vector3 } from 'three';
import { GrainEffect } from './GrainEffect';
import { COMP_WIDTH } from './params';
import { FOCUS_RADIUS, FOCUS_Y, type VersionConfig } from './versions';

/**
 * Focus plane: the near band, at the point where it crosses over itself.
 *
 * Derived from the camera's own azimuth rather than hard-coded, so the focus
 * follows the framing instead of silently drifting off it. The camera is static,
 * so this evaluates once and never animates.
 */
const useFocusDistance = () => {
  const camera = useThree((s) => s.camera);
  return useMemo(() => {
    const horiz = new Vector3(camera.position.x, 0, camera.position.z);
    if (horiz.lengthSq() === 0) horiz.set(0, 0, 1);
    horiz.normalize().multiplyScalar(FOCUS_RADIUS);
    horiz.y = FOCUS_Y;
    return camera.position.distanceTo(horiz);
  }, [camera, camera.position.x, camera.position.y, camera.position.z]);
};

const Grain: React.FC<{ frame: number; grain: number; dither: number }> = ({
  frame,
  grain,
  dither,
}) => {
  const effect = useMemo(
    () => new GrainEffect({ grain, dither }),
    [grain, dither],
  );
  // Set during render, not in an effect: @remotion/three's frame renderer calls
  // advance() from a passive effect, which runs after the render phase, so the
  // uniform is always current for the draw that Remotion screenshots.
  effect.setFrame(frame);
  return <primitive object={effect} dispose={null} />;
};

export const Effects: React.FC<{ cfg: VersionConfig; frame: number }> = ({
  cfg,
  frame,
}) => {
  const focusDistance = useFocusDistance();
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  // postprocessing measures the bokeh kernel in texels, so a fixed bokehScale
  // blurs twice as hard at 1080p as at 4K. Normalising against the composition
  // width keeps the 1080p preview an honest preview of the 4K render.
  const bokehScale = (cfg.post.bokehScale * (size.width * dpr)) / COMP_WIDTH;

  return (
    <EffectComposer
      multisampling={8}
      // 16-bit float intermediate: all the banding risk then sits in the single
      // final 8-bit write, which the dither below handles.
      frameBufferType={HalfFloatType}
      enableNormalPass={false}
    >
      {/* Purely spatial. Nothing in this chain accumulates across frames —
          no TAA, no temporal denoise, no motion blur. */}
      <DepthOfField
        worldFocusDistance={focusDistance}
        worldFocusRange={0.42}
        focalLength={cfg.post.focalLength}
        bokehScale={bokehScale}
        resolutionScale={1}
      />
      {cfg.post.bloom ? (
        <Bloom
          intensity={cfg.post.bloom.intensity}
          luminanceThreshold={cfg.post.bloom.threshold}
          luminanceSmoothing={cfg.post.bloom.smoothing}
          mipmapBlur
        />
      ) : (
        <></>
      )}
      <ToneMapping mode={cfg.post.toneMapping} />
      <Grain frame={frame} grain={cfg.post.grain} dither={cfg.post.dither} />
    </EffectComposer>
  );
};
