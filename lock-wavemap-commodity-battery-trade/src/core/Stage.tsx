import { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Post, type PostOptions } from "./post";
import { useAssets } from "./assets";

export type LookEnv = {
  gl: THREE.WebGLRenderer;
  /** Output size in device pixels (1280x720 for the previews, 3840x2160 at 4K). */
  pxW: number;
  pxH: number;
  aspect: number;
  /** Canvas-texture resolution multiplier relative to the 4K design size. */
  texScale: number;
};

export type Look = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  post: PostOptions;
  /** Pure function of the frame number: sets every uniform, transform and
   *  canvas texture for that frame. Called once per rendered frame. */
  update: (frame: number, post: Post) => void;
};

export type LookFactory<P> = (env: LookEnv, props: P) => Look;

const Runner = <P,>({ factory, props, pxW, pxH }: { factory: LookFactory<P>; props: P; pxW: number; pxH: number }) => {
  const frame = useCurrentFrame();
  // Only the frame number crosses into the render callback; nothing is
  // carried between frames.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const state = useMemo(() => {
    const env: LookEnv = { gl, pxW, pxH, aspect: pxW / pxH, texScale: Math.max(0.5, Math.min(1, pxW / 3840)) };
    const look = factory(env, props);
    const post = new Post(gl, look.post, pxW, pxH);
    return { look, post };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, pxW, pxH]);
  // Priority 1 = we own rendering. The callback's clock/delta are ignored;
  // the frame comes from useCurrentFrame() only.
  useFrame(() => {
    const f = frameRef.current;
    state.look.update(f, state.post);
    state.post.render(state.look.scene, state.look.camera, f);
  }, 1);
  return null;
};

export const Stage = <P,>({ factory, props }: { factory: LookFactory<P>; props: P }) => {
  const ready = useAssets();
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  // Render at the exact device-pixel size Remotion captures (--scale sets
  // devicePixelRatio). In the Studio, cap it so 4K previews stay interactive.
  const dpr =
    typeof window === "undefined" ? 1 : isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
  const pxW = Math.round(width * dpr);
  const pxH = Math.round(height * dpr);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {ready ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          legacy
          gl={{ antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <Runner factory={factory} props={props} pxW={pxW} pxH={pxH} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
