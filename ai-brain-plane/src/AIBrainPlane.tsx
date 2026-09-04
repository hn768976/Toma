import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Euler, Matrix4, NoToneMapping, Quaternion, Vector3 } from "three";
import { BEATS } from "./config";
import { Brain } from "./brain/Brain";
import { BRAIN } from "./brain/geometry";
import { CircuitPlane } from "./plane/CircuitPlane";
import { CAMERA, cameraState, halfHeightAt, placeInFrame, projectToScreen } from "./scene/camera";
import { Contact } from "./scene/Contact";
import { Backdrop, BloomHalo, Grain, Vignette } from "./scene/Overlays";
import { clamp, easeInOutSine, easeOutCubic, smoothstep } from "./lib/math";
import { THEMES, type Theme } from "./theme";

/**
 * Composition layout
 * ------------------
 * The brain is placed from the camera's own basis every frame, so it holds its
 * position in frame — right of centre, about a third of frame height — while
 * the camera traverses. Only the plane reprojects, which is exactly the
 * relationship the reference has.
 */
const LAYOUT = {
  /** Distance from the camera to the brain. */
  depth: 130,
  /** Fractions of the half-frame at that depth. */
  rightFrac: 0.32,
  upFrac: 0.17,
  /** Brain height as a fraction of full frame height. */
  heightFrac: 1 / 3,
  /** Local vertical extent of the cortex plus cerebellum, without the stem. */
  localHeight: 1.79,
  /** Bob amplitude in world units, and its rate in Hz. */
  bob: 0.85,
  bobRate: 0.16,
} as const;

const WORLD_UP = new Vector3(0, 1, 0);
const lookMatrix = new Matrix4();
/** Constant lean applied after the brain has been turned to face the camera. */
const LEAN = new Euler(0.04, -0.13, 0.025);

const CameraRig: React.FC<{ pos: Vector3; target: Vector3 }> = ({ pos, target }) => {
  const camera = useThree((s) => s.camera);
  camera.position.copy(pos);
  camera.up.copy(WORLD_UP);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return null;
};

export const AIBrainPlane: React.FC<{ themeId: string }> = ({ themeId }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const theme: Theme = THEMES[themeId] ?? THEMES.blue;
  const time = frame / fps;
  const aspect = width / height;

  // Rendering at --scale=0.5 halves the device pixel ratio, so the WebGL
  // buffer follows the output size instead of always being 4K.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

  const state = useMemo(() => {
    const cam = cameraState(time);

    // --- brain -------------------------------------------------------------
    const halfH = halfHeightAt(cam, LAYOUT.depth);
    const scale = (LAYOUT.heightFrac * 2 * halfH) / LAYOUT.localHeight;
    const anchor = placeInFrame(cam, LAYOUT.depth, LAYOUT.rightFrac, LAYOUT.upFrac, aspect);
    const bob =
      Math.sin(time * Math.PI * 2 * LAYOUT.bobRate) * LAYOUT.bob +
      Math.sin(time * Math.PI * 2 * LAYOUT.bobRate * 0.41 + 1.3) * LAYOUT.bob * 0.4;
    const brainPos = anchor.clone().addScaledVector(cam.up, bob);

    // Face the camera, then lean slightly off-axis so it reads as an object in
    // space rather than as a decal.
    // Matrix4.lookAt points +Z from the target back toward the eye, so the
    // camera goes first: that leaves the brain's +Z facing the lens.
    lookMatrix.lookAt(cam.pos, brainPos, cam.up);
    const quat = new Quaternion().setFromRotationMatrix(lookMatrix);
    // A small lean in the brain's own frame, so it is not a flat decal.
    quat.multiply(new Quaternion().setFromEuler(LEAN));

    // --- contact point -----------------------------------------------------
    // Directly below the tip of the brain stem, on the plane.
    const stemTip = new Vector3(-0.13, BRAIN.minY, 0)
      .applyQuaternion(quat)
      .multiplyScalar(scale)
      .add(brainPos);
    const contact = new Vector3(stemTip.x, 0, stemTip.z);

    return { cam, scale, brainPos, quat, contact, halfH };
  }, [time, aspect]);

  // --- beats ---------------------------------------------------------------
  // Eased in and out, and carried a little past 1 so the last nodes in the
  // sweep are fully lit rather than still fading up when the beat ends.
  const progress =
    easeInOutSine(
      clamp((frame - BEATS.drawOnStart) / (BEATS.drawOnEnd - BEATS.drawOnStart)),
    ) * 1.06;
  const aiOpacity = easeInOutSine(
    clamp((frame - BEATS.aiStart) / (BEATS.aiEnd - BEATS.aiStart)),
  );
  const igniteT = clamp(
    (frame - BEATS.igniteStart) / (BEATS.igniteEnd - BEATS.igniteStart),
  );
  // Rays fan out fast and fall away; the point itself stays lit.
  const burst = Math.pow(Math.sin(Math.PI * igniteT), 1.4) * (igniteT > 0 ? 1 : 0);
  const rayLength = 0.22 + easeOutCubic(igniteT) * 0.78;
  const coreOpacity = smoothstep(0, 1, clamp((frame - BEATS.igniteStart) / 18));
  const glowStrength =
    0.34 * smoothstep(0, 1, clamp((frame - 40) / 70)) * (0.94 + 0.06 * Math.sin(time * 0.9));

  // --- DOM bloom placement -------------------------------------------------
  const brainScreen = projectToScreen(state.brainPos, state.cam, aspect);
  const contactScreen = projectToScreen(state.contact, state.cam, aspect);
  const brainHeightPx = LAYOUT.localHeight * state.scale * brainScreen.scale * height;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Backdrop theme={theme} />
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: true,
          // Nothing is tone mapped: the node cores are meant to clip to white.
          toneMapping: NoToneMapping,
          powerPreference: "high-performance",
        }}
        camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far }}
        style={{ backgroundColor: "transparent" }}
      >
        <CameraRig pos={state.cam.pos} target={state.cam.target} />
        <CircuitPlane
          theme={theme}
          time={time}
          camPos={state.cam.pos}
          contact={state.contact}
          glowStrength={glowStrength}
        />
        <Brain
          theme={theme}
          anim={{ progress, time, aiOpacity }}
          scale={state.scale}
          position={[state.brainPos.x, state.brainPos.y, state.brainPos.z]}
          quaternion={state.quat}
          aiCenter={[0.0, 0.15, 0.14]}
          aiHeight={0.66}
        />
        <Contact
          theme={theme}
          center={state.contact}
          size={state.scale * 0.62}
          coreOpacity={coreOpacity}
          burst={burst}
          rayLength={rayLength}
          time={time}
        />
      </ThreeCanvas>
      <BloomHalo
        theme={theme}
        x={brainScreen.x}
        y={brainScreen.y}
        size={brainHeightPx * 1.75}
        opacity={0.22 * progress}
        falloff={58}
      />
      <BloomHalo
        theme={theme}
        x={contactScreen.x}
        y={contactScreen.y}
        size={brainHeightPx * 0.5}
        opacity={0.17 * coreOpacity}
        falloff={52}
      />
      <Vignette />
      <Grain frame={frame} />
    </AbsoluteFill>
  );
};
