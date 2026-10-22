import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { z } from "zod";
import { DofPipeline } from "./dof";
import {
  BLADE_COUNT,
  BLADE_DEPTH,
  BLADE_SWEEP,
  BLADE_THICKNESS,
  BOWL_FLARE,
  BOWL_HEIGHT,
  BOWL_RADIUS,
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
  // Backdrop colour and the light blooming from behind the far rim.
  backgroundColor: z.string(),
  // Tint the backdrop drifts to far from the glow (frame corners).
  cornerColor: z.string(),
  glowColor: z.string(),
  // Backdrop glow radius and lens-haze radius, in frame heights.
  glowRadius: z.number(),
  hazeRadius: z.number(),
  hazeStrength: z.number(),
  // Blades sink out of view as they rotate away from the camera's side
  // of the fan, opening the sky on the far side as in the reference.
  // visibleOffset turns the kept side relative to the camera's azimuth
  // (radians, around the spin axis); fadeWidth is how wide (in cos-space)
  // the sink transition is.
  visibleOffset: z.number(),
  fadeWidth: z.number(),
  // Camera at the first and last frame; eased in between. Identical
  // poses = locked-off camera.
  cameraStart: cameraPoseSchema,
  cameraEnd: cameraPoseSchema,
  // Depth of field: how fast blur grows away from the focus plane, and
  // the largest blur radius as a fraction of frame height.
  focusScale: z.number(),
  maxBlur: z.number(),
  // World-space point the light (and the backdrop glow/haze that track
  // it on screen) comes from.
  lightPosition: vec3,
});

export type FinDomeProps = z.infer<typeof finDomeSchema>;
export type CameraPose = z.infer<typeof cameraPoseSchema>;

// Locked-off framing matched to the reference: close over the near
// blades, slightly rolled, looking down their broad curved faces as they
// sweep up towards the glow (the hub sits just off the top of frame).
export const REFERENCE_CAMERA: CameraPose = {
  position: [-2.5, 2.6, 6.5],
  target: [-2.9, -2.3, 0],
  fov: 50,
  roll: 0.25,
  focus: 4,
};

export const finDomeDefaults: FinDomeProps = {
  bladeColor: "#9a56e8",
  sheenColor: "#e0a8ff",
  skyLight: "#b890ff",
  groundLight: "#5a40d8",
  backgroundColor: "#3360d0",
  cornerColor: "#5a3fc8",
  glowColor: "#d4caf2",
  glowRadius: 1.1,
  hazeRadius: 1.0,
  hazeStrength: 0.4,
  visibleOffset: -0.39,
  fadeWidth: 0.6,
  cameraStart: REFERENCE_CAMERA,
  cameraEnd: REFERENCE_CAMERA,
  focusScale: 8,
  maxBlur: 0.04,
  // Just behind and above the hub, so the glow blooms where the blades
  // converge.
  lightPosition: [0.5, 1.5, -2],
};

// How far a blade sinks once it has rotated fully into the hidden side.
const SINK_DEPTH = 9;

// Top edge: rises outward along the bowl profile, then curls down over
// the last quarter of the span in a quarter-ellipse, so blade ends read
// as rounded tips rather than square cuts.
const ROUND_START = BOWL_RADIUS * 0.72;
const bladeTop = (r: number) => {
  const bowl = BOWL_HEIGHT * Math.pow(Math.min(1, r / BOWL_RADIUS), BOWL_FLARE);
  if (r <= ROUND_START) return bowl;
  const u = Math.min(1, (r - ROUND_START) / (BOWL_RADIUS - ROUND_START));
  return bowl - BLADE_DEPTH * (1 - Math.sqrt(1 - u * u));
};

// One blade: a thin plate whose top edge follows the bowl profile, built
// flat in (radius, height) and then bent round the Y axis so it sweeps
// in plan view. Rounded bevels give the soft lit lip along every blade
// edge, and a baked vertex-colour gradient falls from full colour at the
// lip to deep blue lower down the face.
const createBladeGeometry = () => {
  const steps = 96;
  const shape = new THREE.Shape();
  for (let i = 0; i <= steps; i++) {
    const r = HUB_RADIUS + (i / steps) * (BOWL_RADIUS - HUB_RADIUS);
    if (i === 0) shape.moveTo(r, bladeTop(r));
    else shape.lineTo(r, bladeTop(r));
  }
  for (let i = steps; i >= 0; i--) {
    const r = HUB_RADIUS + (i / steps) * (BOWL_RADIUS - HUB_RADIUS);
    shape.lineTo(r, bladeTop(r) - BLADE_DEPTH);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: BLADE_THICKNESS * 0.2,
    curveSegments: 1,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: BLADE_THICKNESS * 0.4,
    bevelSize: BLADE_THICKNESS * 0.4,
    bevelSegments: 5,
  });
  geometry.translate(0, 0, -BLADE_THICKNESS * 0.1);

  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lip = new THREE.Color(1, 1, 1);
  const core = new THREE.Color(0.2, 0.26, 0.95);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const r = pos.getX(i);
    const below = bladeTop(r) - pos.getY(i);
    c.copy(lip).lerp(core, THREE.MathUtils.smoothstep(below, 0.05, 1.2));
    colors.set([c.r, c.g, c.b], i * 3);
    const angle = BLADE_SWEEP * r + pos.getZ(i) / Math.max(r, HUB_RADIUS);
    pos.setXYZ(i, r * Math.cos(angle), pos.getY(i), r * Math.sin(angle));
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
};

// Screen-space backdrop: base colour with a soft round glow centred on
// wherever the light projects to. Drawn as a full-screen quad at the far
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

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  dof: DofPipeline;
  camera: THREE.PerspectiveCamera;
  fan: THREE.Group;
  blades: THREE.Mesh[];
  bladeMaterial: THREE.MeshPhysicalMaterial;
  background: THREE.ShaderMaterial;
  hemi: THREE.HemisphereLight;
  glowLight: THREE.PointLight;
  rimLight: THREE.DirectionalLight;
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
    vertexColors: true,
    roughness: 0.5,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.35,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
  });

  const geometry = createBladeGeometry();
  const fan = new THREE.Group();
  const blades: THREE.Mesh[] = [];
  for (let i = 0; i < BLADE_COUNT; i++) {
    const blade = new THREE.Mesh(geometry, bladeMaterial);
    blade.rotation.y = (i / BLADE_COUNT) * Math.PI * 2;
    fan.add(blade);
    blades.push(blade);
  }
  scene.add(fan);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.75);
  scene.add(hemi);
  // The glow is the light source: a point light at lightPosition, plus a
  // soft white key from the camera side.
  const glowLight = new THREE.PointLight(0xf4ecff, 8, 0, 1.0);
  scene.add(glowLight);
  // Rim light from above and behind the glow: lights the blade lips
  // while their faces fall into blue shadow.
  const rimLight = new THREE.DirectionalLight(0xfff4ff, 3);
  rimLight.target.position.set(0, 0, 0);
  scene.add(rimLight, rimLight.target);
  const key = new THREE.DirectionalLight(0xf2e8ff, 1.3);
  key.position.set(-8, 10, 14);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5c7cff, 1.0);
  fill.position.set(-12, -2, 6);
  scene.add(fill);

  const dof = new DofPipeline(width, height);

  return { renderer, scene, dof, camera, fan, blades, bladeMaterial, background, hemi, glowLight, rimLight };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number) =>
  a.map((v, i) => lerp(v, b[i], t)) as [number, number, number];

// Abstract fan of curved violet blades rising out of a hub like gills,
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
  visibleOffset,
  fadeWidth,
  cameraStart,
  cameraEnd,
  focusScale,
  maxBlur,
  lightPosition,
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
      state.dof.dispose();
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
    const spin = (frame / DURATION_IN_FRAMES) * LOOP_ROTATION;
    s.fan.rotation.y = spin;
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

    const visibleAzimuth = Math.atan2(s.camera.position.z, s.camera.position.x) + visibleOffset;
    // A blade at rotation.y = a points its root along azimuth -a (azimuth
    // = atan2(z, x)); its mid-span sits a little further round because of
    // the sweep. Sinking depends only on that azimuth relative to the
    // camera's, so with a locked-off camera the loop stays seamless.
    s.blades.forEach((blade, i) => {
      const a = (i / BLADE_COUNT) * Math.PI * 2 + spin;
      const azimuth = -a + BLADE_SWEEP * BOWL_RADIUS * 0.5;
      const f = THREE.MathUtils.smoothstep(Math.cos(azimuth - visibleAzimuth), -fadeWidth, fadeWidth);
      blade.visible = f > 0.001;
      blade.position.y = -(1 - f) * SINK_DEPTH;
    });


    // Glow and haze follow the light's on-screen position, so they stay
    // locked to it however the camera moves.
    s.glowLight.position.set(...lightPosition);
    s.rimLight.position.set(lightPosition[0], lightPosition[1] + 18, lightPosition[2]);
    const light = new THREE.Vector3(...lightPosition).project(s.camera);
    const center = new THREE.Vector2(light.x * 0.5 + 0.5, light.y * 0.5 + 0.5);
    const aspect = width / height;

    const bg = s.background.uniforms;
    bg.baseColor.value.set(backgroundColor);
    bg.cornerColor.value.set(cornerColor);
    bg.glowColor.value.set(glowColor);
    bg.center.value.copy(center);
    bg.radius.value = glowRadius;
    bg.aspect.value = aspect;

    s.dof.render(s.renderer, s.scene, s.camera, {
      focus: lerp(cameraStart.focus, cameraEnd.focus, t),
      focusScale,
      maxBlur,
      hazeColor: new THREE.Color(glowColor),
      hazeCenter: center,
      hazeRadius,
      hazeStrength,
    });
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
    visibleOffset,
    fadeWidth,
    cameraStart,
    cameraEnd,
    focusScale,
    maxBlur,
    lightPosition,
    width,
    height,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
