import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useRemotionEnvironment } from "remotion";
import * as THREE from "three";
import { HEIGHT, WIDTH } from "./constants";
import { Post, PostConfig } from "./post";

/**
 * Draws the R3F scene through the shared post pipeline. useFrame is used only
 * as the "draw now" hook that ThreeCanvas' advance() triggers; nothing reads
 * its clock. All scene state is set from useCurrentFrame() during commit.
 */
const Pipeline: React.FC<{
  post: PostConfig;
  camera: THREE.Camera;
  before?: (gl: THREE.WebGLRenderer) => void;
}> = ({ post, camera, before }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const pipeline = useMemo(() => new Post(gl, post), [gl]); // eslint-disable-line react-hooks/exhaustive-deps
  pipeline.cfg = post;
  useEffect(() => () => pipeline.dispose(), [pipeline]);
  useFrame(() => {
    before?.(gl);
    pipeline.render(scene, camera, frameRef.current);
  }, 1);
  return null;
};

export const LookCanvas: React.FC<{
  post: PostConfig;
  camera: THREE.Camera;
  shadows?: boolean;
  /** Called right before the scene is drawn (e.g. to fill an offscreen target). */
  before?: (gl: THREE.WebGLRenderer) => void;
  children: React.ReactNode;
}> = ({ post, camera, shadows, before, children }) => {
  const { isRendering } = useRemotionEnvironment();
  // Render at exactly the output resolution: Remotion's --scale becomes the
  // device pixel ratio. In the Studio, cap the buffer at 1920x1080.
  const dpr =
    typeof window === "undefined"
      ? 1
      : isRendering
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={WIDTH}
        height={HEIGHT}
        dpr={dpr}
        flat
        linear
        shadows={shadows ? "variance" : false}
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
      >
        <Pipeline post={post} camera={camera} before={before} />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ assets ----

let exrPromise: Promise<THREE.DataTexture> | null = null;
const loadStudioExr = (url: string) => {
  if (!exrPromise) {
    exrPromise = import("three/examples/jsm/loaders/EXRLoader.js").then(
      ({ EXRLoader }) =>
        new Promise<THREE.DataTexture>((resolve, reject) => {
          new EXRLoader().setDataType(THREE.HalfFloatType).load(
            url,
            (tex) => {
              tex.mapping = THREE.EquirectangularReflectionMapping;
              resolve(tex);
            },
            undefined,
            reject,
          );
        }),
    );
  }
  return exrPromise;
};

/** Poly Haven studio HDRI (CC0) as scene.environment, prefiltered with PMREM. */
export const StudioEnvironment: React.FC<{
  url: string;
  intensity: number;
  rotation: THREE.Euler;
}> = ({ url, intensity, rotation }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const advance = useThree((s) => s.advance);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading studio HDRI"));
  useEffect(() => {
    let rt: THREE.WebGLRenderTarget | null = null;
    loadStudioExr(url)
      .then((tex) => {
        const pm = new THREE.PMREMGenerator(gl);
        rt = pm.fromEquirectangular(tex);
        pm.dispose();
        scene.environment = rt.texture;
        // three ignores material.envMapIntensity for scene.environment; materials
        // that need their own strength opt in and get the map assigned directly.
        const envTex = rt.texture;
        scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && m.userData?.ownEnvIntensity) {
            m.envMap = envTex;
            m.needsUpdate = true;
          }
        });
        advance(performance.now());
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      scene.environment = null;
      rt?.dispose();
    };
  }, [gl, scene, url, handle, advance, continueRender, cancelRender]);
  scene.environmentIntensity = intensity;
  scene.environmentRotation.copy(rotation);
  return null;
};

const fontPromises = new Map<string, Promise<void>>();
/** Loads a shipped font file via the FontFace API, behind delayRender. Use outside the canvas. */
export const useShippedFont = (family: string, url: string, weight: string) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender(`Loading font ${family}`));
  useEffect(() => {
    const key = `${family}|${url}|${weight}`;
    let p = fontPromises.get(key);
    if (!p) {
      const face = new FontFace(family, `url(${url})`, { weight });
      p = face.load().then((f) => {
        (document.fonts as unknown as Set<FontFace>).add(f);
      });
      fontPromises.set(key, p);
    }
    p.then(() => setReady(true)).catch((e) => cancelRender(e));
  }, [family, url, weight, cancelRender]);
  // Released only after the tree that depends on the font has committed (and
  // registered its own delayRender handles).
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle, continueRender]);
  return ready;
};
