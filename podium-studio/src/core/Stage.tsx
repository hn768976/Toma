import React, {useCallback, useEffect, useRef} from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import * as THREE from 'three/webgpu';
import {chooseBackend} from './backend';

export type SceneContext = {
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
};

export type Built = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Called once per frame, before the draw. Must be pure w.r.t. `frame`. */
  update: (frame: number) => void;
  dispose?: () => void;
};

type Props = {
  /** Builds the scene graph once. Receives output dimensions. */
  build: (ctx: SceneContext) => Built;
  /** Fallback clear colour before the first draw lands. */
  background?: string;
};

/**
 * Hosts a three.js WebGPURenderer inside Remotion.
 *
 * Rendering is driven strictly off `useCurrentFrame()` - there is no rAF loop and
 * no wall-clock time anywhere, so every frame is reproducible and the render is
 * frame-exact regardless of how fast the machine draws it.
 *
 * `WebGPURenderer.renderAsync()` is a promise, so each frame is wrapped in a
 * delayRender handle; Remotion only screenshots once the GPU work has resolved.
 *
 * The renderer is created once and reused across frames within a page. Remotion
 * renders a contiguous chunk of frames per browser tab, so this keeps the (very
 * expensive) WebGPU device + pipeline compilation out of the per-frame cost.
 */
export const Stage: React.FC<Props> = ({build, background = '#000000'}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames, fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{renderer: THREE.WebGPURenderer; built: Built} | null>(null);
  const initRef = useRef<Promise<void> | null>(null);
  const buildRef = useRef(build);
  buildRef.current = build;

  const ensureInit = useCallback(() => {
    if (initRef.current) return initRef.current;
    initRef.current = (async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Stage canvas missing');

      // WebGPU where it genuinely works, WebGL2 where it only claims to.
      const choice = await chooseBackend();
      const renderer = new THREE.WebGPURenderer({
        canvas,
        antialias: true,
        alpha: false,
        forceWebGL: choice.forceWebGL,
      });
      await renderer.init();

      // `--scale` in the Remotion CLI maps to devicePixelRatio, which is how the
      // 4K composition renders out at 1080p without touching any layout values.
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(width, height, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(new THREE.Color(background), 1);

      // Surfaced once per render so the log states which backend actually ran,
      // rather than leaving it to be assumed.
      const backend = renderer.backend?.constructor?.name ?? 'unknown';
      console.log(
        `[podium-studio] backend=${backend} (${choice.reason}) ` +
          `dpr=${window.devicePixelRatio} buffer=${canvas.width}x${canvas.height}`,
      );

      const built = buildRef.current({width, height, durationInFrames, fps});
      built.camera.aspect = width / height;
      built.camera.updateProjectionMatrix();

      stateRef.current = {renderer, built};
    })();
    return initRef.current;
  }, [width, height, durationInFrames, fps, background]);

  useEffect(() => {
    const handle = delayRender(`podium frame ${frame}`, {
      // Software-rasterised WebGPU compiles pipelines lazily; the first frame of
      // a chunk can be slow. Generous ceiling, still bounded.
      timeoutInMilliseconds: 180_000,
    });
    let cancelled = false;

    (async () => {
      try {
        await ensureInit();
        if (cancelled) return continueRender(handle);
        const st = stateRef.current;
        if (!st) throw new Error('Stage not initialised');
        st.built.update(frame);
        await st.renderer.renderAsync(st.built.scene, st.built.camera);
        continueRender(handle);
      } catch (err) {
        cancelRender(err as Error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [frame, ensureInit]);

  useEffect(() => {
    return () => {
      const st = stateRef.current;
      if (!st) return;
      st.built.dispose?.();
      st.renderer.dispose();
      stateRef.current = null;
      initRef.current = null;
    };
  }, []);

  return (
    <AbsoluteFill style={{backgroundColor: background}}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
    </AbsoluteFill>
  );
};
