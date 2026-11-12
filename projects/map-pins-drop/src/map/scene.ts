import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mulberry32 } from "../random";
import { mapFragmentShader, mapVertexShader } from "./mapShader";
import { MapPalette, srgbVec3 } from "./palette";
import { createPinDotGeometry, createPinGeometry, PIN_HEIGHT } from "./pinGeometry";

// ------------------------------------------------------------------ camera
// Measured from the reference with phase correlation: the camera trucks
// sideways (to the right) at a constant speed with a fixed ~45° pitch and no
// rotation – screen motion is ~18 % of the frame width per second at the
// centre of frame, with ground-plane parallax (top 12 : bottom 17).
const CAM_HEIGHT = 8.0;
const CAM_PITCH = THREE.MathUtils.degToRad(-45);
const CAM_FOV = 31;
const CAM_YAW = THREE.MathUtils.degToRad(-8);
const START = new THREE.Vector3(-14.0, CAM_HEIGHT, 21.0);
export const CLIP_SECONDS = 451 / 30;
// centre-of-frame ground width = 2·(h / sin pitch)·tan(hfov/2)
const centreWidth = (aspect: number) =>
  2 *
  (CAM_HEIGHT / Math.sin(-CAM_PITCH)) *
  Math.tan(THREE.MathUtils.degToRad(CAM_FOV / 2)) *
  aspect;
const SCREEN_SPEED = 0.182; // frame widths per second (measured)

let speedForAspect = SCREEN_SPEED * centreWidth(16 / 9);

export const poseCamera = (cam: THREE.PerspectiveCamera, t: number) => {
  // truck along the camera's right vector
  const rx = Math.cos(CAM_YAW);
  const rz = -Math.sin(CAM_YAW);
  cam.position.set(
    START.x + rx * speedForAspect * t,
    CAM_HEIGHT,
    START.z + rz * speedForAspect * t,
  );
  cam.rotation.order = "YXZ";
  cam.rotation.set(CAM_PITCH, CAM_YAW, 0);
  cam.updateMatrixWorld(true);
};
const setAspect = (aspect: number) => {
  speedForAspect = SCREEN_SPEED * centreWidth(aspect);
};

// --------------------------------------------------------------- pin plan
export type PinPlan = { x: number; z: number; t: number; size: number };

/**
 * Pins pop in over the whole clip with an accelerating rate (the reference
 * starts empty, gets its first pin at ~0.15 s and levels off at ~25–30 pins
 * on screen from ~8 s, as new pins balance the ones leaving frame). Each pin is placed
 * on the ground somewhere inside the camera view at its spawn time; ~30 %
 * spawn next to a previous pin to form the small clusters seen in the clip.
 */
export const planPins = (aspect: number): PinPlan[] => {
  setAspect(aspect);
  const rnd = mulberry32(84294);
  const cam = new THREE.PerspectiveCamera(CAM_FOV, aspect, 0.1, 500);
  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const pins: PinPlan[] = [];
  // first pin: lower-left at ~0.15 s (as in the reference)
  poseCamera(cam, 0.15);
  ray.setFromCamera(new THREE.Vector2(-0.62, -0.55), cam);
  ray.ray.intersectPlane(ground, hit);
  pins.push({ x: hit.x, z: hit.z, t: 0.15, size: 1 });

  let t = 0.75;
  while (t < CLIP_SECONDS - 0.4) {
    poseCamera(cam, t);
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      let x: number;
      let z: number;
      if (rnd() < 0.3 && pins.length > 3) {
        const base = pins[pins.length - 1 - Math.floor(rnd() * Math.min(8, pins.length))];
        const a = rnd() * Math.PI * 2;
        const r = 0.45 + rnd() * 0.6;
        x = base.x + Math.cos(a) * r;
        z = base.z + Math.sin(a) * r;
      } else {
        // biased towards the foreground (lower half), like the reference
        const ndc = new THREE.Vector2(rnd() * 1.9 - 0.95, Math.pow(rnd(), 1.12) * 1.7 - 0.9);
        ray.setFromCamera(ndc, cam);
        if (!ray.ray.intersectPlane(ground, hit)) continue;
        x = hit.x;
        z = hit.z;
      }
      // keep pins from overlapping each other
      const tooClose = pins.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 0.36 ** 2);
      if (tooClose) continue;
      // must be on screen at spawn time
      const v = new THREE.Vector3(x, 0.4, z).project(cam);
      if (Math.abs(v.x) > 0.97 || v.y < -0.95 || v.y > 0.92) continue;
      pins.push({ x, z, t, size: 0.92 + rnd() * 0.16 });
      placed = true;
    }
    // accelerating spawn rate: ~1.3 pins/s at start → ~8 pins/s from 8 s on
    const rate = 1.3 + 0.85 * Math.min(t, 8.0);
    t += (0.55 + rnd() * 0.9) / rate;
  }
  return pins;
};

// ----------------------------------------------------------- pin animation
// Pins grow upright in place from their ground anchor (tip): 0 → ~1.1 → 1
// over ~9 frames, then a tiny settling wobble – as in the reference.
const GROW_TIME = 0.32;
const DROP_TIME = 0.12; // ripple (V2) starts as the pin reaches full size

const backOut = (k: number) => {
  const c1 = 0.9; // ~6 % overshoot
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

export const pinPose = (age: number) => {
  if (age < 0) return { y: 0, sxz: 0, sy: 0, shadow: 0, visible: false };
  if (age < GROW_TIME) {
    const k = age / GROW_TIME;
    const s = Math.max(0.001, backOut(k));
    return { y: 0, sxz: s, sy: s, shadow: Math.min(1, k * 1.4), visible: true };
  }
  const b = age - GROW_TIME;
  const wobble = 0.015 * Math.exp(-b * 9) * Math.sin(b * 26);
  return { y: 0, sxz: 1 + wobble, sy: 1 - wobble, shadow: 1, visible: true };
};

// ------------------------------------------------------------ scene build
const shadowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const shadowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r = dot(c, c);
  float a = exp(-r * 3.2) * (1.0 - smoothstep(0.75, 1.0, r));
  gl_FragColor = vec4(uColor, a * uOpacity);
}
`;
const rippleFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  float w = fwidth(r) * 1.5 + 0.035;
  float ring = smoothstep(uRadius - w, uRadius, r) * (1.0 - smoothstep(uRadius, uRadius + w, r));
  float fill = (1.0 - smoothstep(0.0, uRadius, r)) * 0.18;
  gl_FragColor = vec4(uColor, (ring + fill) * uOpacity);
}
`;

type PinNode = {
  plan: PinPlan;
  pin: THREE.Mesh;
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  ripple: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
};

export type MapScene = {
  render: (t: number) => void;
  dispose: () => void;
};

export const createMapScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  palette: MapPalette,
): MapScene => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(new THREE.Color(palette.fog), 1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(CAM_FOV, width / height, 0.1, 400);

  // ---- ground (procedural map shader)
  const groundUniforms = {
    uLand: { value: srgbVec3(palette.land) },
    uBlock: { value: srgbVec3(palette.block) },
    uSand: { value: srgbVec3(palette.sand) },
    uMinor: { value: srgbVec3(palette.minor) },
    uMajorEdge: { value: srgbVec3(palette.majorEdge) },
    uMajorCore: { value: srgbVec3(palette.majorCore) },
    uHighway: { value: srgbVec3(palette.highway) },
    uWater: { value: srgbVec3(palette.water) },
    uWaterEdge: { value: srgbVec3(palette.waterEdge) },
    uPark: { value: srgbVec3(palette.park) },
    uParkDark: { value: srgbVec3(palette.parkDark) },
    uParkPath: { value: srgbVec3(palette.parkPath) },
    uFog: { value: srgbVec3(palette.fog) },
    uGlow: { value: palette.glow },
    uCamPos: { value: new THREE.Vector3() },
    uFogNear: { value: 12 },
    uFogFar: { value: 40 },
  };
  const groundMat = new THREE.ShaderMaterial({
    uniforms: groundUniforms,
    vertexShader: mapVertexShader,
    fragmentShader: mapFragmentShader,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ---- lights
  scene.add(
    new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity),
  );
  const key = new THREE.DirectionalLight(0xffffff, palette.keyIntensity);
  key.position.set(-4, 10, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, palette.keyIntensity * 0.35);
  rim.position.set(6, 5, -8);
  scene.add(rim);

  // ---- pins
  const pinGeo = createPinGeometry();
  const pinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.pin),
    roughness: palette.pinRoughness,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
    emissive: new THREE.Color(palette.pinEmissive),
    emissiveIntensity: palette.pinEmissiveIntensity,
    envMapIntensity: palette.envIntensity,
  });
  const dotGeo = createPinDotGeometry();
  const dotMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.pinDot),
    roughness: 0.4,
    emissive: new THREE.Color(palette.pinDot),
    emissiveIntensity: palette.pinDotGlow,
  });
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  shadowGeo.rotateX(-Math.PI / 2);

  const plans = planPins(width / height);
  const nodes: PinNode[] = plans.map((plan) => {
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(plan.x, 0, plan.z);
    pin.visible = false;
    pin.add(new THREE.Mesh(dotGeo, dotMat));
    scene.add(pin);

    const shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(palette.shadowColor) },
          uOpacity: { value: 0 },
        },
        vertexShader: shadowVertex,
        fragmentShader: shadowFragment,
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.position.set(plan.x + 0.1, 0.003, plan.z + 0.06);
    shadow.scale.set(0.62 * plan.size, 1, 0.42 * plan.size);
    shadow.renderOrder = 1;
    scene.add(shadow);

    let ripple: PinNode["ripple"] = null;
    if (palette.rippleOpacity > 0) {
      ripple = new THREE.Mesh(
        shadowGeo,
        new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color(palette.ripple) },
            uOpacity: { value: 0 },
            uRadius: { value: 0 },
          },
          vertexShader: shadowVertex,
          fragmentShader: rippleFragment,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ripple.position.set(plan.x, 0.004, plan.z);
      ripple.scale.set(1.5, 1, 1.5);
      ripple.renderOrder = 2;
      ripple.visible = false;
      scene.add(ripple);
    }
    return { plan, pin, shadow, ripple };
  });

  const render = (t: number) => {
    poseCamera(camera, t);
    groundUniforms.uCamPos.value.copy(camera.position);

    for (const n of nodes) {
      const age = t - n.plan.t;
      const pose = pinPose(age);
      n.pin.visible = pose.visible;
      n.shadow.visible = pose.visible;
      if (!pose.visible) {
        if (n.ripple) n.ripple.visible = false;
        continue;
      }
      // pins always turn to face the camera (billboard around the vertical axis)
      const yaw = Math.atan2(
        camera.position.x - n.plan.x,
        camera.position.z - n.plan.z,
      );
      n.pin.rotation.set(0, yaw, 0);
      n.pin.position.y = pose.y;
      const s = n.plan.size;
      n.pin.scale.set(pose.sxz * s, pose.sy * s, pose.sxz * s);
      n.shadow.material.uniforms.uOpacity.value =
        palette.shadowOpacity * pose.shadow * Math.min(1, pose.sxz);

      if (n.ripple) {
        const ra = age - DROP_TIME;
        const life = 1.1;
        if (ra > 0 && ra < life) {
          const k = ra / life;
          n.ripple.visible = true;
          n.ripple.material.uniforms.uRadius.value = 0.12 + 0.82 * (1 - (1 - k) ** 3);
          n.ripple.material.uniforms.uOpacity.value =
            palette.rippleOpacity * (1 - k) ** 1.5;
        } else {
          n.ripple.visible = false;
        }
      }
    }
    renderer.render(scene, camera);
  };

  const dispose = () => {
    pinGeo.dispose();
    dotGeo.dispose();
    dotMat.dispose();
    pinMat.dispose();
    shadowGeo.dispose();
    groundMat.dispose();
    envTex.dispose();
    pmrem.dispose();
    nodes.forEach((n) => {
      n.shadow.material.dispose();
      n.ripple?.material.dispose();
    });
    renderer.dispose();
  };

  return { render, dispose };
};

export { PIN_HEIGHT };
