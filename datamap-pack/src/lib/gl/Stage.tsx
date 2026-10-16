import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  useCurrentFrame,
  useDelayRender,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
import { loadFonts } from "../fonts";
import { loopFrame } from "../random";
import { PostChain, PostParams } from "./post";

export type BuiltScene = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Pure function of the frame: set uniforms/attributes for this frame. */
  update: (frame: number, res: THREE.Vector2) => void;
  dispose?: () => void;
};

export type SceneFactory = (ctx: { gl: THREE.WebGLRenderer; w: number; h: number }) => BuiltScene;

const Pipeline: React.FC<{ build: SceneFactory; post: PostParams }> = ({ build, post }) => {
  const frame = useCurrentFrame();
  const { gl } = useThree();
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Building GL scene (fonts, atlases, geometry)"));
  const [ready, setReady] = useState<{ built: BuiltScene; chain: PostChain } | null>(null);
  const released = useRef(false);

  useLayoutEffect(() => {
    let cancelled = false;
    let made: { built: BuiltScene; chain: PostChain } | null = null;
    loadFonts().then(() => {
      if (cancelled) return;
      const size = new THREE.Vector2();
      gl.getDrawingBufferSize(size);
      const w = Math.round(size.x);
      const h = Math.round(size.y);
      const built = build({ gl, w, h });
      const chain = new PostChain(w, h, post);
      made = { built, chain };
      setReady(made);
    });
    return () => {
      cancelled = true;
      made?.built.dispose?.();
      made?.chain.dispose();
    };
  }, [gl, build, post]);

  // Render synchronously for the current frame. This layout effect runs
  // before <ThreeCanvas>'s own frame advance, which then draws R3F's empty
  // default scene with autoClear off (a no-op), so our image stays.
  useLayoutEffect(() => {
    if (!ready) return;
    const lf = loopFrame(frame);
    ready.built.update(lf, ready.chain.res);
    ready.chain.render(gl, ready.built.scene, ready.built.camera, lf);
    if (!released.current) {
      released.current = true;
      // Wait for the GPU so the first screenshot sees the finished image.
      gl.getContext().finish();
      continueRender(handle);
    }
  }, [frame, ready, gl, continueRender, handle]);

  return null;
};

// Host for every look: a WebGL2 <ThreeCanvas> whose drawing buffer matches
// the output pixels (Remotion's --scale sets devicePixelRatio), with our own
// render pipeline driven only by useCurrentFrame().
export const GLStage: React.FC<{
  build: SceneFactory;
  post: PostParams;
  children?: React.ReactNode;
}> = ({ build, post, children }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const dpr = isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: post.bgBottom }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        onCreated={(state) => {
          state.gl.autoClear = false;
        }}
      >
        <Pipeline build={build} post={post} />
      </ThreeCanvas>
      {children}
    </AbsoluteFill>
  );
};
