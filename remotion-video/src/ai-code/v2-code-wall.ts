import * as THREE from "three";
import { DURATION_IN_FRAMES } from "./constants";
import { monoFontReady } from "./fonts";
import { createCodeSheet } from "./code-canvas";
import { createHazeTexture } from "./textures";
import {
  additive,
  disposeScene,
  makeCanvasTexture,
  quad,
  subTexture,
} from "./scene-kit";
import { fadeWindow, randRange, wrap } from "./rng";
import type { Stage, StageContext } from "./ThreeStage";

// V2 — "code wall": a full-frame slab of real-looking code, shot at an
// angle, scrolling steadily upward while the focus plane breathes
// through it.
//
// No icons, no graphics, no overlaid lines of any kind — no ray fan, no
// flicker bars, not even selection bands inside the code sheets. The
// only non-code element is the cool wash across the top. The code is
// the visual.
//
// Same loop trick as V1, rotated: panels live in a band WALL_PERIOD tall
// and travel exactly that far over the clip, wrapping at the edges.

const WALL_PERIOD = 54;
const PANEL_COUNT = 66;
const SHEET_COUNT = 7;

// Wall depth range. Band centres sit inside it; the focus plane sweeps
// across them, which is what makes the text sharpen and soften.
const BAND_CENTERS = [20, 28, 38];
const FOCUS_NEAR = 19;
const FOCUS_FAR = 39;
const BLUR_PER_UNIT = 0.85;
const MAX_BLUR = 15;

type Panel = {
  readonly object: THREE.Object3D;
  readonly material: THREE.MeshBasicMaterial;
  readonly y0: number;
  readonly baseOpacity: number;
};

const bandFor = (distance: number) => {
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < BAND_CENTERS.length; i++) {
    const delta = Math.abs(distance - BAND_CENTERS[i]);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return best;
};

export const createCodeWallStage = async (
  ctx: StageContext,
): Promise<Stage> => {
  await monoFontReady;
  const { scale } = ctx;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 34, 62);

  const camera = ctx.makeCamera(44, 0.5, 80);

  const sheetPx = Math.round(1024 * scale);
  const sheets: THREE.Texture[] = [];
  for (let i = 0; i < SHEET_COUNT; i++) {
    sheets.push(
      makeCanvasTexture(
        createCodeSheet({
          width: sheetPx,
          height: sheetPx,
          fontSize: 12 * scale,
          lineHeight: 17 * scale,
          seed: 700 + i,
          theme: "slate",
          alpha: i % 3 === 0 ? 1 : 0.8,
          showLineNumbers: i % 3 === 1,
          highlightRate: 0,
          paintBackground: false,
        }),
        true,
      ),
    );
  }
  const glowTexture = makeCanvasTexture(
    createHazeTexture(
      Math.round(1024 * scale),
      Math.round(512 * scale),
      "96, 168, 255",
    ),
  );

  const wall = new THREE.Group();
  // The whole wall is yawed, so the right-hand side recedes and the code
  // reads as a surface in space rather than an overlay.
  wall.rotation.y = 0.2;
  wall.rotation.z = 0.025;
  scene.add(wall);

  const panels: Panel[] = [];
  for (let i = 0; i < PANEL_COUNT; i++) {
    const sheet = sheets[i % SHEET_COUNT];
    const repeatX = randRange(i, 10, 0.4, 0.95);
    const repeatY = randRange(i, 11, 0.3, 0.85);
    const map = subTexture(
      sheet,
      randRange(i, 12, 0, 1),
      randRange(i, 13, 0, 1),
      repeatX,
      repeatY,
    );

    const width = randRange(i, 14, 10, 22);
    const height = (width * repeatY) / repeatX;
    const material = additive(map, 1);
    const mesh = quad(material, width, height);

    // Stratified rather than uniformly random. Pure randomness leaves
    // holes, and a hole in the sharp band reads as a dead patch of
    // frame; spreading x, vertical phase and depth on decorrelated
    // strides keeps the wall evenly covered at every moment of the loop.
    const xSlot = (i + randRange(i, 15, 0.1, 0.9)) / PANEL_COUNT;
    mesh.position.x = -34 + xSlot * 68;

    const depthBand = i % BAND_CENTERS.length;
    const bandSpan = (FOCUS_FAR + 4 - (FOCUS_NEAR - 2)) / BAND_CENTERS.length;
    mesh.position.z = -(
      FOCUS_NEAR -
      2 +
      (depthBand + randRange(i, 16, 0.05, 0.95)) * bandSpan
    );
    mesh.rotation.y = randRange(i, 17, -0.1, 0.1);
    mesh.rotation.z = randRange(i, 18, -0.02, 0.02);

    wall.add(mesh);
    panels.push({
      object: mesh,
      material,
      y0:
        ((((i * 13) % PANEL_COUNT) + randRange(i, 19, 0, 1)) / PANEL_COUNT) *
        WALL_PERIOD,
      baseOpacity: randRange(i, 20, 0.55, 1.15),
    });
  }

  // The cool wash across the top of the frame.
  const topGlow = quad(additive(glowTexture, 0.5), 78, 34);
  topGlow.position.set(0, 15, -44);
  scene.add(topGlow);

  const bands = BAND_CENTERS.map((_, layer) => ({
    layer,
    blurPx: 0,
    opacity: 1,
  }));

  const update = (frame: number) => {
    const f = frame % DURATION_IN_FRAMES;
    const progress = f / DURATION_IN_FRAMES;
    const tau = progress * Math.PI * 2;

    camera.position.x = Math.sin(tau) * 0.5;
    camera.position.y = Math.cos(tau) * 0.35;
    camera.rotation.z = Math.sin(tau * 2) * 0.008;

    // Focus plane sweeps front to back and returns, so text drifts in
    // and out of legibility the way it does in the reference.
    const focus =
      (FOCUS_NEAR + FOCUS_FAR) / 2 +
      ((FOCUS_FAR - FOCUS_NEAR) / 2) * Math.sin(tau);

    // Blur is measured against the band nearest the focus, not against
    // the focus itself. With only three discrete bands a continuous
    // sweep almost never lands on a centre, so an absolute measure
    // leaves every band slightly soft and the whole frame reads as mush.
    // Subtracting the minimum keeps exactly one band sharp at all times
    // and lets the sharp band hand off to the next as the focus travels.
    const distances = BAND_CENTERS.map((center) => Math.abs(center - focus));
    const nearest = Math.min(...distances);
    for (let i = 0; i < bands.length; i++) {
      bands[i].blurPx =
        Math.min(MAX_BLUR, (distances[i] - nearest) * BLUR_PER_UNIT) * scale;
    }

    for (const panel of panels) {
      const y =
        -WALL_PERIOD / 2 + wrap(panel.y0 + progress * WALL_PERIOD, WALL_PERIOD);
      panel.object.position.y = y;
      // Fade at both ends of the travel so the wrap is invisible.
      panel.material.opacity =
        panel.baseOpacity *
        fadeWindow(y, -WALL_PERIOD / 2, WALL_PERIOD / 2, 9, 9);
      panel.object.layers.set(bandFor(-panel.object.position.z));
    }

    topGlow.layers.set(BAND_CENTERS.length - 1);
  };

  const dispose = () => {
    for (const sheet of sheets) {
      sheet.dispose();
    }
    disposeScene(scene);
  };

  return { scene, camera, bands, update, dispose };
};
