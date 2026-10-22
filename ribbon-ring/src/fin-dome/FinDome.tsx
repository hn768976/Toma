import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { z } from "zod";
import {
  BLADE_COUNT,
  BLADE_DEPTH,
  BLADE_SWEEP,
  BLADE_THICKNESS,
  DOME_HEIGHT,
  DOME_FLARE,
  DOME_RADIUS,
  DURATION_IN_FRAMES,
  HUB_RADIUS,
  LOOP_ROTATION,
} from "./constants";

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

const cameraPoseSchema = z.object({
  position: vec3,
  target: vec3,
  fov: z.number(),
  // Rotation around the view axis, in radians (positive = clockwise).
  roll: z.number(),
  // Distance from the camera to the plane of sharp focus.
  focus: z.number(),
});

export const finDomeSchema = z.object({
  // Blade surface colour, and the sheen tint picked up on blade edges.
  bladeColor: z.string(),
  sheenColor: z.string(),
  // Hemisphere light: sky (upper faces) and ground (lower faces) colours.
  skyLight: z.string(),
  groundLight: z.string(),
  // Backdrop colour and the light blooming out of the hub.
  backgroundColor: z.string(),
  // Tint the backdrop drifts to far from the glow (frame corners).
  cornerColor: z.string(),
  glowColor: z.string(),
  // Backdrop glow radius and lens-haze radius, in frame heights.
  glowRadius: z.number(),
  hazeRadius: z.number(),
  hazeStrength: z.number(),
  // Camera at the first and last frame; eased in between. Identical
  // poses = locked-off camera.
  cameraStart: cameraPoseSchema,
  cameraEnd: cameraPoseSchema,
  aperture: z.number(),
  maxBlur: z.number(),
});

export type FinDomeProps = z.infer<typeof finDomeSchema>;
export type CameraPose = z.infer<typeof cameraPoseSchema>;

const HUB: [number, number, number] = [0, DOME_HEIGHT, 0];

// Locked-off framing matched to the reference: low and close to the
// dome's rim, looking up the blades towards the glowing hub, which sits
// upper-right of centre.
export const REFERENCE_CAMERA: CameraPose = {
  position: [0.3, 1.8, 5],
  target: [-1.8, 1.5, 0],
  fov: 48,
  roll: 0,
  focus: 2.8,
};

export const finDomeDefaults: FinDomeProps = {
  bladeColor: "#8b4cf2",
  sheenColor: "#c9a6ff",
  skyLight: "#b9a0ff",
  groundLight: "#2b36d0",
  backgroundColor: "#3360d0",
  cornerColor: "#5a3fc8",
  glowColor: "#d8d0f4",
  glowRadius: 0.6,
  hazeRadius: 0.75,
  hazeStrength: 0.45,
  cameraStart: REFERENCE_CAMERA,
  cameraEnd: REFERENCE_CAMERA,
  aperture: 0.04,
  maxBlur: 0.03,
};

// Blade top-edge profile: falls away steeply from the hub and flattens
// towards the rim, like a flared tent rather than a hemisphere.
const domeTop = (r: number) =>
  DOME_HEIGHT * Math.pow(Math.max(0, 1 - r / DOME_RADIUS), DOME_FLARE);

// One blade: a thin plate whose top edge follows the dome profile, built
// flat in (radius, height) and then bent round the Y axis so it sweeps
// slightly in plan view. Rounded bevels give the soft highlight that
// runs along every blade edge in the reference.
const createBladeGeometry = () => {
  const steps = 64;
  const shape = new THREE.Shape();
  for (let i = 0; i <= steps; i++) {
    const r = HUB_RADIUS + (i / steps) * (DOME_RADIUS - HUB_RADIUS);
    if (i === 0) shape.moveTo(r, domeTop(r));
    else shape.lineTo(r, domeTop(r));
  }
  for (let i = steps; i >= 0; i--) {
    const r = HUB_RADIUS + (i / steps) * (DOME_RADIUS - HUB_RADIUS);
    shape.lineTo(r, domeTop(r) - BLADE_DEPTH);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: BLADE_THICKNESS,
    curveSegments: 1,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: BLADE_THICKNESS * 0.5,
    bevelSize: BLADE_THICKNESS * 0.45,
    bevelSegments: 4,
  });
  geometry.translate(0, 0, -BLADE_THICKNESS / 2);

  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = pos.getX(i);
    const angle = BLADE_SWEEP * r + pos.getZ(i) / Math.max(r, HUB_RADIUS);
    pos.setXYZ(i, r * Math.cos(angle), pos.getY(i), r * Math.sin(angle));
  }
  geometry.computeVertexNormals();
  return geometry;
};

// Screen-space backdrop: base colour with a soft round glow centred on
// wherever the hub projects to. Drawn as a full-screen quad at the far
// plane.
const createBackground = () => {
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      baseColor: { value: new THREE.Color() },
      cornerColor: { value: new THREE.Color() },
      glowColor: { value: new THREE.Color() },
      center: { value: new THREE.Vector2() },
      radius: { value: 0.5 },
      aspect: { value: 16 / 9 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 baseColor;
      uniform vec3 cornerColor;
      uniform vec3 glowColor;
      uniform vec2 center;
      uniform float radius;
      uniform float aspect;
      varying vec2 vUv;
      void main() {
        vec2 d = (vUv - center) * vec2(aspect, 1.0);
        float dist = length(d);
        float g = 1.0 - smoothstep(0.0, radius, dist);
        vec3 col = mix(baseColor, cornerColor, smoothstep(radius * 1.3, radius * 2.6, dist));
        gl_FragColor = vec4(mix(col, glowColor, g * g), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, material };
};

// Lens haze: after defocus, screen-blend a soft glow over everything
// around the hub, so the blades nearest the light wash out to lavender.
const HazeShader = {
  uniforms: {
    tDiffuse: { value: null },
    color: { value: new THREE.Color() },
    center: { value: new THREE.Vector2() },
    radius: { value: 0.5 },
    strength: { value: 0.5 },
    aspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 color;
    uniform vec2 center;
    uniform float radius;
    uniform float strength;
    uniform float aspect;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - center) * vec2(aspect, 1.0);
      float h = exp(-pow(length(d) / radius, 2.0) * 2.5) * strength;
      vec3 glow = color * h;
      gl_FragColor = vec4(1.0 - (1.0 - base.rgb) * (1.0 - glow), base.a);
    }
  `,
};

type SceneState = {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  bokeh: BokehPass;
  haze: ShaderPass;
  camera: THREE.PerspectiveCamera;
  dome: THREE.Group;
  bladeMaterial: THREE.MeshPhysicalMaterial;
  background: THREE.ShaderMaterial;
  hemi: THREE.HemisphereLight;
};

const buildScene = (canvas: HTMLCanvasElement, width: number, height: number): SceneState => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);

  const { mesh: bgMesh, material: background } = createBackground();
  scene.add(bgMesh);

  const bladeMaterial = new THREE.MeshPhysicalMaterial({
    roughness: 0.5,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.35,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
  });

  const geometry = createBladeGeometry();
  const dome = new THREE.Group();
  for (let i = 0; i < BLADE_COUNT; i++) {
    const blade = new THREE.Mesh(geometry, bladeMaterial);
    blade.rotation.y = (i / BLADE_COUNT) * Math.PI * 2;
    dome.add(blade);
  }
  scene.add(dome);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.3);
  scene.add(hemi);
  // The hub is the light source: a point light just above it rims every
  // blade's top edge, plus a soft white key from the camera side.
  const hubLight = new THREE.PointLight(0xf4ecff, 12, 0, 1.2);
  hubLight.position.set(HUB[0], HUB[1] + 0.6, HUB[2]);
  scene.add(hubLight);
  const key = new THREE.DirectionalLight(0xf2e8ff, 0.8);
  key.position.set(-8, 10, 14);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5c7cff, 1.0);
  fill.position.set(-12, -2, 6);
  scene.add(fill);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.01, maxblur: 0.01 });
  composer.addPass(bokeh);
  const haze = new ShaderPass(HazeShader);
  composer.addPass(haze);
  composer.addPass(new OutputPass());

  return { renderer, composer, bokeh, haze, camera, dome, bladeMaterial, background, hemi };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number) =>
  a.map((v, i) => lerp(v, b[i], t)) as [number, number, number];

// Abstract dome of thin violet blades radiating from a glowing hub and
// turning slowly around it, filmed close up with a very shallow depth of
// field. Real 3D geometry (Three.js / WebGL 2) so blade overlap, rim
// lighting and defocus all come out of one camera, like the reference.
export const FinDome: React.FC<FinDomeProps> = ({
  bladeColor,
  sheenColor,
  skyLight,
  groundLight,
  backgroundColor,
  cornerColor,
  glowColor,
  glowRadius,
  hazeRadius,
  hazeStrength,
  cameraStart,
  cameraEnd,
  aperture,
  maxBlur,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const state = buildScene(canvasRef.current, width, height);
    stateRef.current = state;
    return () => {
      state.composer.dispose();
      state.renderer.dispose();
      stateRef.current = null;
    };
  }, [width, height]);

  useLayoutEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    s.bladeMaterial.color.set(bladeColor);
    s.bladeMaterial.sheenColor.set(sheenColor);
    s.hemi.color.set(skyLight);
    s.hemi.groundColor.set(groundLight);

    // Constant angular speed: one blade spacing per loop.
    s.dome.rotation.y = (frame / DURATION_IN_FRAMES) * LOOP_ROTATION;

    const t = interpolate(frame, [0, DURATION_IN_FRAMES - 1], [0, 1], {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    s.camera.position.set(...lerp3(cameraStart.position, cameraEnd.position, t));
    s.camera.up.set(0, 1, 0);
    s.camera.lookAt(...lerp3(cameraStart.target, cameraEnd.target, t));
    s.camera.rotateZ(-lerp(cameraStart.roll, cameraEnd.roll, t));
    s.camera.fov = lerp(cameraStart.fov, cameraEnd.fov, t);
    s.camera.updateProjectionMatrix();
    s.camera.updateMatrixWorld();

    // Glow and haze follow the hub's on-screen position, so they stay
    // locked to it however the camera moves.
    const hub = new THREE.Vector3(...HUB).project(s.camera);
    const center = new THREE.Vector2(hub.x * 0.5 + 0.5, hub.y * 0.5 + 0.5);
    const aspect = width / height;

    const bg = s.background.uniforms;
    bg.baseColor.value.set(backgroundColor);
    bg.cornerColor.value.set(cornerColor);
    bg.glowColor.value.set(glowColor);
    bg.center.value.copy(center);
    bg.radius.value = glowRadius;
    bg.aspect.value = aspect;

    const hz = s.haze.uniforms;
    hz.color.value.set(glowColor);
    hz.center.value.copy(center);
    hz.radius.value = hazeRadius;
    hz.strength.value = hazeStrength;
    hz.aspect.value = aspect;

    const bokeh = s.bokeh.uniforms as Record<string, { value: number }>;
    bokeh.focus.value = lerp(cameraStart.focus, cameraEnd.focus, t);
    bokeh.aperture.value = aperture;
    bokeh.maxblur.value = maxBlur;

    s.composer.render();
  }, [
    frame,
    bladeColor,
    sheenColor,
    skyLight,
    groundLight,
    backgroundColor,
    cornerColor,
    glowColor,
    glowRadius,
    hazeRadius,
    hazeStrength,
    cameraStart,
    cameraEnd,
    aperture,
    maxBlur,
    width,
    height,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
