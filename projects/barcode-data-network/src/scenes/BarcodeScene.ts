import * as THREE from "three";
import { Seg, SegmentBatch } from "../engine/SegmentBatch";
import { createBackground } from "../engine/Background";
import { SceneSpec } from "../engine/Stage";
import { clamp01, easeInOutCubic, makeNoise1D, mulberry32, pick, range, smoothstep } from "../engine/rng";

export type BarcodeVariant = "v1" | "v2";

const DURATION = 551 / 30;
const SPACING = 0.52; // distance between strip centre lines
const HW = 0.105; // band half width
const K_MIN = -40; // far strips
const K_MAX = 16; // near strips
const X_RANGE = 22;

const hwOf = (k: number) => HW * (1 + 0.7 * clamp01((k - 2) / 10));

const ink = new THREE.Color("#0d0d0d");
const inkSoft = new THREE.Color("#2a2a2a");
const lineGrey = new THREE.Color("#1f1f1f");

export const createBarcodeScene = (variant: BarcodeVariant): SceneSpec => {
  const rng = mulberry32(643714546);
  const nDensity = makeNoise1D(5);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(variant === "v1" ? 32 : 38, 16 / 9, 0.05, 300);

  const segs: Seg[] = [];
  const lines: Seg[] = [];

  // reveal: far strips first, sweeping toward the camera during the first ~1.4 s
  // (mapped over the strips that are actually on screen, so the build-in
  //  starts on the very first frames, as in the reference)
  const revealFor = (k: number) =>
    rng() < 0.1 ? range(rng, 0.03, 0.5) : 0.1 + 1.0 * clamp01((k + 14) / 18) + range(rng, 0, 0.25);

  const stripV: number[] = [];
  for (let k = K_MIN; k <= K_MAX; k++) {
    stripV[k - K_MIN] = -(0.05 + 0.12 * rng());
  }
  const vOf = (k: number) => stripV[k - K_MIN];

  for (let k = K_MIN; k <= K_MAX; k++) {
    const zc = k * SPACING;
    const hw = hwOf(k);
    const v = vOf(k);
    const heavy = rng() < 0.5; // strips that carry the big black blocks
    const xr = X_RANGE + Math.abs(v) * DURATION;

    // band outlines (long, occasionally broken)
    for (const side of [-1, 1]) {
      let x = -xr;
      while (x < xr) {
        const len = range(rng, 1.2, 6);
        segs.push({
          x0: x, z0: zc + side * hw, x1: x + len, z1: zc + side * hw, w: 0.0055,
          color: inkSoft, a: 0.85, v0: v, tIn: 0.03 + 0.4 * revealFor(k), inDur: 0.7, grow: 1, anchor: 0.5,
        });
        x += len + range(rng, 0.05, 0.5);
      }
    }

    // barcode groups inside the band
    let x = -xr + range(rng, 0, 1);
    while (x < xr) {
      const dens = nDensity(x * 0.35 + k * 3.7);
      const groupLen = range(rng, 0.3, 1.6);
      const gEnd = x + groupLen;
      while (x < gEnd) {
        let w: number;
        if (heavy && rng() < 0.3) w = range(rng, 0.08, 0.28);
        else w = pick(rng, [0.008, 0.01, 0.014, 0.02, 0.028, 0.04]);
        const partial = rng() < 0.2;
        const z0 = zc - hw + 0.012;
        const z1 = partial ? zc + range(rng, -0.04, 0.06) * (hw / HW) : zc + hw - 0.012;
        const tIn = revealFor(k) + 0.4 * clamp01((x + 8) / 16) + range(rng, 0, 0.12);
        segs.push({
          x0: x + w / 2, z0, x1: x + w / 2, z1, w,
          color: ink, a: 1.0, v0: v, tIn, inDur: 0.25,
        });
        x += w + pick(rng, [0.008, 0.012, 0.02, 0.035, 0.05]);
      }
      x += range(rng, 0.08, 1.0) * (1.3 - dens);
    }

    // tiny "caption" marks just outside the band
    x = -xr + range(rng, 0, 2);
    while (x < xr) {
      const n = Math.floor(range(rng, 3, 9));
      const side = rng() < 0.7 ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const w = range(rng, 0.008, 0.016);
        segs.push({
          x0: x + i * 0.028, z0: zc + side * (hw + 0.025), x1: x + i * 0.028, z1: zc + side * (hw + 0.045), w,
          color: inkSoft, a: 0.8, v0: v, tIn: revealFor(k) + 0.2, inDur: 0.3,
        });
      }
      x += range(rng, 0.8, 3.5);
    }

    // dot matrices in the gaps between bands
    if (rng() < 0.95) {
      const zg0 = zc + hw + 0.075;
      const maxRows = Math.max(2, Math.floor((SPACING - hw - hwOf(k + 1) - 0.1) / 0.032));
      const rows = Math.min(maxRows, Math.floor(range(rng, 3, 7)));
      let px = -xr + range(rng, 0, 3);
      while (px < xr) {
        const plen = range(rng, 0.4, 2.6);
        for (let gx = px; gx < px + plen; gx += 0.032) {
          for (let r = 0; r < rows; r++) {
            if (rng() < 0.45) continue;
            const s = rng() < 0.15 ? 0.024 : 0.014;
            segs.push({
              x0: gx - s / 2, z0: zg0 + r * 0.032, x1: gx + s / 2, z1: zg0 + r * 0.032, w: s,
              color: inkSoft, a: range(rng, 0.6, 1.0), v0: v, tIn: revealFor(k) + range(rng, 0.1, 0.5), inDur: 0.3,
            });
          }
        }
        px += plen + range(rng, 0.4, 2.5);
      }
    }
  }

  // ---- network fans: hubs that connect to points on neighbouring strips -----
  const visX = (t: number) => (variant === "v1" ? 0.095 * t : 0.32 * t); // camera truck
  const HUBS = 560;
  for (let i = 0; i < HUBS; i++) {
    const tIn = i < 60 ? range(rng, 0.05, 1.6) : range(rng, 0.4, DURATION);
    const life = range(rng, 0.7, 2.4);
    const kHub = Math.round(range(rng, K_MIN + 6, K_MAX - 2));
    const vh = vOf(kHub);
    const xw = visX(tIn) + range(rng, -5, 4.5);
    const hx = xw - vh * tIn; // local coordinate so the hub is at xw at tIn
    const hz = kHub * SPACING + hwOf(kHub);
    const fan = Math.floor(range(rng, 7, 12));
    const spread = range(rng, 1.4, 2.8);
    for (let j = 0; j < fan; j++) {
      const dk = rng() < 0.1 ? -1 : rng() < 0.6 ? 1 : 2;
      const ke = Math.max(K_MIN, Math.min(K_MAX, kHub + dk));
      const ve = vOf(ke);
      const ex = xw + range(rng, -spread, spread) - ve * tIn;
      const ez = ke * SPACING - hwOf(ke);
      lines.push({
        x0: hx, z0: hz, x1: ex, z1: ez, w: 0.0085, color: lineGrey, a: range(rng, 0.7, 1.0),
        v0: vh, v1: ve, y: 0.001, tIn: tIn + j * 0.03, inDur: 0.35, tOut: tIn + life, outDur: 0.3, grow: 1, anchor: 0,
      });
    }
    lines.push({
      x0: hx - 0.012, z0: hz, x1: hx + 0.012, z1: hz, w: 0.024, color: ink, a: 0.9, v0: vh,
      tIn, inDur: 0.15, tOut: tIn + life, outDur: 0.3,
    });
  }
  // a few long straight connectors that sweep across many strips
  for (let i = 0; i < 14; i++) {
    const tIn = range(rng, 0.3, DURATION);
    const k0 = Math.round(range(rng, K_MIN + 6, K_MAX - 2));
    const k1 = Math.max(K_MIN, Math.min(K_MAX, k0 + Math.round(range(rng, -7, 7))));
    const xw = visX(tIn) + range(rng, -7, 6);
    lines.push({
      x0: xw - vOf(k0) * tIn, z0: k0 * SPACING + hwOf(k0), x1: xw + range(rng, -6, 6) - vOf(k1) * tIn, z1: k1 * SPACING - hwOf(k1),
      w: 0.0035, color: lineGrey, a: 0.5, v0: vOf(k0), v1: vOf(k1), tIn, inDur: 0.5,
      tOut: tIn + range(rng, 1.5, 4), outDur: 0.4, grow: 1, anchor: 0,
    });
  }

  const bg = createBackground({
    colA: new THREE.Color("#f2f2f2"),
    colB: new THREE.Color("#ebebeb"),
    glowColor: new THREE.Color("#ffffff"),
    glowPos: [0.5, 0.55],
    glowRadius: 0.6,
    glowStrength: 0.03,
  });
  const segBatch = new SegmentBatch(segs, { additive: false, renderOrder: 1, minPx: 1.0 });
  const lineBatch = new SegmentBatch(lines, { additive: false, renderOrder: 2, minPx: 1.0 });
  scene.add(bg.mesh, segBatch.mesh, lineBatch.mesh);

  const target = new THREE.Vector3();
  const dof = { focus: 4, aperture: 0.014, maxBlur: 0.005, nearMul: 1.0, skyBlur: 0.005 };

  return {
    scene,
    camera,
    batches: [segBatch, lineBatch],
    dof,
    grade: { exposure: 1.0, vignette: 0.12, vignetteColor: new THREE.Color("#bdbdbd") },
    animate: (t, stage) => {
      const intro = easeInOutCubic(clamp01(t / 2.2));
      const u = t / DURATION;
      let radius: number;
      let el: number;
      let az: number;
      let roll = 0;
      if (variant === "v1") {
        // reference: steady high three-quarter view, slow truck along the strips
        radius = 4.3 - 0.4 * intro - 0.2 * u;
        el = THREE.MathUtils.degToRad(42 - 6 * intro + 2 * Math.sin(u * Math.PI));
        az = THREE.MathUtils.degToRad(-35 - 3 * u);
        target.set(visX(t), 0, -0.4);
      } else {
        // alternative: low, grazing dolly that banks and orbits along the data
        radius = 3.1 - 0.45 * intro;
        el = THREE.MathUtils.degToRad(33 - 6 * intro - 5 * smoothstep(0, 1, u));
        az = THREE.MathUtils.degToRad(-58 + 34 * easeInOutCubic(u));
        roll = THREE.MathUtils.degToRad(-6 + 9 * easeInOutCubic(u));
        target.set(visX(t), 0, -0.2);
      }
      camera.position.set(
        target.x + radius * Math.cos(el) * Math.sin(az),
        target.y + radius * Math.sin(el),
        target.z + radius * Math.cos(el) * Math.cos(az),
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      if (roll !== 0) camera.rotateZ(roll);
      stage.dof.params.focus = radius;
    },
  };
};
