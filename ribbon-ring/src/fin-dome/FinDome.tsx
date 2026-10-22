import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { z } from "zod";
import { DofPipeline } from "./dof";
import {
  DURATION_IN_FRAMES,
  FIN_COUNT,
  FIN_THICKNESS,
  LOOP_ROTATION,
  MAJOR_RADIUS,
  NEAR_ANGLE,
  TUBE_INNER_RADIUS,
  TUBE_RADIUS,
  VISIBLE_ARC,
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
  // Fin surface colour, and the sheen tint picked up on fin edges.
  bladeColor: z.string(),
  sheenColor: z.string(),
  // Hemisphere light: sky (upper faces) and ground (lower faces) colours.
  skyLight: z.string(),
  groundLight: z.string(),
  // Backdrop colour and the light blooming from behind the ring.
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

// Locked-off framing matched to the reference: just outside the near
// side of the ring and slightly rolled, looking along the fins as the
// ring sweeps up and away towards the glow at upper right.
export const REFERENCE_CAMERA: CameraPose = {
  position: [-2, 5, 41.5],
  target: [3, 0.5, 31],
  fov: 38,
  roll: 0.22,
  focus: 5,
};

export const finDomeDefaults: FinDomeProps = {
  bladeColor: "#b060e0",
  sheenColor: "#e0a8ff",
  skyLight: "#d0a8ff",
  groundLight: "#2236c0",
  backgroundColor: "#3360d0",
  cornerColor: "#5a3fc8",
  glowColor: "#d8d0f4",
  glowRadius: 0.6,
  hazeRadius: 0.7,
  hazeStrength: 0.3,
  cameraStart: REFERENCE_CAMERA,
  cameraEnd: REFERENCE_CAMERA,
  focusScale: 10,
  maxBlur: 0.035,
  // Behind the ring, where it projects to the reference's glow spot.
  lightPosition: [16.2, -2.8, 19],
};

// One fin = a thin washer (the tube's annular cross-section), extruded
// along the ring's tangent. Generous rounded bevels give the soft lit lip
// that runs along every fin edge in the reference.
const createFinGeometry = () => {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, TUBE_RADIUS, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, TUBE_INNER_RADIUS, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: FIN_THICKNESS * 0.2,
    curveSegments: 96,
    bevelEnabled: true,
    bevelThickness: FIN_THICKNESS * 0.4,
    bevelSize: FIN_THICKNESS * 0.4,
    bevelSegments: 5,
  });
  geometry.translate(0, 0, -FIN_THICKNESS * 0.1);
  geometry.computeVertexNormals();

  // Bake a radial shade into vertex colours: full colour at the fin's
  // outer lip, falling to a deep blue towards its inner edge, which gives
  // the reference's lit-lip / blue-shadow look on each fin face.
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lip = new THREE.Color(1, 1, 1);
  const core = new THREE.Color(0.22, 0.27, 0.9);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    const t = THREE.MathUtils.smoothstep(r, TUBE_INNER_RADIUS, TUBE_RADIUS);
    c.copy(core).lerp(lip, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
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
  ring: THREE.Group;
  fins: THREE.Mesh[];
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
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
  });

  const geometry = createFinGeometry();
  const ring = new THREE.Group();
  const fins: THREE.Mesh[] = [];
  for (let i = 0; i < FIN_COUNT; i++) {
    const theta = (i / FIN_COUNT) * Math.PI * 2;
    const fin = new THREE.Mesh(geometry, bladeMaterial);
    fin.position.set(MAJOR_RADIUS * Math.cos(theta), 0, MAJOR_RADIUS * Math.sin(theta));
    fin.rotation.y = -theta;
    ring.add(fin);
    fins.push(fin);
  }
  scene.add(ring);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.75);
  scene.add(hemi);
  // The glow is the light source: a point light at lightPosition, plus a
  // soft white key from the camera side.
  const glowLight = new THREE.PointLight(0xf4ecff, 40, 0, 1.0);
  scene.add(glowLight);
  // Rim light from above and behind the glow, aimed at the fins nearest
  // camera: lights the fin lips while their faces fall into blue shadow.
  const rimLight = new THREE.DirectionalLight(0xfff4ff, 4.5);
  rimLight.target.position.set(0, 0, MAJOR_RADIUS);
  scene.add(rimLight, rimLight.target);
  const key = new THREE.DirectionalLight(0xf2e8ff, 0.45);
  key.position.set(-8, 10, 14);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5c7cff, 1.0);
  fill.position.set(-12, -2, 6);
  scene.add(fill);

  const dof = new DofPipeline(width, height);

  return { renderer, scene, dof, camera, ring, fins, bladeMaterial, background, hemi, glowLight, rimLight };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number) =>
  a.map((v, i) => lerp(v, b[i], t)) as [number, number, number];

// Abstract ring of thick violet fins, standing like mushroom gills and
// turning slowly around the ring axis, filmed close up with a very shallow depth of
// field. Real 3D geometry (Three.js / WebGL 2) so fin overlap, rim
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

    // Constant angular speed: one fin spacing per loop.
    const spin = (frame / DURATION_IN_FRAMES) * LOOP_ROTATION;
    s.ring.rotation.y = spin;
    // Culling uses the spun angle, so frame 0 and the loop point cull
    // identical fins.
    s.fins.forEach((fin, i) => {
      const theta = (i / FIN_COUNT) * Math.PI * 2 - spin;
      const fromNear = Math.atan2(Math.sin(theta - NEAR_ANGLE), Math.cos(theta - NEAR_ANGLE));
      fin.visible = Math.abs(fromNear) < VISIBLE_ARC / 2;
    });

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
