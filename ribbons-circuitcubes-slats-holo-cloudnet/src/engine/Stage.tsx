import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostParams, PostPipeline } from "./post";

/** What a look hands back: a scene, a camera, and pure functions of the frame. */
export type LookHandle = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Pose everything for this frame. Must depend on `frame` only. */
  update: (frame: number, width: number, height: number) => void;
  post: (frame: number) => PostParams;
  /** Optional offscreen work before the main render (e.g. a height-field pass). */
  prerender?: (gl: THREE.WebGLRenderer, frame: number, width: number, height: number) => void;
  dispose?: () => void;
};

export type LookFactory<P> = (params: P, gl: THREE.WebGLRenderer) => LookHandle;

function Driver<P>({ factory, params }: { factory: LookFactory<P>; params: P }) {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);
  // The frame is read from Remotion during render; R3F's clock is never used.
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const look = useMemo(() => {
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    return factory(params, gl);
  }, [factory, params, gl]);
  const post = useMemo(() => new PostPipeline(gl), [gl]);
  const size = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => () => look.dispose?.(), [look]);
  useEffect(() => () => post.dispose(), [post]);

  // Priority 1 takes over rendering from R3F; called on every advance().
  useFrame(() => {
    const f = frameRef.current;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    gl.getDrawingBufferSize(size);
    look.update(f, size.x, size.y);
    look.prerender?.(gl, f, size.x, size.y);
    post.render(look.scene, look.camera, look.post(f), size.x, size.y, f);
  }, 1);
  return null;
}

export function Stage<P>({ factory, params }: { factory: LookFactory<P>; params: P }) {
  const { width, height } = useVideoConfig();
  // Remotion's --scale is applied as the device pixel ratio; render at exactly that.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: false,
        }}
        camera={{ position: [0, 0, 5] }}
      >
        <Driver factory={factory} params={params} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
