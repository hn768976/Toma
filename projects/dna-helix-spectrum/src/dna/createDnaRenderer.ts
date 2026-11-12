import * as THREE from "three";
import { createBokehGeometry, createBokehMaterial, markDirty } from "../engine/bokehMaterial";
import { FrameRenderer } from "../engine/GLCanvas";
import { Pipeline } from "../engine/pipeline";
import { hsl, makeRng } from "../engine/random";
import { DnaVariant } from "./variants";

// Helix geometry (world units, helix radius = 1)
const RADIUS = 1;
const PITCH = 5.0; // one full turn
const S_START = -20;
const S_END = 48;
const RUNGS_PER_HALF_TURN = 20;
const DOTS_PER_RUNG = 110;
const BACKBONE_SPACING = 0.03;

/** Gently curving helix axis (the strand bends down & away towards the far end). */
const axis = (s: number, out: THREE.Vector3) => {
  const far = Math.max(0, s - 6);
  return out.set(s, -0.004 * far * far, -0.006 * far * far);
};

export const createDnaRenderer = (variant: DnaVariant, fps: number, durationInFrames: number) =>
  (canvas: HTMLCanvasElement, width: number, height: number): FrameRenderer => {
    const pipeline = new Pipeline(canvas, width, height);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 500);
    const rng = makeRng(variant.seed);

    const ds = PITCH / 2 / RUNGS_PER_HALF_TURN;
    const rungCount = Math.floor((S_END - S_START) / ds);
    const backboneCount = Math.floor((S_END - S_START) / BACKBONE_SPACING);
    const total = rungCount * DOTS_PER_RUNG + backboneCount * 2;
    const geo = createBokehGeometry(total, rng);
    const material = createBokehMaterial();
    const points = new THREE.Points(geo.geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // Static attributes: rung colours, dot sizes, energies.
    const pxScale = height / 2160;
    const rungS = new Float32Array(rungCount);
    let p = 0;
    for (let i = 0; i < rungCount; i++) {
      rungS[i] = S_START + i * ds + (rng() - 0.5) * ds * 0.25;
      const hue = variant.rungHues[Math.floor(rng() * variant.rungHues.length)] + (rng() - 0.5) * 0.03;
      const [r, g, b] = hsl(hue, variant.rungSaturation, 0.5);
      const bright = 0.75 + rng() * 0.5;
      const phase = rng();
      for (let j = 0; j < DOTS_PER_RUNG; j++, p++) {
        geo.colors[p * 3] = r;
        geo.colors[p * 3 + 1] = g;
        geo.colors[p * 3 + 2] = b;
        geo.sizes[p] = 0.022;
        geo.rnds[p] = (j * 0.6180339887 + phase) % 1; // stratified LOD thinning
        geo.spacings[p] = (2 * RADIUS) / DOTS_PER_RUNG;
        geo.energies[p] = bright * (j % 2 === 0 ? 1.1 : 0.9);
      }
    }
    const bbStart = p;
    for (let k = 0; k < backboneCount * 2; k++, p++) {
      const [r, g, b] = variant.backboneColor;
      const tint = 0.85 + rng() * 0.3;
      geo.colors[p * 3] = r * tint;
      geo.colors[p * 3 + 1] = g * tint;
      geo.colors[p * 3 + 2] = b;
      geo.sizes[p] = 0.026;
      geo.energies[p] = 1.6;
      geo.rnds[p] = (k * 0.6180339887) % 1;
      geo.spacings[p] = BACKBONE_SPACING;
    }

    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const T = new THREE.Vector3();
    const N = new THREE.Vector3();
    const Bn = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const E1 = new THREE.Vector3();
    const E2 = new THREE.Vector3();
    const Z = new THREE.Vector3(0, 0, 1);
    const frameAt = (s: number, spin: number, sign: number, out: THREE.Vector3) => {
      axis(s, A);
      axis(s + 0.01, tmp);
      T.subVectors(tmp, A).normalize();
      N.copy(Z).addScaledVector(T, -T.dot(Z)).normalize();
      Bn.crossVectors(T, N);
      const th = (s / PITCH) * Math.PI * 2 + spin;
      return out
        .copy(A)
        .addScaledVector(N, Math.cos(th) * RADIUS * sign)
        .addScaledVector(Bn, Math.sin(th) * RADIUS * sign);
    };

    return {
      renderFrame(frame: number) {
        const t = frame / fps;
        const spin = variant.spin(t);
        let q = 0;
        const P = geo.positions;
        for (let i = 0; i < rungCount; i++) {
          const e1 = frameAt(rungS[i], spin, 1, E1);
          const e2 = frameAt(rungS[i], spin, -1, E2);
          for (let j = 0; j < DOTS_PER_RUNG; j++, q++) {
            const u = (j + 0.5) / DOTS_PER_RUNG;
            P[q * 3] = e1.x + (e2.x - e1.x) * u;
            P[q * 3 + 1] = e1.y + (e2.y - e1.y) * u;
            P[q * 3 + 2] = e1.z + (e2.z - e1.z) * u;
          }
        }
        q = bbStart;
        for (let side = 1; side >= -1; side -= 2) {
          for (let k = 0; k < backboneCount; k++, q++) {
            frameAt(S_START + k * BACKBONE_SPACING, spin, side, B);
            P[q * 3] = B.x;
            P[q * 3 + 1] = B.y;
            P[q * 3 + 2] = B.z;
          }
        }
        markDirty(geo);

        const cam = variant.camera(t, durationInFrames / fps);
        camera.fov = cam.fov;
        camera.updateProjectionMatrix();
        camera.position.set(...cam.position);
        camera.up.set(...cam.up).normalize();
        camera.lookAt(...cam.target);
        camera.updateMatrixWorld();

        const proj = height / (2 * Math.tan((cam.fov * Math.PI) / 360));
        const u = material.uniforms;
        u.uProj.value = proj;
        u.uFocus.value = cam.focus;
        u.uAperture.value = cam.aperture;
        u.uMinSize.value = 2.2 * pxScale;
        u.uMaxSize.value = 1000 * pxScale;
        u.uLod.value = 5;
        u.uDisc.value = 0;
        u.uGain.value = 1;

        pipeline.render(scene, camera, {
          exposure: variant.exposure,
          bloomNear: variant.bloomNear,
          bloomWide: variant.bloomWide,
          saturation: 1.05,
          lift: [0, 0, 0],
          vignette: 0,
        });
      },
      dispose() {
        geo.geometry.dispose();
        material.dispose();
        pipeline.dispose();
      },
    };
  };
