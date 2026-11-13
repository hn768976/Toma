import { useEffect, useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { Background } from "./Background";
import {
  CameraMode,
  RING_IN_END,
  RING_IN_START,
  RING_OUT_END,
  RING_OUT_START,
  SCOPE_MOVE_END,
  SCOPE_MOVE_START,
  SCOPE_TIP_END_X,
  SCOPE_TIP_START_X,
} from "./constants";
import { buildScene, SceneHandles } from "./scene";

type State = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  handles: SceneHandles;
};

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const ColonoscopyPolypDetection: React.FC<{ camera: CameraMode }> = ({
  camera: cameraMode,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<State | null>(null);

  const progress = frame / (durationInFrames - 1);
  const camEase = Easing.inOut(Easing.sin)(progress);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!state.current) {
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const camera = new THREE.PerspectiveCamera(24, width / height, 0.1, 100);
      state.current = { renderer, camera, handles: buildScene() };
    }
    const { renderer, camera, handles } = state.current;

    // ---- endoscope advance ----
    const tipX = interpolate(
      frame,
      [SCOPE_MOVE_START, SCOPE_MOVE_END],
      [SCOPE_TIP_START_X, SCOPE_TIP_END_X],
      { ...clamp, easing: Easing.inOut(Easing.quad) },
    );
    handles.scope.position.x = tipX;
    // rises towards the polyp as it advances
    handles.scope.position.y = interpolate(
      tipX,
      [SCOPE_TIP_START_X, SCOPE_TIP_END_X],
      [-0.06, 0.22],
    );

    // ---- detection ring ----
    const reveal = interpolate(frame, [RING_IN_START, RING_IN_END + 8], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    });
    const fadeIn = interpolate(frame, [RING_IN_START, RING_IN_END], [0, 1], clamp);
    const fadeOut = interpolate(frame, [RING_OUT_START, RING_OUT_END], [1, 0], {
      ...clamp,
      easing: Easing.out(Easing.quad),
    });
    const pulse = 0.94 + 0.06 * Math.sin((frame / fps) * Math.PI * 2 * 0.9);
    handles.ringMaterial.uniforms.uTime.value = frame / fps;
    handles.ringMaterial.uniforms.uReveal.value = reveal;
    // bloom flares right after lock-on, then settles
    handles.ringMaterial.uniforms.uGlow.value =
      0.15 +
      0.16 * interpolate(frame, [RING_IN_END, RING_IN_END + 14, RING_IN_END + 44], [0, 1, 0], clamp);
    handles.ringMaterial.uniforms.uOpacity.value = fadeIn * fadeOut * pulse;
    const pop = interpolate(frame, [RING_IN_START, RING_IN_END + 6], [1.28, 1], {
      ...clamp,
      easing: Easing.out(Easing.back(1.4)),
    });
    const shrink = interpolate(frame, [RING_OUT_START, RING_OUT_END], [1, 1.06], clamp);
    handles.ring.scale.setScalar(pop * shrink);
    handles.ring.visible = fadeIn * fadeOut > 0.001;

    // ---- camera ----
    if (cameraMode === "reference") {
      // locked-off cutaway view, looking slightly down into the open colon
      camera.fov = 24;
      camera.position.set(0.15, 2.95, 7.4);
      camera.lookAt(0.15, 0.33, 0);
    } else {
      // alternative: low three-quarter view that follows the scope from behind,
      // orbiting to the right while pushing in on the polyp.
      const p = handles.polypPosition;
      const az = THREE.MathUtils.lerp(-0.48, 0.3, camEase); // around the Y axis
      const el = THREE.MathUtils.lerp(0.44, 0.26, camEase);
      const dist = THREE.MathUtils.lerp(8.6, 5.4, camEase);
      const tx = THREE.MathUtils.lerp(-0.2, p.x - 0.55, camEase);
      const ty = THREE.MathUtils.lerp(0.0, p.y - 0.12, camEase);
      camera.fov = 27;
      camera.position.set(
        tx + dist * Math.sin(az) * Math.cos(el),
        ty + dist * Math.sin(el),
        dist * Math.cos(az) * Math.cos(el),
      );
      camera.lookAt(tx, ty, -0.35);
    }
    camera.updateProjectionMatrix();
    renderer.render(handles.scene, camera);
    renderer.getContext().finish();
  });

  useEffect(() => {
    return () => {
      state.current?.handles.dispose();
      state.current?.renderer.dispose();
      state.current = null;
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#010409" }}>
      <Background drift={cameraMode === "orbit" ? camEase * 0.06 : 0} />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
