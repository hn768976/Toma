import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { makeGround } from "./ground";
import { makeCar, makeTruck, Shape, Vehicle } from "./vehicles";

export type Variant = "v1" | "v2";

export const FPS = 30;
export const DURATION_FRAMES = 180;

/** Road speed in metres / frame. 180 frames * 0.2 = 36 m = 6 dash periods → seamless. */
const SCROLL_PER_FRAME = 0.2;

const EGO = new THREE.Vector3(0, 0, 0);
const CAR_POS = new THREE.Vector3(-3.3, 0, -7.4);
const TRUCK_POS = new THREE.Vector3(2.55, 0, -7.6);
const LIDAR = new THREE.Vector3(0, 1.72, 0.35);

const C = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

const palette = {
  wire: C(0.62, 0.82, 1.0),
  detail: C(0.4, 0.66, 1.0),
  fill: C(0.22, 0.45, 0.9),
  accent: C(0.8, 0.92, 1.0),
  box: C(0.55, 1.0, 0.45),
  tail: C(1.0, 0.16, 0.12),
  cone: C(0.75, 0.9, 1.0),
  grid: C(0.3, 0.55, 1.0),
  lane: C(0.6, 0.85, 1.0),
  ring: C(0.45, 0.9, 1.0),
  sweep: C(0.02, 0.33, 0.52),
};

type Ctx = {
  width: number;
  height: number;
  lineMaterials: LineMaterial[];
};

const lines = (
  ctx: Ctx,
  positions: number[],
  color: THREE.Color,
  linewidth: number,
  opacity: number,
  colors?: number[],
) => {
  const geo = new LineSegmentsGeometry();
  geo.setPositions(positions);
  if (colors) {
    geo.setColors(colors);
  }
  const mat = new LineMaterial({
    color: colors ? 0xffffff : color,
    vertexColors: Boolean(colors),
    // widths are authored for a 2160p frame and scale with the canvas
    linewidth: (linewidth * ctx.height) / 2160,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  mat.resolution.set(ctx.width, ctx.height);
  ctx.lineMaterials.push(mat);
  const obj = new LineSegments2(geo, mat);
  obj.frustumCulled = false;
  return obj;
};

const fill = (shape: Shape, color: THREE.Color, opacity: number) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(shape.tris, 3));
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
};

const boxSegments = (sx: number, sy: number, sz: number) => {
  const x = sx / 2;
  const z = sz / 2;
  const out: number[] = [];
  for (const y of [0, sy]) {
    out.push(-x, y, -z, x, y, -z, x, y, -z, x, y, z, x, y, z, -x, y, z, -x, y, z, -x, y, -z);
  }
  for (const a of [-x, x]) {
    for (const b of [-z, z]) {
      out.push(a, 0, b, a, sy, b);
    }
  }
  return out;
};

/** A vehicle group; `k` scales brightness (used for the floor reflection). */
const vehicleGroup = (ctx: Ctx, v: Vehicle, k: number, withBox: boolean) => {
  const g = new THREE.Group();
  const mirror = k < 1;
  // the floor reflection is mostly wire, with only a hint of fill
  g.add(fill(v.body, palette.fill, (mirror ? 0.012 : 0.038)));
  g.add(fill(v.detail, palette.fill, (mirror ? 0.004 : 0.016)));
  g.add(lines(ctx, v.body.wire, palette.wire, 1.5, 0.3 * k));
  g.add(lines(ctx, v.detail.wire, palette.detail, 1.3, 0.22 * k));
  if (v.accent.tris.length && !mirror) {
    g.add(fill(v.accent, palette.accent, 0.3 * k));
    g.add(lines(ctx, v.accent.wire, palette.accent, 1.6, 0.8 * k));
  }
  g.add(lines(ctx, v.tail, palette.tail, 7, 1.0 * k));
  if (withBox) {
    g.add(lines(ctx, boxSegments(...v.size), palette.box, 3, 0.85 * k));
  }
  return g;
};

const withReflection = (
  ctx: Ctx,
  v: Vehicle,
  pos: THREE.Vector3,
  withBox: boolean,
  scale = 1,
) => {
  const root = new THREE.Group();
  const main = vehicleGroup(ctx, v, 1, withBox);
  const mirror = vehicleGroup(ctx, v, 0.4, withBox);
  mirror.scale.y = -1;
  root.add(mirror, main);
  root.position.copy(pos);
  root.scale.setScalar(scale);
  return root;
};

/**
 * Sensor "sound cone": rings travelling from the lidar toward a target,
 * growing as they go. Rebuilt per frame (cheap) so the motion is a pure
 * function of time.
 */
const coneSegments = (time: number, from: THREE.Vector3, to: THREE.Vector3) => {
  const pos: number[] = [];
  const col: number[] = [];
  const axis = to.clone().sub(from);
  const len = axis.length();
  axis.normalize();
  const side = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(side, axis).normalize();
  const RINGS = 18;
  const N = 40;
  for (let i = 0; i < RINGS; i++) {
    const ph = (i + ((time * 1.5) % 1)) / RINGS;
    const d = 0.5 + ph * (len - 0.5);
    const r = 0.12 + ph * 1.7;
    const a = Math.sin(Math.min(1, ph * 6) * Math.PI * 0.5) * (1 - Math.pow(ph, 3)) * 0.6;
    const centre = from.clone().addScaledVector(axis, d);
    for (let j = 0; j < N; j++) {
      for (const jj of [j, j + 1]) {
        // partial arcs (upper ~250 degrees) rather than closed hoops
        const t = -0.6 + (jj / N) * (Math.PI + 1.2);
        const p = centre
          .clone()
          .addScaledVector(side, Math.cos(t) * r)
          .addScaledVector(up, Math.sin(t) * r * 0.75);
        pos.push(p.x, Math.max(0.02, p.y), p.z);
        col.push(palette.cone.r * a, palette.cone.g * a, palette.cone.b * a);
      }
    }
  }
  return { pos, col };
};

const cameraFor = (variant: Variant, frame: number, aspect: number) => {
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 800);
  if (variant === "v1") {
    // Locked-off elevated chase view, matched to the reference framing.
    // A barely perceptible hand-held style drift keeps it from feeling frozen.
    const ph = (frame / DURATION_FRAMES) * Math.PI * 2;
    cam.position.set(-2.1 + 0.07 * Math.sin(ph), 4.7 + 0.03 * Math.sin(ph * 2 + 1), 9.2);
    const dir = new THREE.Vector3(0.142 + 0.003 * Math.sin(ph + 0.8), -0.272, -0.952);
    cam.lookAt(cam.position.clone().addScaledVector(dir, 20));
  } else {
    // Alternative: low three-quarter orbit that swings around the ego car
    // while slowly craning up and pushing in.
    const t = frame / (DURATION_FRAMES - 1);
    const e = t * t * (3 - 2 * t);
    const az = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(66, 30, e));
    const radius = THREE.MathUtils.lerp(13.5, 11.0, e);
    const h = THREE.MathUtils.lerp(1.9, 3.1, e);
    cam.fov = 46;
    cam.position.set(Math.sin(az) * radius, h, Math.cos(az) * radius + 0.5);
    cam.lookAt(0, 0.9, -3.6);
  }
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
};

export const buildScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  variant: Variant,
) => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.NoToneMapping;

  const ctx: Ctx = { width, height, lineMaterials: [] };
  const scene = new THREE.Scene();
  const ground = makeGround(palette);
  scene.add(ground.mesh);

  const ego = makeCar("suv");
  const sedan = makeCar("sedan");
  const truck = makeTruck();
  scene.add(withReflection(ctx, ego, EGO, false));
  scene.add(withReflection(ctx, sedan, CAR_POS, true, 1.12));
  scene.add(withReflection(ctx, truck, TRUCK_POS, true, 1.28));

  // the sensor fan opens toward the gap between the two tracked vehicles
  const coneTarget = new THREE.Vector3(-1.0, 1.5, -7.0);
  const first = coneSegments(0, LIDAR, coneTarget);
  const cone = lines(ctx, first.pos, palette.cone, 3.6, 1, first.col);
  scene.add(cone);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  const renderPass = new RenderPass(scene, cameraFor(variant, 0, width / height));
  composer.addPass(renderPass);
  // bloom is computed at half resolution – plenty for a soft glow
  const bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.18, 0.4, 0.45);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const render = (frame: number) => {
    const time = frame / FPS;
    ground.material.uniforms.uTime.value = time;
    ground.material.uniforms.uScroll.value = frame * SCROLL_PER_FRAME;
    const seg = coneSegments(time, LIDAR, coneTarget);
    (cone.geometry as LineSegmentsGeometry).setPositions(seg.pos);
    (cone.geometry as LineSegmentsGeometry).setColors(seg.col);
    renderPass.camera = cameraFor(variant, frame, width / height);
    composer.render();
    renderer.getContext().finish();
  };

  const dispose = () => {
    composer.dispose();
    renderer.dispose();
  };

  return { render, dispose };
};
