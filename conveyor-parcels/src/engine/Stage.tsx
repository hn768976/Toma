import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Look, PostPipeline, Render } from "./pipeline";

/**
 * A World is a three.js scene graph plus a pure function of the frame number.
 * `update(frame)` must set every animated value absolutely - it may never
 * accumulate state from a previous call, because Remotion renders frames out
 * of order and in several browser tabs at once.
 */
export interface World {
  root: THREE.Object3D;
  /** Called once, when the renderer exists (environment maps, shadow settings). */
  setup?: (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => void;
  /** Position everything for this frame, including the camera and the look. */
  update: (frame: number, camera: THREE.PerspectiveCamera, look: Look) => void;
}

interface Engine {
  pipeline: PostPipeline;
}

const engines = new WeakMap<THREE.WebGLRenderer, Engine>();

/**
 * The renderer handed to React Three Fiber. Its `render()` is replaced by the
 * post pipeline, so when <ThreeCanvas> advances R3F once for the current
 * Remotion frame, the whole chain runs - no useFrame, no animation loop.
 */
const makeRenderer = (look: Look) => (props: { canvas: unknown }) => {
  const renderer = new THREE.WebGLRenderer({
    canvas: props.canvas as HTMLCanvasElement,
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pipeline = new PostPipeline(look);
  const base: Render = renderer.render.bind(renderer);
  let inside = false;
  renderer.render = (scene: THREE.Object3D, camera: THREE.Camera) => {
    if (inside) {
      base(scene, camera);
      return;
    }
    inside = true;
    try {
      pipeline.render(renderer, base, scene as THREE.Scene, camera);
    } finally {
      inside = false;
    }
  };
  engines.set(renderer, { pipeline });
  return renderer;
};

const WorldDriver: React.FC<{ world: World; look: Look }> = ({ world, look }) => {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl) as THREE.WebGLRenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const { width, height } = useVideoConfig();

  useLayoutEffect(() => {
    world.setup?.(gl, scene);
  }, [world, gl, scene]);

  // Runs before <ThreeCanvas> advances R3F for this frame.
  useLayoutEffect(() => {
    const engine = engines.get(gl);
    if (!engine) return;
    camera.aspect = width / height;
    world.update(frame, camera, look);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    engine.pipeline.look = look;
    engine.pipeline.frame = frame;
  }, [frame, world, look, gl, camera, width, height]);

  return <primitive object={world.root} />;
};

export const Stage: React.FC<{ makeWorld: () => World; look: Look }> = ({ makeWorld, look }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  // The drawing buffer follows the render scale: --scale=0.5 renders 1920x1080
  // buffers, --scale=1 renders 3840x2160. In the Studio preview half-res is plenty.
  const dpr = isRendering && typeof window !== "undefined" ? window.devicePixelRatio : 0.5;
  const world = useMemo(() => makeWorld(), [makeWorld]);
  // one mutable copy per mount: World.update may animate look values per frame
  const liveLook = useMemo(() => JSON.parse(JSON.stringify(look)) as Look, [look]);
  const gl = useMemo(() => makeRenderer(liveLook), [liveLook]);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        gl={gl}
        flat
        shadows="soft"
        camera={{ fov: 30, near: 0.1, far: 1000, position: [0, 1, 5] }}
      >
        <WorldDriver world={world} look={liveLook} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
