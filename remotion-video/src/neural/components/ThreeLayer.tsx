import React, { useEffect, useRef } from "react";
import type { Camera, Scene } from "three";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createFrameRenderer, type FrameRenderer } from "../core/renderer";

/**
 * A scene that knows how to pose itself for a given frame. `update` must be
 * pure with respect to the frame number: Remotion renders frames out of a
 * single page, so anything derived from wall-clock time or from the previous
 * frame's state would make the render non-deterministic.
 */
export type PosedScene = {
  scene: Scene;
  camera: Camera;
  update: (frame: number, durationInFrames: number) => void;
  dispose: () => void;
};

export type PosedSceneBuilder = (
  width: number,
  height: number,
) => PosedScene;

export const ThreeLayer: React.FC<{
  build: PosedSceneBuilder;
  style?: React.CSSProperties;
  onBackendResolved?: (label: string) => void;
}> = ({ build, style, onBackendResolved }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<FrameRenderer | null>(null);
  const sceneRef = useRef<PosedScene | null>(null);

  // Keep the newest callbacks reachable without making them effect deps: the
  // scene is built exactly once, on the first frame that runs.
  const buildRef = useRef(build);
  buildRef.current = build;
  const onBackendRef = useRef(onBackendResolved);
  onBackendRef.current = onBackendResolved;

  useEffect(() => {
    const handle = delayRender(`neural: frame ${frame}`, {
      timeoutInMilliseconds: 300_000,
    });

    let settled = false;
    const release = () => {
      if (!settled) {
        settled = true;
        continueRender(handle);
      }
    };

    void (async () => {
      try {
        const host = hostRef.current;
        if (!host) {
          release();
          return;
        }

        if (!rendererRef.current) {
          const renderer = await createFrameRenderer(host);
          rendererRef.current = renderer;
          onBackendRef.current?.(renderer.label);
          sceneRef.current = buildRef.current(width, height);
          // `--scale` is exposed through devicePixelRatio, so sizing off it
          // keeps one composition usable at both 1080p and 4K output.
          renderer.setSize(width, height, window.devicePixelRatio);
        }

        const posed = sceneRef.current;
        const renderer = rendererRef.current;
        if (!posed || !renderer) {
          release();
          return;
        }

        posed.update(frame, durationInFrames);
        await renderer.render(posed.scene, posed.camera);
        release();
      } catch (err) {
        release();
        cancelRender(err as Error);
      }
    })();

    return release;
  }, [frame, width, height, durationInFrames]);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      rendererRef.current?.dispose();
      sceneRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // The renderer owns the canvas: a canvas cannot switch context type, so
  // falling back between tiers means replacing the element itself.
  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        inset: 0,
        ...style,
      }}
    />
  );
};
