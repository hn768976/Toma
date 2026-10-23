import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DofRenderer } from "../gl/dof";
import { makeEnvironment, EnvSpec } from "../gl/env";
import { radianceForDisplayColor } from "../gl/aces";
import { mulberry32 } from "../gl/random";
import type { GlScene } from "../gl/GlCanvas";

export type GlassRingVariant = "match" | "alt";

export const RING_FRAMES = 400; // 13.333 s at 30 fps
const LOOP = 200; // the reference repeats exactly every 200 frames

type Palette = {
  background: string; // display (sRGB) colour of the flat backdrop
  glassTint: string;
  attenuation: string;
  inner: string;
  iridescenceRange: [number, number];
  env: EnvSpec;
};

const ORANGE: Palette = {
  background: "#bf7037",
  glassTint: "#ffeedd",
  attenuation: "#ff7a30",
  inner: "#9fe0cc",
  iridescenceRange: [180, 520],
  env: {
    top: [0.06, 0.03, 0.015],
    horizon: [0.9, 0.3, 0.06],
    bottom: [0.05, 0.02, 0.008],
    lights: [
      { dir: [0.5, 0.9, 0.5], size: 0.35, color: [6, 3.0, 1.0] },
      { dir: [-1, 0.25, 0.5], size: 0.6, color: [0.05, 1.5, 1.15] },
      { dir: [1, 0.0, 0.4], size: 0.45, color: [4.5, 1.4, 0.25] },
      { dir: [0.1, -0.5, -1], size: 0.45, color: [0.08, 0.6, 1.5] },
      { dir: [-0.4, -0.8, 0.6], size: 0.5, color: [2.4, 0.8, 0.15] },
      { dir: [0.3, 0.3, -1], size: 0.5, color: [0.1, 1.0, 0.75] },
    ],
  },
};

// Alternative palette: a cool midnight-indigo set with magenta/violet glass
// and cyan cores, the complementary inversion of the warm reference.
const INDIGO: Palette = {
  background: "#1e1d45",
  glassTint: "#d9b8ff",
  attenuation: "#b05cff",
  inner: "#21c7d9",
  iridescenceRange: [380, 800],
  env: {
    top: [0.08, 0.08, 0.28],
    horizon: [0.05, 0.05, 0.2],
    bottom: [0.02, 0.02, 0.08],
    lights: [
      { dir: [0.4, 1, 0.6], size: 0.45, color: [4.4, 3.6, 6.5] },
      { dir: [-1, 0.3, 0.4], size: 0.4, color: [3.2, 0.3, 2.6] },
      { dir: [1, -0.2, 0.2], size: 0.35, color: [0.3, 2.2, 3.4] },
      { dir: [0.1, -0.4, -1], size: 0.5, color: [2.4, 0.4, 3.6] },
    ],
  },
};

const CUBES = 8;
const USE_CORE = true;

export const createGlassRing =
  (variant: GlassRingVariant) =>
  async (canvas: HTMLCanvasElement, width: number, height: number): Promise<GlScene> => {
    const pal = variant === "match" ? ORANGE : INDIGO;
    const exposure = 1;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = radianceForDisplayColor(pal.background, exposure);
    const envTex = makeEnvironment(renderer, pal.env);
    scene.environment = envTex;

    const outerGeo = new RoundedBoxGeometry(1, 1, 1, 6, 0.17);
    const innerGeo = new RoundedBoxGeometry(0.5, 0.5, 0.5, 4, 0.06);
    const glass = new THREE.MeshPhysicalMaterial({
      color: pal.glassTint,
      metalness: 0,
      roughness: 0.04,
      transmission: 1,
      thickness: 0.9,
      ior: 1.52,
      attenuationColor: new THREE.Color(pal.attenuation),
      attenuationDistance: 1.5,
      iridescence: 1,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: pal.iridescenceRange,
      specularIntensity: 1,
      envMapIntensity: 1.2,
      dispersion: 0.4,
    });
    const core = new THREE.MeshPhysicalMaterial({
      color: pal.inner,
      metalness: 1,
      roughness: 0.08,
      iridescence: 1,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: pal.iridescenceRange,
      envMapIntensity: 1.1,
    });

    const ring = new THREE.Group();
    const spinner = new THREE.Group();
    spinner.add(ring);
    scene.add(spinner);
    const rnd = mulberry32(7);
    const RADIUS = 1.3;
    const cubes: {
      g: THREE.Group;
      axis: THREE.Vector3;
      turns: number;
      phase: number;
      base: THREE.Quaternion;
    }[] = [];
    for (let i = 0; i < CUBES; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(outerGeo, glass));
      if (USE_CORE) g.add(new THREE.Mesh(innerGeo, core));
      const a = (i / CUBES) * Math.PI * 2;
      const r = RADIUS * (0.92 + 0.16 * rnd());
      g.position.set(Math.cos(a) * r, Math.sin(a) * r, (rnd() - 0.5) * 0.5);
      g.scale.setScalar(1.0 + 0.1 * rnd());
      const axis = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      const base = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28),
      );
      cubes.push({ g, axis, turns: rnd() < 0.5 ? 1 : -1, phase: rnd() * 6.28, base });
      ring.add(g);
    }

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.3, 60);
    camera.position.set(0, 0, 6.2);
    camera.lookAt(0, 0, 0);
    // ring sits right of centre, as in the reference framing
    spinner.position.set(1.35, 0.25, 0);

    const dof = new DofRenderer(renderer, width, height);
    const tumbleAxis = new THREE.Vector3(0.75, 1, 0.55).normalize();
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();

    const renderFrame = (frame: number) => {
      const ph = ((frame % LOOP) / LOOP) * Math.PI * 2;
      // whole ring tumbles about a tilted axis (one turn per loop) while
      // spinning in its own plane by one cube spacing per loop
      qa.setFromAxisAngle(tumbleAxis, ph);
      qb.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.45 + 0.25 * Math.sin(ph));
      spinner.quaternion.copy(qa).multiply(qb);
      ring.rotation.z = (ph / CUBES) * 1;
      for (const c of cubes) {
        qa.setFromAxisAngle(c.axis, c.turns * ph + c.phase);
        c.g.quaternion.copy(c.base).premultiply(qa);
      }
      scene.updateMatrixWorld();
      const center = new THREE.Vector3();
      spinner.getWorldPosition(center);
      dof.render(
        scene,
        camera,
        {
          focusDistance: camera.position.distanceTo(center) - 0.9,
          aperture: 0.13,
          maxCoc: 0.022,
          exposure,
          vignette: 0,
          grain: 0.004,
        },
        frame,
      );
    };

    return {
      renderFrame,
      dispose: () => {
        dof.dispose();
        outerGeo.dispose();
        innerGeo.dispose();
        glass.dispose();
        core.dispose();
        envTex.dispose();
        renderer.dispose();
      },
    };
  };
