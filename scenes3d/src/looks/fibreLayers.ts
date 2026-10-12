import * as THREE from "three";
import { PLATE_VARIANTS } from "../kit/circuit";
import { BundleSpec, buildFibreKit, FibrePalette, padsOf, PlateSpec } from "../kit/fibreKit";
import { LookInstance } from "../kit/post";
import { LOOP, mulberry32 } from "../kit/random";

// Three layers of floating plates, periodic sideways (period PX). The camera
// sits below the middle layer looking up and glides exactly one period.

const PX = 9.5;
const LAYER_Y = [1.5, 0.0, -1.7];
const PER_LAYER = [3, 3, 2];
const SIZE = 2.3;

type Seed = { layer: number; x: number; z: number; y: number; yaw: number; variant: number };

const PERIOD_PLATES: Seed[] = (() => {
  const rng = mulberry32(6060);
  const out: Seed[] = [];
  LAYER_Y.forEach((ly, layer) => {
    const n = PER_LAYER[layer];
    for (let i = 0; i < n; i++) {
      out.push({
        layer,
        x: ((i + 0.2 + rng() * 0.6) / n) * PX,
        z: -3.0 - rng() * 6.5 - layer * 0.3,
        y: ly + (rng() - 0.5) * 0.35,
        yaw: (rng() - 0.5) * 0.35,
        variant: Math.floor(rng() * PLATE_VARIANTS.length),
      });
    }
  });
  return out;
})();

const buildLayout = () => {
  const plates: (PlateSpec & { layer: number; period: number; idx: number })[] = [];
  for (let p = -2; p <= 3; p++) {
    PERIOD_PLATES.forEach((s, idx) => {
      const m = new THREE.Matrix4()
        .makeTranslation(s.x + p * PX, s.y, s.z)
        .multiply(new THREE.Matrix4().makeRotationY(s.yaw));
      plates.push({ variant: s.variant, size: SIZE, matrix: m, layer: s.layer, period: p, idx });
    });
  }
  const bundles: BundleSpec[] = [];
  plates.forEach((pl) => {
    // Bundle choices depend on the plate's index in the period only, so the
    // layout repeats exactly every PX.
    const rng = mulberry32(8000 + pl.idx);
    const pads = padsOf(pl, -1);
    const order = pads.map((_, i) => i).sort(() => rng() - 0.5);
    if (pl.layer === 0) {
      // Top layer: connect down to the nearest middle plate's top pads.
      const mids = plates.filter((q) => q.layer === 1);
      order.slice(0, 2).forEach((pi, k) => {
        const from = pads[pi];
        let best: { pos: THREE.Vector3; r: number } | null = null;
        let bd = Infinity;
        mids.forEach((q) =>
          padsOf(q, 1).forEach((tp) => {
            const d = Math.hypot(tp.pos.x - from.pos.x, tp.pos.z - from.pos.z);
            if (d < bd) {
              bd = d;
              best = tp;
            }
          }),
        );
        if (best && bd < 1.3) {
          const b = best as { pos: THREE.Vector3; r: number };
          bundles.push({
            from: from.pos,
            to: b.pos,
            padR: from.r,
            toR: b.r,
            count: 20 + Math.floor(rng() * 12),
            seed: pl.idx * 10 + k,
            hang: false,
            width: 0.0042,
          });
        } else {
          bundles.push({
            from: from.pos,
            to: from.pos.clone().add(new THREE.Vector3((rng() - 0.5) * 0.6, -6.5, (rng() - 0.5) * 0.6)),
            padR: from.r,
            toR: 1.8 + rng() * 1.0,
            count: 24 + Math.floor(rng() * 14),
            seed: pl.idx * 10 + k,
            hang: true,
            width: 0.0045,
          });
        }
      });
    } else {
      const n = pl.layer === 1 ? 2 : 1;
      order.slice(0, n).forEach((pi, k) => {
        const from = pads[pi];
        bundles.push({
          from: from.pos,
          to: from.pos.clone().add(new THREE.Vector3((rng() - 0.5) * 0.8, -8, (rng() - 0.5) * 0.8)),
          padR: from.r,
          toR: 1.8 + rng() * 1.2,
          count: 30 + Math.floor(rng() * 11),
          seed: pl.idx * 10 + k + 5,
          hang: true,
          width: 0.0045,
        });
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
      bloomStrength: 0.55,
      bloomThreshold: 0.5,
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
      camera.position.set(1.0 + t * PX, -1.05 + 0.12 * Math.sin(a), 0.6 + 0.15 * Math.sin(a + 1.2));
      camera.rotation.order = "YXZ";
      camera.rotation.set(
        THREE.MathUtils.degToRad(15 + 1.2 * Math.sin(a + 0.5)),
        THREE.MathUtils.degToRad(-6 + 2 * Math.sin(a)),
        0,
      );
      kit.update(f, w, h, k);
    },
    draw: (g) => {
      g.render(scene, camera);
      g.render(depthScene, camera);
    },
    dispose: kit.dispose,
  };
};
