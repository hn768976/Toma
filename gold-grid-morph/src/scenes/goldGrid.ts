import * as THREE from "three";
import { DofRenderer, DofSettings } from "../gl/dof";
import { makeEnvironment, EnvSpec } from "../gl/env";
import { MorphCube } from "../gl/morphCube";
import type { GlScene } from "../gl/GlCanvas";

export type GoldGridVariant = "match" | "alt";

type Look = {
  metal: string;
  baseMetal: string;
  roughness: number;
  env: EnvSpec;
  exposure: number;
};

// Warm gold studio: a hot amber overhead bank, a bright key on the right and
// deep brown everywhere else, which gives the black-to-yellow contrast of the
// reference macro shot.
const GOLD: Look = {
  metal: "#ffb244",
  baseMetal: "#2e1404",
  roughness: 0.13,
  exposure: 0.8,
  env: {
    top: [0.14, 0.05, 0.007],
    horizon: [0.45, 0.15, 0.015],
    bottom: [0.0, 0.0, 0.0],
    lights: [
      { dir: [1, 0.35, 0.5], size: 0.5, color: [5, 2.5, 0.4] },
      { dir: [-1, 0.25, 0.4], size: 0.45, color: [3.6, 1.7, 0.25] },
      { dir: [0.2, 0.1, 1], size: 0.4, color: [4.4, 2.1, 0.32] },
      { dir: [-0.3, 0.2, -1], size: 0.45, color: [3.0, 1.4, 0.2] },
      { dir: [0.4, 0.85, 0.3], size: 0.1, color: [8, 3.8, 0.9] },
      { dir: [0.25, 0.7, -0.7], size: 0.42, color: [2.2, 1.0, 0.14], softness: 0.6 },
      { dir: [-0.7, 0.6, 0.1], size: 0.3, color: [1.8, 0.8, 0.1], softness: 0.6 },
      // a scatter of small hot lights gives each stud busier reflections
      ...Array.from({ length: 18 }, (_, i) => {
        const a = i * 2.39996;
        const el = 0.15 + ((i * 0.37) % 1) * 1.2;
        return {
          dir: [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)] as [number, number, number],
          size: 0.05 + ((i * 0.61) % 1) * 0.07,
          color: [4.5, 2.2, 0.4] as [number, number, number],
          softness: 0.5,
        };
      }),
    ],
  },
};

export const GRID_FRAMES = 360;

// 0 -> 1 -> 0 over the clip: the reference is a palindrome (cubes -> spheres
// at the midpoint -> cubes), so the morph and the camera retrace their path.
const pingPong = (frame: number) => {
  const t = frame / (GRID_FRAMES / 2);
  return t <= 1 ? t : 2 - t;
};

const smooth = (t: number) => t * t * (3 - 2 * t);

export type Tweak = Partial<Record<"az" | "el" | "roll" | "dist" | "ap", number>>;

export const createGoldGrid =
  (variant: GoldGridVariant, tw: Tweak = {}) =>
  async (canvas: HTMLCanvasElement, width: number, height: number): Promise<GlScene> => {
    const look = GOLD;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const envTex = makeEnvironment(renderer, look.env);
    scene.environment = envTex;
    scene.background = new THREE.Color(0x000000);

    // Grid of studs laid on a gently bent sheet (cylinder of radius R about z)
    const COLS = 96;
    const ROWS = 96;
    const PITCH = 1;
    // sheet bend radius; the sliding alt camera wants a flatter, wider sheet
    const R = variant === "match" ? 90 : 400;
    const morph = new MorphCube(11);
    const studMat = new THREE.MeshStandardMaterial({
      color: look.metal,
      metalness: 1,
      roughness: look.roughness,
      envMapIntensity: 1,
    });
    const studs = new THREE.InstancedMesh(morph.geometry, studMat, COLS * ROWS);
    studs.frustumCulled = false;
    scene.add(studs);

    const baseGeo = new THREE.CylinderGeometry(
      R,
      R,
      ROWS * PITCH + 4,
      256,
      1,
      true,
      -((COLS * PITCH + 4) / R) / 2,
      (COLS * PITCH + 4) / R,
    );
    const baseMat = new THREE.MeshStandardMaterial({
      color: look.baseMetal,
      metalness: 1,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    // cylinder axis along z, surface top at y = 0
    base.rotation.x = -Math.PI / 2;
    base.position.y = -R;
    scene.add(base);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.3, 200);
    const dof = new DofRenderer(renderer, width, height);
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const zAxis = new THREE.Vector3(0, 0, 1);

    const ndc = new THREE.Vector3();
    const order: { d: number; m: THREE.Matrix4 }[] = [];
    for (let i = 0; i < COLS * ROWS; i++) order.push({ d: 0, m: new THREE.Matrix4() });

    // Lays out the studs for this frame, keeping only those inside the view
    // and drawing them front-to-back so the depth test rejects hidden pixels.
    const layout = (roundness: number) => {
      // studs grow slightly as they round off so spheres nearly touch
      const size = THREE.MathUtils.lerp(0.8, 0.93, roundness) * PITCH;
      // crisp cubes read as taller cells, spheres stay round
      const tall = THREE.MathUtils.lerp(1.3, 1, Math.min(1, roundness * 1.6));
      let n = 0;
      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const x = (i - (COLS - 1) / 2) * PITCH;
          const z = (j - (ROWS - 1) / 2) * PITCH;
          const theta = x / R;
          const lift = (size * tall) / 2;
          p.set(Math.sin(theta) * (R + lift), Math.cos(theta) * (R + lift) - R, z);
          ndc.copy(p).project(camera);
          if (ndc.z > 1 || Math.abs(ndc.x) > 1.25 || Math.abs(ndc.y) > 1.35) continue;
          q.setFromAxisAngle(zAxis, -theta);
          s.set(size, size * tall, size);
          const o = order[n++];
          o.m.compose(p, q, s);
          o.d = p.distanceToSquared(camera.position);
        }
      }
      const vis = order.slice(0, n).sort((u, v) => u.d - v.d);
      vis.forEach((o, k) => studs.setMatrixAt(k, o.m));
      studs.count = n;
      studs.instanceMatrix.needsUpdate = true;
    };

    const target = new THREE.Vector3();
    const renderFrame = (frame: number) => {
      const t = pingPong(frame);
      // front-loaded: studs are soft cushions by ~1.5 s and near domes by 3 s
      const roundness = 0.05 + 0.95 * (1 - (1 - t) * (1 - t));
      morph.setRoundness(roundness);

      let dofs: DofSettings;
      if (variant === "match") {
        // oblique macro view with a slight drift that retraces itself
        const e = smooth(t);
        const az = (tw.az ?? 0.12) + 0.04 * e;
        const el = (tw.el ?? 1.2) - 0.04 * e;
        const dist = (tw.dist ?? 10.5) - 0.8 * e;
        target.set(0.5 * e, 0.3, 0);
        camera.position.set(
          target.x - Math.cos(el) * Math.sin(az) * dist,
          target.y + Math.sin(el) * dist,
          target.z + Math.cos(el) * Math.cos(az) * dist,
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(target);
        camera.rotateZ(tw.roll ?? -1.67);
        dofs = {
          focusDistance: camera.position.distanceTo(target),
          aperture: tw.ap ?? 0.065,
          maxCoc: 0.032,
          exposure: look.exposure,
          vignette: 0.35,
          grain: 0.006,
        };
      } else {
        // Alternative camera: one continuous macro-slider move instead of
        // the reference's near-static drift. The camera starts low and
        // grazing, glides sideways across the studs while craning up and
        // swinging round the surface normal; focus rides on the target so
        // the sharp band sweeps through the grid as it morphs.
        const u = frame / (GRID_FRAMES - 1);
        const e = u * u * (3 - 2 * u);
        const az = -0.55 + 1.2 * e;
        const el = 0.92 + 0.36 * e;
        const dist = 7 + 2 * e;
        target.set(-5 + 10 * e, 0.4, 3 - 6 * e);
        camera.position.set(
          target.x - Math.cos(el) * Math.sin(az) * dist,
          target.y + Math.sin(el) * dist,
          target.z + Math.cos(el) * Math.cos(az) * dist,
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(target);
        camera.rotateZ(-1.67 + 0.35 * e);
        dofs = {
          focusDistance: camera.position.distanceTo(target),
          aperture: 0.065,
          maxCoc: 0.028,
          exposure: look.exposure,
          vignette: 0.35,
          grain: 0.006,
        };
      }
      camera.updateMatrixWorld();
      layout(roundness);
      dof.render(scene, camera, dofs, frame);
    };

    return {
      renderFrame,
      dispose: () => {
        dof.dispose();
        morph.dispose();
        studMat.dispose();
        baseGeo.dispose();
        baseMat.dispose();
        envTex.dispose();
        renderer.dispose();
      },
    };
  };
