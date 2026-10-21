import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo, useState } from "react";
import { useDelayRender } from "remotion";
import {
  Color,
  DoubleSide,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  ShaderMaterial,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BackgroundId } from "../data";
import { CameraState, PhoneState } from "../moves/types";
import { getPhoneParts, PHONE } from "./phoneGeometry";

// ---------------------------------------------------------------------------
// Lighting presets. Lights never touch the screen (it is MeshBasicMaterial).
// ---------------------------------------------------------------------------
type LightPreset = {
  env: number;
  key: number;
  rim: number;
  envSwing: number; // radians of slow environment rotation (sliding highlights)
  keySwing: number;
};

export const LIGHTS: Record<BackgroundId, LightPreset> = {
  white: { env: 1.6, key: 1.5, rim: 1.0, envSwing: 0.35, keySwing: 0.25 },
  black: { env: 0.32, key: 0.55, rim: 3.0, envSwing: 0.5, keySwing: 0.35 },
  graphite: { env: 0.42, key: 1.6, rim: 2.2, envSwing: 0.9, keySwing: 0.6 },
  green: { env: 0.6, key: 1.2, rim: 1.0, envSwing: 0.35, keySwing: 0.25 },
};

// ---------------------------------------------------------------------------
// Background: a full-screen quad drawn first, in linear light.
// ---------------------------------------------------------------------------
const BG_FRAG = /* glsl */ `
precision highp float;
uniform int uMode;
uniform float uAspect;
varying vec2 vUv;

vec3 toLinear(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}

void main() {
  vec3 srgb;
  if (uMode == 0) {
    // Green: exactly #00FF00 (linear 0,1,0).
    gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    return;
  } else if (uMode == 1) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  } else if (uMode == 2) {
    // White studio: #F4F5F7 with a very soft floor gradient toward the bottom.
    vec3 wall = vec3(244.0, 245.0, 247.0) / 255.0;
    vec3 floorC = vec3(236.0, 238.0, 241.0) / 255.0;
    float t = smoothstep(0.62, 0.0, vUv.y);
    srgb = mix(wall, floorC, t * t * (3.0 - 2.0 * t));
  } else {
    // Graphite: radial #1A1C20 centre -> #050506 edges.
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float d = length(p) / (0.5 * length(vec2(uAspect, 1.0)));
    vec3 inner = vec3(26.0, 28.0, 32.0) / 255.0;
    vec3 outer = vec3(5.0, 5.0, 6.0) / 255.0;
    srgb = mix(inner, outer, smoothstep(0.0, 1.0, d));
  }
  gl_FragColor = vec4(toLinear(srgb), 1.0);
}
`;

const SCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BG_MODE: Record<BackgroundId, number> = { green: 0, black: 1, white: 2, graphite: 3 };

const Backdrop: React.FC<{ background: BackgroundId }> = ({ background }) => {
  const mesh = useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: { uMode: { value: 0 }, uAspect: { value: 16 / 9 } },
      vertexShader: SCREEN_VERT,
      fragmentShader: BG_FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const m = new Mesh(new PlaneGeometry(2, 2), material);
    m.frustumCulled = false;
    m.renderOrder = -1000;
    return m;
  }, []);
  (mesh.material as ShaderMaterial).uniforms.uMode.value = BG_MODE[background];
  return <primitive object={mesh} />;
};

// ---------------------------------------------------------------------------
// Soft contact shadow for the white studio: an analytic blurred rounded box on
// a plane behind the phone. Deterministic, no shadow maps, no accumulation.
// ---------------------------------------------------------------------------
const SHADOW_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uBlur;
uniform float uOpacity;
uniform vec2 uPlane;
varying vec2 vUv;
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 p = (vUv - 0.5) * uPlane;
  float d = sdRoundBox(p, uHalf, uRadius);
  float soft = 1.0 - smoothstep(-uBlur, uBlur, d);
  float core = 1.0 - smoothstep(-uBlur * 0.25, uBlur * 0.35, d);
  float a = uOpacity * (0.7 * soft + 0.3 * core);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;

const SHADOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SHADOW_BLUR = 0.11;
const SHADOW_PLANE = { w: PHONE.W + 0.5, h: PHONE.H + 0.5 };
const shadowGeometry = new PlaneGeometry(SHADOW_PLANE.w, SHADOW_PLANE.h);

const ContactShadow: React.FC<{ phone: PhoneState }> = ({ phone }) => {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uHalf: { value: [PHONE.W / 2, PHONE.H / 2] },
          uRadius: { value: PHONE.R },
          uBlur: { value: SHADOW_BLUR },
          uOpacity: { value: 0.34 },
          uPlane: { value: [SHADOW_PLANE.w, SHADOW_PLANE.h] },
        },
        vertexShader: SHADOW_VERT,
        fragmentShader: SHADOW_FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  const [x, y, z] = phone.pos;
  const s = phone.scale ?? 1;
  // Turning the phone narrows its silhouette; the slab never gets thinner than its depth.
  const widthScale = Math.max(Math.abs(Math.cos(phone.rot[1])), PHONE.D / PHONE.W);
  const backdropZ = z - 0.75;
  return (
    <mesh
      geometry={shadowGeometry}
      material={material}
      position={[x + 0.1, y - 0.11, backdropZ]}
      rotation={[0, 0, phone.rot[2]]}
      scale={[widthScale * s, s, 1]}
    />
  );
};

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------
const Phone: React.FC<{ state: PhoneState }> = ({ state }) => {
  const parts = getPhoneParts();
  const s = state.scale ?? 1;
  return (
    <group position={state.pos} rotation={state.rot} scale={[s, s, s]}>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={p.material} position={p.position} rotation={p.rotation ?? [0, 0, 0]} />
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Environment (RoomEnvironment PMREM) generated behind delayRender.
// ---------------------------------------------------------------------------
const StudioEnvironment: React.FC<{ intensity: number; rotationY: number }> = ({ intensity, rotationY }) => {
  const { gl, scene, advance } = useThree();
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Generating studio environment map"));

  useLayoutEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const texture = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = texture;
    scene.background = null;
    advance(performance.now());
    continueRender(handle);
    return () => {
      texture.dispose();
    };
  }, [gl, scene, advance, continueRender, handle]);

  useLayoutEffect(() => {
    scene.environmentIntensity = intensity;
    scene.environmentRotation.set(0, rotationY, 0);
  }, [scene, intensity, rotationY]);

  return null;
};

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
const CameraRig: React.FC<{ cam: CameraState }> = ({ cam }) => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.fov = cam.fov;
    camera.aspect = 16 / 9;
    camera.near = 0.02;
    camera.far = 60;
    camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, cam]);
  return null;
};

const WHITE = new Color("#ffffff");
const WARM = new Color("#fff4e8");
const COOL = new Color("#dcdcff"); // faint lavender rim

export const StudioScene: React.FC<{
  background: BackgroundId;
  camera: CameraState;
  phones: PhoneState[];
  globalFrame: number;
}> = ({ background, camera, phones, globalFrame }) => {
  const L = LIGHTS[background];
  const g = globalFrame;
  const tau = Math.PI * 2;
  const envRot = L.envSwing * Math.sin((tau * g) / 420) + 0.6;
  const keyA = -0.75 + L.keySwing * Math.sin((tau * g) / 360 + 0.7);
  const keyPos: [number, number, number] = [Math.sin(keyA) * 6, 3.6, Math.cos(keyA) * 6];
  const rimA = 2.35 + 0.25 * Math.sin((tau * g) / 300);
  const rimPos: [number, number, number] = [Math.sin(rimA) * 5, 1.6, Math.cos(rimA) * 5];
  return (
    <>
      <StudioEnvironment intensity={L.env} rotationY={envRot} />
      <CameraRig cam={camera} />
      <Backdrop background={background} />
      <directionalLight position={keyPos} intensity={L.key} color={WARM} />
      <directionalLight position={rimPos} intensity={L.rim} color={COOL} />
      <directionalLight position={[-rimPos[0], 2.2, rimPos[2]]} intensity={L.rim * 0.6} color={WHITE} />
      {phones.map((p, i) => (
        <Phone key={i} state={p} />
      ))}
      {background === "white"
        ? phones.map((p, i) => <ContactShadow key={`s${i}`} phone={p} />)
        : null}
    </>
  );
};

