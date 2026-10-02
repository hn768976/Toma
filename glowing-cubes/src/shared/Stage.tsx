import { useThree } from "@react-three/fiber";
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { EquirectangularReflectionMapping, type PerspectiveCamera, type Texture, Vector3 } from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

// CC0 studio HDRI from Poly Haven ("Studio Small 03"), shipped in /public.
export const HDRI_PATH = "hdri/studio_small_03_512.exr";

type ReadyCheck = () => boolean;
const ReadyContext = createContext<React.MutableRefObject<Set<ReadyCheck>> | null>(null);

/**
 * Register a readiness predicate. <FrameGate> will not render a frame until
 * every registered predicate returns true (e.g. the effect composer has
 * finished building its passes, which happens asynchronously after mount).
 */
export const useReadyCheck = (check: ReadyCheck) => {
  const set = useContext(ReadyContext);
  useLayoutEffect(() => {
    if (!set) return;
    set.current.add(check);
    return () => {
      set.current.delete(check);
    };
  }, [set, check]);
};

/**
 * Loads the environment map behind delayRender/continueRender. Nothing in
 * `children` mounts until the map is there, and the load handle is only
 * released once <FrameGate> has taken its own per-frame handle, so no frame
 * can be captured without the environment.
 */
export const Stage: React.FC<{
  children: React.ReactNode;
  envIntensity: number;
  envRotationY?: number;
}> = ({ children, envIntensity, envRotationY = 0 }) => {
  const [loadHandle] = useState(() => delayRender("Loading studio HDRI"));
  const [tex, setTex] = useState<Texture | null>(null);
  const scene = useThree((s) => s.scene);
  const checks = useRef(new Set<ReadyCheck>());
  const released = useRef(false);
  const releaseLoad = useCallback(() => {
    if (released.current) return;
    released.current = true;
    continueRender(loadHandle);
  }, [loadHandle]);

  useEffect(() => {
    new EXRLoader().load(
      staticFile(HDRI_PATH),
      (t) => {
        t.mapping = EquirectangularReflectionMapping;
        setTex(t);
      },
      undefined,
      (err) => cancelRender(err),
    );
  }, []);

  useLayoutEffect(() => {
    if (!tex) return;
    scene.environment = tex;
    scene.environmentIntensity = envIntensity;
    scene.environmentRotation.set(0, envRotationY, 0);
  }, [scene, tex, envIntensity, envRotationY]);

  if (!tex) return null;
  return (
    <ReadyContext.Provider value={checks}>
      {children}
      <FrameGate onArmed={releaseLoad} checks={checks} />
    </ReadyContext.Provider>
  );
};

const READY_TIMEOUT_MS = 60000;

/**
 * Per-frame render gate. On every frame change it holds a delayRender
 * handle, waits until every readiness check passes (and one more tick so all
 * pending React work in the three.js tree has flushed), renders the WebGL
 * frame explicitly, then releases. A cold single-frame render therefore
 * produces exactly the same pixels as that frame inside a full render.
 */
const FrameGate: React.FC<{ onArmed: () => void; checks: React.MutableRefObject<Set<ReadyCheck>> }> = ({
  onArmed,
  checks,
}) => {
  const frame = useCurrentFrame();
  const advance = useThree((s) => s.advance);
  useLayoutEffect(() => {
    const handle = delayRender(`Rendering WebGL frame ${frame}`);
    onArmed();
    let timer = 0;
    let done = false;
    const t0 = performance.now();
    const allReady = () => [...checks.current].every((c) => c());
    const tick = (settle: boolean) => {
      if (!allReady()) {
        if (performance.now() - t0 > READY_TIMEOUT_MS) {
          cancelRender(new Error(`Scene not ready after ${READY_TIMEOUT_MS} ms (frame ${frame})`));
          return;
        }
        timer = window.setTimeout(() => tick(true), 16);
        return;
      }
      if (settle) {
        // ready now — give React one more tick to flush, then re-check
        timer = window.setTimeout(() => tick(false), 0);
        return;
      }
      advance(performance.now());
      done = true;
      continueRender(handle);
    };
    timer = window.setTimeout(() => tick(true), 0);
    return () => {
      window.clearTimeout(timer);
      if (!done) continueRender(handle);
    };
  }, [frame, advance, onArmed, checks]);
  return null;
};

/** Places the default camera from pure frame-derived values. */
export const CameraRig: React.FC<{ position: Vector3; target: Vector3; fov: number }> = ({
  position,
  target,
  fov,
}) => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.fov = fov;
    camera.near = 0.1;
    camera.far = 200;
    camera.position.copy(position);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }, [camera, position, target, fov]);
  return null;
};
