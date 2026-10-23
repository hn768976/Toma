import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { mulberry32 } from "../lib/random";

export type QuestionFieldScene = {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  glowMaterial: THREE.MeshBasicMaterial;
  haloMaterial: THREE.SpriteMaterial;
  poolMaterial: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  bokeh: BokehPass;
  bloom: UnrealBloomPass;
  grain: ShaderPass;
  dispose: () => void;
};

// Light/glow colour of the question mark (linear RGB, values > 1 feed bloom).
const GLOW = new THREE.Color(0.12, 0.72, 1.0);
export const QUESTION_LIGHT_Y = 0.78;

// Rounded, tapered bar of an exclamation mark (wide at the top).
const exclamationBar = () => {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0.3));
  pts.push(new THREE.Vector2(0.028, 0.305));
  pts.push(new THREE.Vector2(0.038, 0.33));
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const y = 0.33 + (1.36 - 0.33) * (i / steps);
    const r = 0.038 + (0.082 - 0.038) * (i / steps);
    pts.push(new THREE.Vector2(r, y));
  }
  // Rounded cap.
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new THREE.Vector2(0.082 * Math.cos(a), 1.36 + 0.07 * Math.sin(a)));
  }
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.computeVertexNormals();
  return geo;
};

// Glowing question mark: a tube swept along a hook-shaped curve plus a dot.
const questionMark = (material: THREE.Material) => {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(
    [
      [-0.36, 1.22],
      [-0.3, 1.43],
      [-0.12, 1.57],
      [0.1, 1.58],
      [0.3, 1.47],
      [0.36, 1.27],
      [0.27, 1.08],
      [0.08, 0.95],
      [0.0, 0.8],
      [0.0, 0.6],
      [0.0, 0.46],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false,
    "centripetal",
  );
  const r = 0.092;
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 200, r, 24, false),
    material,
  );
  group.add(tube);
  for (const t of [0, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), material);
    cap.position.copy(curve.getPoint(t));
    group.add(cap);
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.115, 32, 24), material);
  dot.position.set(0, 0.12, 0);
  group.add(dot);
  return group;
};

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSeed: { value: 0 },
    uVignette: { value: 0.65 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSeed;
    uniform float uVignette;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      d.x *= 1.35;
      float v = smoothstep(0.95, 0.25, length(d));
      c.rgb *= mix(1.0, v, uVignette);
      c.rgb += (hash(gl_FragCoord.xy) - 0.5) * 0.018;
      gl_FragColor = c;
    }`,
};

// Distance from point p to segment a-b on the floor plane.
const distToSegment = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

export const createQuestionFieldScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  // Floor positions the camera passes through; marks blocking the view from
  // any of them to the question mark are left out.
  cameraPath: [number, number][] = [],
): QuestionFieldScene => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  // Neutral tone mapping keeps the cyan glow saturated instead of bleaching it.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const bg = new THREE.Color("#040a17");
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 9, 26);

  // Longish lens: the floor fills the frame and the rows compress with depth.
  const camera = new THREE.PerspectiveCamera(26, width / height, 0.05, 120);

  // Floor.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      color: "#56708f",
      roughness: 0.58,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Exclamation mark field (instanced: bars + dots).
  const rand = mulberry32(20249);
  const marks: THREE.Matrix4[] = [];
  const spacingX = 1.95;
  const spacingZ = 1.85;
  for (let iz = -15; iz <= 8; iz++) {
    for (let ix = -10; ix <= 10; ix++) {
      const x = ix * spacingX + (iz % 2 === 0 ? 0 : spacingX / 2) + (rand() - 0.5) * 0.35;
      const z = iz * spacingZ + (rand() - 0.5) * 0.35;
      if (Math.hypot(x, z) < 1.2) continue;
      // Keep the V1 camera's line of sight to the question mark clear.
      if (z > 0 && Math.abs(x - z * 0.03) < 0.55 + z * 0.12) continue;
      // ...and keep the V2 orbit path free so no mark passes through the lens.
      const r = Math.hypot(x, z);
      const az = Math.atan2(x, z);
      if (r > 5.0 && r < 7.2 && az > -1.4 && az < 1.05) continue;
      if (cameraPath.some(([cx, cz]) => distToSegment(x, z, cx, cz, 0, 0) < 0.5)) continue;
      const m = new THREE.Matrix4();
      const s = 0.92 + rand() * 0.16;
      m.compose(
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0)),
        new THREE.Vector3(s, s, s),
      );
      marks.push(m);
    }
  }
  const markMaterial = new THREE.MeshStandardMaterial({
    color: "#c4d2e4",
    roughness: 0.55,
    metalness: 0.0,
  });
  const barGeo = exclamationBar();
  const dotGeo = new THREE.SphereGeometry(0.074, 24, 16);
  dotGeo.translate(0, 0.074, 0);
  const bars = new THREE.InstancedMesh(barGeo, markMaterial, marks.length);
  const dots = new THREE.InstancedMesh(dotGeo, markMaterial, marks.length);
  marks.forEach((m, i) => {
    bars.setMatrixAt(i, m);
    dots.setMatrixAt(i, m);
  });
  for (const mesh of [bars, dots]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  // Glowing question mark.
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: GLOW.clone(),
    toneMapped: false,
    fog: false,
  });
  scene.add(questionMark(glowMaterial));

  // Soft halo sprite around the question mark.
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 256;
  const hctx = haloCanvas.getContext("2d")!;
  const grad = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(120,210,255,0.3)");
  grad.addColorStop(0.35, "rgba(60,150,255,0.1)");
  grad.addColorStop(1, "rgba(30,90,200,0)");
  hctx.fillStyle = grad;
  hctx.fillRect(0, 0, 256, 256);
  const haloTexture = new THREE.CanvasTexture(haloCanvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  const haloMaterial = new THREE.SpriteMaterial({
    map: haloTexture,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const halo = new THREE.Sprite(haloMaterial);
  halo.position.set(0, 0.85, 0);
  halo.scale.set(3.2, 3.2, 1);
  scene.add(halo);

  // Hot reflection pool where the glowing dot meets the floor.
  const poolMaterial = new THREE.MeshBasicMaterial({
    map: haloTexture,
    color: new THREE.Color(0.6, 0.95, 1.0),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), poolMaterial);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.003, 0);
  scene.add(pool);

  // The question mark is the key light: everything casts shadows away from it.
  const light = new THREE.PointLight(GLOW.clone(), 9, 0, 1.25);
  light.position.set(0, QUESTION_LIGHT_Y, 0.02);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.002;
  light.shadow.radius = 4;
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 30;
  scene.add(light);

  scene.add(new THREE.HemisphereLight("#86a6d8", "#101c38", 2.3));
  const rim = new THREE.DirectionalLight("#5b8fe0", 0.35);
  rim.position.set(-4, 6, -10);
  scene.add(rim);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, {
    focus: 3,
    aperture: 0.0035,
    maxblur: 0.0065,
  });
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width / 2, height / 2),
    0.85,
    0.5,
    0.72,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grain = new ShaderPass(GrainShader);
  composer.addPass(grain);

  const dispose = () => {
    composer.dispose();
    renderer.dispose();
    haloTexture.dispose();
    barGeo.dispose();
    dotGeo.dispose();
  };

  return {
    renderer,
    composer,
    camera,
    glowMaterial,
    haloMaterial,
    poolMaterial,
    light,
    bokeh,
    bloom,
    grain,
    dispose,
  };
};

export { GLOW };
