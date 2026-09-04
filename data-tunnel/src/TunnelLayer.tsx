import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  ATT_BASE,
  ATT_REF,
  COLOR_DEPTH,
  DASH_MAX_LEN_PX,
  DRIFT_PERIOD_X,
  DRIFT_PERIOD_Y,
  DRIFT_SECONDARY,
  DRIFT_SECONDARY_PERIOD,
  DRIFT_X,
  DRIFT_Y,
  DURATION_IN_FRAMES,
  FOG_END,
  FOG_START,
  FOV,
  NEAR_FADE,
  REFERENCE_HEIGHT,
  ROLL_DEGREES,
  ROLL_PERIOD,
  SIZE_MAX,
  STREAK_MAX_LEN_PX,
  STREAK_VISIBLE_FROM,
  STREAK_VISIBLE_TO,
  VP_OFFSET_X,
  VP_OFFSET_Y,
  Z_TOTAL,
} from "./constants";
import { hexToRgb, Palette } from "./palette";
import {
  CAPSULE_FRAGMENT,
  CAPSULE_VERTEX,
  DOT_FRAGMENT,
  DOT_VERTEX,
} from "./shaders";
import { CapsuleBuffers, DASHES, DOTS, STREAKS } from "./volume";

const TAU = Math.PI * 2;

// --------------------------------------------------------------------------
// Camera. Position, orientation and the vanishing-point offset are all pure
// functions of the frame, so every layer's canvas resolves the same camera
// and threads rendering out of order stay consistent.
// --------------------------------------------------------------------------

export type CameraState = {
  readonly x: number;
  readonly y: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
};

export const cameraStateForFrame = (
  frame: number,
  aspect: number,
): CameraState => {
  const tanHalf = Math.tan((FOV * Math.PI) / 360);

  // Slight lateral and vertical float on a looping sine, plus a second
  // faster component so the path never reads as a plain oscillation.
  const x =
    DRIFT_X * Math.sin(TAU * (frame / DRIFT_PERIOD_X)) +
    DRIFT_SECONDARY * Math.sin(TAU * (frame / DRIFT_SECONDARY_PERIOD) + 1.1);
  const y =
    DRIFT_Y * Math.sin(TAU * (frame / DRIFT_PERIOD_Y) + 2.2) +
    DRIFT_SECONDARY * Math.cos(TAU * (frame / DRIFT_SECONDARY_PERIOD) + 0.4);

  return {
    x,
    y,
    // Rotating the camera (rather than shifting the principal point) is what
    // puts the vanishing point off-axis: the tunnel walls then converge
    // asymmetrically, exactly as in the reference.
    yaw: Math.atan(VP_OFFSET_X * tanHalf * aspect),
    pitch: Math.atan(-VP_OFFSET_Y * tanHalf),
    roll: (ROLL_DEGREES * Math.PI) / 180 * Math.sin(TAU * (frame / ROLL_PERIOD) + 0.7),
  };
};

const CameraRig: React.FC<{ readonly frame: number; readonly aspect: number }> = ({
  frame,
  aspect,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  useLayoutEffect(() => {
    const state = cameraStateForFrame(frame, aspect);
    camera.fov = FOV;
    camera.aspect = aspect;
    camera.near = 0.1;
    camera.far = Z_TOTAL * 1.5;
    camera.position.set(state.x, state.y, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.set(state.pitch, state.yaw, state.roll);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  });

  return null;
};

// --------------------------------------------------------------------------
// Uniform plumbing
// --------------------------------------------------------------------------

export type SharedUniformValues = {
  readonly travel: number;
  readonly frame: number;
  readonly slab: THREE.Vector4;
  readonly pixelScale: number;
  readonly halfRes: THREE.Vector2;
  readonly palette: Palette;
};

const makeSharedUniforms = () => ({
  uTravel: { value: 0 },
  uZTotal: { value: Z_TOTAL },
  uSlab: { value: new THREE.Vector4() },
  uPixelScale: { value: 1 },
  uFrame: { value: 0 },
  uColNear: { value: new THREE.Vector3() },
  uColMid: { value: new THREE.Vector3() },
  uColFar: { value: new THREE.Vector3() },
  uTintColor: { value: new THREE.Vector3() },
  uTintAmount: { value: 0 },
  uColorDepth: { value: COLOR_DEPTH },
  uNearFade: { value: NEAR_FADE },
  uFog: { value: new THREE.Vector2(FOG_START, FOG_END) },
  uIntensity: { value: 1 },
  uAtten: { value: ATT_REF },
  uAttenBase: { value: ATT_BASE },
  uSizeMax: { value: SIZE_MAX },
});

type SharedUniforms = ReturnType<typeof makeSharedUniforms>;

const applyShared = (u: SharedUniforms, v: SharedUniformValues) => {
  const p = v.palette;
  u.uTravel.value = v.travel;
  u.uFrame.value = v.frame;
  u.uSlab.value.copy(v.slab);
  u.uPixelScale.value = v.pixelScale;
  u.uColNear.value.fromArray(hexToRgb(p.colNear));
  u.uColMid.value.fromArray(hexToRgb(p.colMid));
  u.uColFar.value.fromArray(hexToRgb(p.colFar));
  u.uTintColor.value.fromArray(hexToRgb(p.tint));
  u.uTintAmount.value = p.tintAmount;
  u.uIntensity.value = p.intensity;
};

// Additive, premultiplied. Nothing is depth tested: the whole volume is
// emissive and order-independent.
const BLEND = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
  blendEquation: THREE.AddEquation,
} as const;

// --------------------------------------------------------------------------
// Dots
// --------------------------------------------------------------------------

const Dots: React.FC<{ readonly shared: SharedUniformValues }> = ({ shared }) => {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(DOTS.position, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(DOTS.size, 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(DOTS.bright, 1));
    g.setAttribute("aShim", new THREE.BufferAttribute(DOTS.shimmer, 2));
    g.setAttribute("aPeriod", new THREE.BufferAttribute(DOTS.period, 1));
    g.setAttribute("aTint", new THREE.BufferAttribute(DOTS.tint, 1));

    const m = new THREE.ShaderMaterial({
      uniforms: makeSharedUniforms(),
      vertexShader: DOT_VERTEX,
      fragmentShader: DOT_FRAGMENT,
      ...BLEND,
    });
    return { geometry: g, material: m };
  }, []);

  useLayoutEffect(() => {
    applyShared(material.uniforms as SharedUniforms, shared);
  });

  return <points args={[geometry, material]} frustumCulled={false} />;
};

// --------------------------------------------------------------------------
// Dashes and streaks (screen-space capsules)
// --------------------------------------------------------------------------

const QUAD_POSITION = new Float32Array([
  -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
]);
const QUAD_UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];

type CapsuleProps = {
  readonly shared: SharedUniformValues;
  readonly buffers: CapsuleBuffers;
  readonly widthGain: number;
  readonly bead: boolean;
  readonly nearOnly: boolean;
  readonly maxLenPx: number;
};

const Capsules: React.FC<CapsuleProps> = ({
  shared,
  buffers,
  widthGain,
  bead,
  nearOnly,
  maxLenPx,
}) => {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(QUAD_POSITION, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(QUAD_UV, 2));
    g.setIndex(QUAD_INDEX);
    g.setAttribute("iPos", new THREE.InstancedBufferAttribute(buffers.position, 3));
    g.setAttribute("iLen", new THREE.InstancedBufferAttribute(buffers.length, 1));
    g.setAttribute("iWidth", new THREE.InstancedBufferAttribute(buffers.width, 1));
    g.setAttribute("iBright", new THREE.InstancedBufferAttribute(buffers.bright, 1));
    g.setAttribute("iShim", new THREE.InstancedBufferAttribute(buffers.shimmer, 2));
    g.setAttribute("iPeriod", new THREE.InstancedBufferAttribute(buffers.period, 1));
    g.setAttribute("iTint", new THREE.InstancedBufferAttribute(buffers.tint, 1));
    g.instanceCount = buffers.count;

    const m = new THREE.ShaderMaterial({
      uniforms: {
        ...makeSharedUniforms(),
        uHalfRes: { value: new THREE.Vector2(1, 1) },
        uWidthGain: { value: widthGain },
        uMaxLenPx: { value: maxLenPx },
        uNearOnly: { value: nearOnly ? 1 : 0 },
        uNearOnlyRange: {
          value: new THREE.Vector2(STREAK_VISIBLE_FROM, STREAK_VISIBLE_TO),
        },
        uBead: { value: bead ? 1 : 0 },
      },
      vertexShader: CAPSULE_VERTEX,
      fragmentShader: CAPSULE_FRAGMENT,
      ...BLEND,
    });
    return { geometry: g, material: m };
  }, [buffers, widthGain, bead, nearOnly, maxLenPx]);

  useLayoutEffect(() => {
    const u = material.uniforms as SharedUniforms & {
      uHalfRes: { value: THREE.Vector2 };
    };
    applyShared(u, shared);
    u.uHalfRes.value.copy(shared.halfRes);
  });

  return <mesh args={[geometry, material]} frustumCulled={false} />;
};

// --------------------------------------------------------------------------
// A single depth-bucket layer
// --------------------------------------------------------------------------

export type TunnelLayerProps = {
  readonly frame: number;
  readonly travel: number;
  readonly palette: Palette;
  /** Composition size in CSS pixels. */
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Backing-store scale for this layer, 1 = full resolution. */
  readonly renderScale: number;
  readonly dpr: number;
  readonly slab: [number, number, number, number];
  /** What this layer draws. */
  readonly content: "all" | "streaks";
  readonly widthGain?: number;
};

export const TunnelLayer: React.FC<TunnelLayerProps> = ({
  frame,
  travel,
  palette,
  frameWidth,
  frameHeight,
  renderScale,
  dpr,
  slab,
  content,
  widthGain = 1,
}) => {
  const layerWidth = Math.max(2, Math.round(frameWidth * renderScale));
  const layerHeight = Math.max(2, Math.round(frameHeight * renderScale));
  const aspect = frameWidth / frameHeight;

  const bufferWidth = Math.max(1, Math.floor(layerWidth * dpr));
  const bufferHeight = Math.max(1, Math.floor(layerHeight * dpr));

  const shared: SharedUniformValues = useMemo(
    () => ({
      travel,
      frame,
      slab: new THREE.Vector4(...slab),
      // Sizes are authored against REFERENCE_HEIGHT; this converts them to
      // device pixels of *this* layer's backing store, so a downscaled
      // layer draws elements at the same apparent size as a full-res one.
      pixelScale: bufferHeight / REFERENCE_HEIGHT,
      halfRes: new THREE.Vector2(bufferWidth / 2, bufferHeight / 2),
      palette,
    }),
    [travel, frame, slab, bufferWidth, bufferHeight, palette],
  );

  return (
    <ThreeCanvas
      linear
      flat
      width={layerWidth}
      height={layerHeight}
      dpr={dpr}
      gl={{ antialias: false, alpha: true, premultipliedAlpha: true }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <CameraRig frame={frame} aspect={aspect} />
      {content === "all" ? (
        <>
          <Dots shared={shared} />
          <Capsules
            shared={shared}
            buffers={DASHES}
            widthGain={1}
            bead={false}
            nearOnly={false}
            maxLenPx={DASH_MAX_LEN_PX}
          />
        </>
      ) : null}
      <Capsules
        shared={shared}
        buffers={STREAKS}
        widthGain={widthGain}
        bead
        nearOnly
        maxLenPx={STREAK_MAX_LEN_PX}
      />
    </ThreeCanvas>
  );
};

export const travelForFrame = (frame: number): number =>
  (frame / DURATION_IN_FRAMES) * Z_TOTAL;
