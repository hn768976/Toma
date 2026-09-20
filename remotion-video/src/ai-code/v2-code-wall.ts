import * as THREE from "three";
import { DURATION_IN_FRAMES } from "./constants";
import { monoFontReady } from "./fonts";
import { createCodeSheet } from "./code-canvas";
import { createBeamTexture, createHazeTexture } from "./textures";
import {
  additive,
  disposeScene,
  makeCanvasTexture,
  quad,
  subTexture,
} from "./scene-kit";
import { fadeWindow, rand, randRange, wrap } from "./rng";
import type { Stage, StageContext } from "./ThreeStage";

// V2 — "code wall": a full-frame slab of real-looking code, shot at an
// angle, scrolling steadily upward while the focus plane breathes
// through it. No icons, no graphics; the code is the visual.
//
// Same loop trick as V1, rotated: panels live in a band WALL_PERIOD tall
// and travel exactly that far over the clip, wrapping at the edges.

const WALL_PERIOD = 54;
const PANEL_COUNT = 52;
const BAR_COUNT = 26;
const SHEET_COUNT = 7;

// Wall depth range. Band centres sit inside it; the focus plane sweeps
// across them, which is what makes the text sharpen and soften.
const BAND_CENTERS = [17, 26, 38];
const FOCUS_NEAR = 16;
const FOCUS_FAR = 39;
const BLUR_PER_UNIT = 1.5;
const MAX_BLUR = 26;

type Panel = {
  readonly object: THREE.Object3D;
  readonly material: THREE.MeshBasicMaterial;
  readonly y0: number;
  readonly baseOpacity: number;
};

type Bar = {
  readonly object: THREE.Object3D;
  readonly material: THREE.MeshBasicMaterial;
  readonly y0: number;
  readonly peak: number;
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
          highlightRate: 0.08,
          paintBackground: false,
        }),
        true,
      ),
    );
  }
  const barTexture = makeCanvasTexture(
    createBeamTexture(
      Math.round(256 * scale),
      Math.round(32 * scale),
      12,
      "200, 230, 255",
    ),
  );
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

    const width = randRange(i, 14, 9, 26);
    const height = (width * repeatY) / repeatX;
    const material = additive(map, 1);
    const mesh = quad(material, width, height);

    mesh.position.x = randRange(i, 15, -30, 30);
    mesh.position.z = -randRange(i, 16, FOCUS_NEAR - 3, FOCUS_FAR + 4);
    mesh.rotation.y = randRange(i, 17, -0.1, 0.1);
    mesh.rotation.z = randRange(i, 18, -0.02, 0.02);

    wall.add(mesh);
    panels.push({
      object: mesh,
      material,
      y0: rand(i, 19) * WALL_PERIOD,
      baseOpacity: randRange(i, 20, 0.45, 1.15),
    });
  }

  // Bright bars that blink across the text, as in the reference.
  const bars: Bar[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const material = additive(barTexture, 0);
    const mesh = quad(
      material,
      randRange(i, 30, 2.5, 9),
      randRange(i, 31, 0.14, 0.4),
    );
    mesh.position.x = randRange(i, 32, -28, 28);
    mesh.position.z = -randRange(i, 33, FOCUS_NEAR, FOCUS_FAR);
    wall.add(mesh);
    bars.push({
      object: mesh,
      material,
      y0: rand(i, 34) * WALL_PERIOD,
      peak: randRange(i, 35, 0.5, 1),
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
    for (let i = 0; i < bands.length; i++) {
      bands[i].blurPx =
        Math.min(
          MAX_BLUR,
          Math.abs(BAND_CENTERS[i] - focus) * BLUR_PER_UNIT,
        ) * scale;
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

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const y =
        -WALL_PERIOD / 2 + wrap(bar.y0 + progress * WALL_PERIOD, WALL_PERIOD);
      bar.object.position.y = y;
      // Blink on a per-bar schedule; a pure function of the frame, and
      // the modulo keeps it identical on either side of the loop point.
      const slot = Math.floor(f / 4);
      const lit = rand(i * 977 + slot, 36) < 0.22 ? 1 : 0;
      const flicker = lit * (0.55 + 0.45 * rand(i * 131 + f, 37));
      bar.material.opacity =
        bar.peak *
        flicker *
        fadeWindow(y, -WALL_PERIOD / 2, WALL_PERIOD / 2, 9, 9);
      bar.object.layers.set(bandFor(-bar.object.position.z));
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
