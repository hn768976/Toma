import * as THREE from "three";
import { PLATE_VARIANTS } from "../kit/circuit";
import { BundleSpec, buildFibreKit, FibrePalette, padsOf, PlateSpec } from "../kit/fibreKit";
import { LookInstance } from "../kit/post";
import { LOOP, mulberry32 } from "../kit/random";

// Three layers of floating plates: a dim upper board, a tilted band through
// the middle, and a far lower band in the haze. Bundles rise from the middle
// band into the upper board and hang from the middle band down into the
// haze, fanning out. Layout is periodic sideways (period PX); the camera
// glides exactly one period per loop.

const PX = 10;

type Seed = {
  layer: number;
  x: number;
  z: number;
  y: number;
  yaw: number;
  tilt: number;
  variant: number;
  size: number;
};

const LAYERS = [
  { y: 2.3, n: 3, z0: -4.0, zr: 4.0, size: 3.4, tilt: 0.05 }, // upper board
  { y: 0.2, n: 4, z0: -4.6, zr: 3.0, size: 2.5, tilt: 0.14 }, // middle band
  { y: -3.3, n: 3, z0: -11.5, zr: 2.5, size: 2.4, tilt: 0.08 }, // far lower band
];

const PERIOD_PLATES: Seed[] = (() => {
  const rng = mulberry32(6062);
  const out: Seed[] = [];
  LAYERS.forEach((L, layer) => {
    for (let i = 0; i < L.n; i++) {
      out.push({
        layer,
        x: ((i + 0.5) / L.n) * PX + (rng() - 0.5) * 0.8,
        z: L.z0 - rng() * L.zr,
        y: L.y + (rng() - 0.5) * 0.35,
        yaw: (rng() - 0.5) * 0.35,
        tilt: (rng() - 0.5) * 2 * L.tilt,
        variant: Math.floor(rng() * PLATE_VARIANTS.length),
        size: L.size * (0.9 + rng() * 0.25),
      });
    }
  });
  return out;
})();

const buildLayout = () => {
  const plates: (PlateSpec & { layer: number; idx: number })[] = [];
  for (let p = -2; p <= 3; p++) {
    PERIOD_PLATES.forEach((s, idx) => {
      const m = new THREE.Matrix4()
        .makeTranslation(s.x + p * PX, s.y, s.z)
        .multiply(new THREE.Matrix4().makeRotationY(s.yaw))
        .multiply(new THREE.Matrix4().makeRotationX(s.tilt));
      plates.push({ variant: s.variant, size: s.size, matrix: m, layer: s.layer, idx });
    });
  }
  const tops = plates.filter((q) => q.layer === 0);
  const bundles: BundleSpec[] = [];
  plates.forEach((pl) => {
    // Choices depend only on the plate's index in the period, so the
    // layout repeats exactly every PX.
    const rng = mulberry32(8100 + pl.idx);
    const under = padsOf(pl, -1);
    const order = under.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (pl.layer === 1) {
      // Up into the upper board: from a top pad here to the nearest pad
      // on an upper board's underside.
      const up = padsOf(pl, 1);
      const a = up[order[0] % up.length];
      let best: { pos: THREE.Vector3; r: number } | null = null;
      let bd = Infinity;
      tops.forEach((q) =>
        padsOf(q, -1).forEach((tp) => {
          const d = Math.hypot(tp.pos.x - a.pos.x, tp.pos.z - a.pos.z);
          if (d < bd) {
            bd = d;
            best = tp;
          }
        }),
      );
      if (best && bd < 2.2) {
        const b = best as { pos: THREE.Vector3; r: number };
        bundles.push({
          from: b.pos,
          to: a.pos,
          padR: b.r,
          toR: a.r * 1.2,
          count: 20 + Math.floor(rng() * 6),
          seed: pl.idx * 10,
          hang: false,
          width: 0.016,
          trunk: 2.2,
        });
      }
      // Down into the haze, fanning out.
      order.slice(1, 3).forEach((pi, k) => {
        const from = under[pi];
        bundles.push({
          from: from.pos,
          to: from.pos.clone().add(new THREE.Vector3((rng() - 0.5) * 0.8, -3.6, (rng() - 0.5) * 0.8)),
          padR: from.r,
          toR: 1.3 + rng() * 0.6,
          count: 20 + Math.floor(rng() * 4),
          seed: pl.idx * 10 + k + 1,
          hang: true,
          width: 0.016,
          trunk: 1.4,
        });
      });
    } else if (pl.layer === 2) {
      const from = under[order[0]];
      bundles.push({
        from: from.pos,
        to: from.pos.clone().add(new THREE.Vector3(0, -3.0, 0)),
        padR: from.r,
        toR: 1.2,
        count: 20,
        seed: pl.idx * 10 + 7,
        hang: true,
        width: 0.012,
      });
    }
  });
  return { plates, bundles };
};

export const createFibreLayers = (P: FibrePalette, gl: THREE.WebGLRenderer): LookInstance => {
  const scene = new THREE.Scene();
  const depthScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 60);
  const { plates, bundles } = buildLayout();
  const kit = buildFibreKit(gl, P, plates, bundles, scene);
  scene.add(kit.group);
  depthScene.add(kit.depthGroup);
  return {
    scene,
    camera,
    clearColor: kit.clearColor,
    post: {
      focus: 5.0,
      cocScale: 7,
      maxCoc: 10,
      nearScale: 1.2,
      bloomStrength: 0.6,
      bloomThreshold: 0.55,
      exposure: 1.0,
      vignette: 0.4,
      grain: 0.015,
      acesMix: 0.25,
    },
    update: (frame, w, h, k) => {
      const f = frame % LOOP;
      const t = f / LOOP;
      const a = t * Math.PI * 2;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camera.position.set(1.0 + t * PX, -0.75 + 0.1 * Math.sin(a), 0.6 + 0.15 * Math.sin(a + 1.2));
      camera.rotation.order = "YXZ";
      camera.rotation.set(
        THREE.MathUtils.degToRad(15 + 1.2 * Math.sin(a + 0.5)),
        THREE.MathUtils.degToRad(-6 + 2 * Math.sin(a)),
        0,
      );
      kit.update(f, w, h, k, camera);
    },
    draw: (g) => {
      g.render(scene, camera);
      g.render(depthScene, camera);
    },
    dispose: kit.dispose,
  };
};
