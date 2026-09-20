import * as THREE from "three";
import { DURATION_IN_FRAMES } from "./constants";
import { monoFontReady } from "./fonts";
import { createCodeSheet } from "./code-canvas";
import {
  createBeamTexture,
  createChipTexture,
  createDotTexture,
  createSlabTexture,
  type ChipVariant,
} from "./textures";
import {
  additive,
  additiveLineMaterial,
  disposeScene,
  makeCanvasTexture,
  quad,
  subTexture,
} from "./scene-kit";
import { fadeWindow, rand, randRange, wrap } from "./rng";
import type { Stage, StageContext } from "./ThreeStage";

// V1 — "code city": a fly-through of a dark blue-teal volume packed with
// translucent code panels, wireframe lattice, chromatic glass slabs,
// beaded light beams and drifting "AI" chips.
//
// The loop is spatial. Everything lives in a slab LOOP_DEPTH deep and
// travels exactly LOOP_DEPTH toward the camera over the clip, wrapping
// around, so frame 300 is identical to frame 0.

const LOOP_DEPTH = 76;
const PANEL_COUNT = 74;
const SLAB_COUNT = 9;
const BEAM_COUNT = 6;
const CHIP_COUNT = 16;
const DUST_COUNT = 1100;
const SHEET_COUNT = 6;

const CHIP_VARIANTS: readonly ChipVariant[] = [
  "glass",
  "particle",
  "ray",
  "wire",
  "particle",
  "ray",
];

// Depth bands, nearest first. `to` is distance in front of the camera.
const BAND_EDGES = [10, 19, 36, LOOP_DEPTH + 1];
const BAND_BLUR = [34, 10, 0.5, 12];
const FOCUS = 2;

const bandFor = (distance: number) => {
  for (let i = 0; i < BAND_EDGES.length; i++) {
    if (distance < BAND_EDGES[i]) {
      return i;
    }
  }
  return BAND_EDGES.length - 1;
};

type Drifter = {
  readonly object: THREE.Object3D;
  readonly material: THREE.MeshBasicMaterial;
  readonly z0: number;
  readonly y0: number;
  readonly baseOpacity: number;
  readonly spin: number;
  readonly spinPhase: number;
  readonly bob: number;
  readonly bobPhase: number;
};

export const createCodeCityStage = async (
  ctx: StageContext,
): Promise<Stage> => {
  await monoFontReady;
  const { scale } = ctx;

  const scene = new THREE.Scene();
  // Additive materials fade to the fog colour, so black fog is a pure
  // distance falloff and doubles as the far-plane fade-in.
  scene.fog = new THREE.Fog(0x000000, LOOP_DEPTH * 0.42, LOOP_DEPTH * 1.02);

  const camera = ctx.makeCamera(54, 0.5, LOOP_DEPTH * 1.2);
  camera.position.set(0, 0, 0);

  // --- shared textures -------------------------------------------------
  const sheetPx = Math.round(1024 * scale);
  const sheets: THREE.Texture[] = [];
  for (let i = 0; i < SHEET_COUNT; i++) {
    sheets.push(
      makeCanvasTexture(
        createCodeSheet({
          width: sheetPx,
          height: sheetPx,
          fontSize: 11 * scale,
          lineHeight: 15.5 * scale,
          seed: 100 + i,
          theme: "vivid",
          alpha: i % 3 === 0 ? 1 : 0.88,
          highlightRate: 0.05,
          paintBackground: false,
        }),
        true,
      ),
    );
  }
  const slabTexture = makeCanvasTexture(
    createSlabTexture(Math.round(512 * scale), Math.round(128 * scale)),
  );
  const beamTextures = [0, 1, 2].map((i) =>
    makeCanvasTexture(
      createBeamTexture(Math.round(1024 * scale), Math.round(64 * scale), 40 + i),
    ),
  );
  const chipTextures = CHIP_VARIANTS.map((variant, i) =>
    makeCanvasTexture(
      createChipTexture(Math.round(384 * scale), variant, 60 + i),
    ),
  );
  const dotTexture = makeCanvasTexture(createDotTexture(Math.round(64 * scale)));

  const drifters: Drifter[] = [];

  const addDrifter = (
    object: THREE.Object3D,
    material: THREE.MeshBasicMaterial,
    index: number,
    salt: number,
    baseOpacity: number,
    spin: number,
    bob: number,
  ) => {
    scene.add(object);
    drifters.push({
      object,
      material,
      z0: rand(index, salt) * LOOP_DEPTH,
      y0: object.position.y,
      baseOpacity,
      spin,
      spinPhase: rand(index, salt + 1) * Math.PI * 2,
      bob,
      bobPhase: rand(index, salt + 2) * Math.PI * 2,
    });
  };

  // --- code panels -----------------------------------------------------
  for (let i = 0; i < PANEL_COUNT; i++) {
    const sheet = sheets[i % SHEET_COUNT];
    const repeatX = randRange(i, 20, 0.46, 0.96);
    const repeatY = randRange(i, 21, 0.3, 0.74);
    const offsetX = randRange(i, 22, 0, 1 - repeatX * 0.5);
    const offsetY = randRange(i, 23, 0, 1);
    const map = subTexture(sheet, offsetX, offsetY, repeatX, repeatY);

    const width = randRange(i, 24, 5, 12);
    // Keeping world aspect equal to the sampled aspect stops the glyphs
    // from stretching, which is what makes fake code look fake.
    const height = (width * repeatY) / repeatX;

    const material = additive(map, 1);
    const mesh = quad(material, width, height);

    // Radial placement, with the corridor down the middle kept clear.
    const angle = rand(i, 25) * Math.PI * 2;
    const radius = randRange(i, 26, 7.5, 26);
    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.y = Math.sin(angle) * radius * 0.58;

    const facing = rand(i, 27);
    if (facing < 0.55) {
      // Wall panels: turned to face the flight corridor.
      mesh.rotation.y =
        (mesh.position.x > 0 ? -1 : 1) * randRange(i, 28, 0.85, 1.25);
      mesh.rotation.x = randRange(i, 29, -0.16, 0.16);
    } else if (facing < 0.75) {
      // Floor/ceiling panels.
      mesh.rotation.x =
        (mesh.position.y > 0 ? 1 : -1) * randRange(i, 30, 0.8, 1.15);
      mesh.rotation.y = randRange(i, 31, -0.2, 0.2);
    } else {
      mesh.rotation.y = randRange(i, 32, -0.45, 0.45);
      mesh.rotation.x = randRange(i, 33, -0.25, 0.25);
    }
    mesh.rotation.z = randRange(i, 34, -0.1, 0.1);

    addDrifter(
      mesh,
      material,
      i,
      200,
      randRange(i, 35, 0.55, 1.25),
      0,
      randRange(i, 36, 0, 0.25),
    );
  }

  // --- glass slabs -----------------------------------------------------
  for (let i = 0; i < SLAB_COUNT; i++) {
    const material = additive(slabTexture, 1);
    const width = randRange(i, 40, 9, 22);
    const mesh = quad(material, width, width * randRange(i, 41, 0.16, 0.32));
    const angle = rand(i, 42) * Math.PI * 2;
    const radius = randRange(i, 43, 6, 22);
    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.y = Math.sin(angle) * radius * 0.6;
    mesh.rotation.y = randRange(i, 44, -1.2, 1.2);
    mesh.rotation.z = randRange(i, 45, -0.35, 0.35);
    addDrifter(mesh, material, i, 300, randRange(i, 46, 0.22, 0.45), 0, 0.3);
  }

  // --- beaded light beams ----------------------------------------------
  for (let i = 0; i < BEAM_COUNT; i++) {
    const material = additive(beamTextures[i % beamTextures.length], 1);
    const length = randRange(i, 50, 55, 105);
    const mesh = quad(material, length, length * 0.011);
    mesh.position.x = randRange(i, 51, -10, 10);
    mesh.position.y = randRange(i, 52, -13, 13);
    mesh.rotation.y = randRange(i, 53, -0.5, 0.5);
    mesh.rotation.z = randRange(i, 54, -0.12, 0.12);
    addDrifter(mesh, material, i, 400, randRange(i, 55, 0.35, 0.7), 0, 0.5);
  }

  // --- AI chips --------------------------------------------------------
  for (let i = 0; i < CHIP_COUNT; i++) {
    const material = additive(chipTextures[i % chipTextures.length], 1);
    const size = randRange(i, 60, 2.6, 5.4);
    const mesh = quad(material, size, size);
    const angle = rand(i, 61) * Math.PI * 2;
    const radius = randRange(i, 62, 4.5, 19);
    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.y = Math.sin(angle) * radius * 0.62;
    mesh.rotation.y = randRange(i, 63, -0.55, 0.55);
    mesh.rotation.x = randRange(i, 64, -0.3, 0.3);
    addDrifter(
      mesh,
      material,
      i,
      500,
      randRange(i, 65, 0.7, 1),
      randRange(i, 66, 0.05, 0.16),
      randRange(i, 67, 0.2, 0.7),
    );
  }

  // --- wireframe lattice ------------------------------------------------
  // Lines along the flight axis plus cross rings. The ring spacing
  // divides LOOP_DEPTH, so translating the whole lattice by one loop
  // lands it back on itself.
  const latticeGroup = new THREE.Group();
  {
    const positions: number[] = [];
    const colors: number[] = [];
    const ringSpacing = LOOP_DEPTH / 24;
    const zStart = -LOOP_DEPTH * 2.4;
    const zEnd = LOOP_DEPTH * 0.3;
    const cols = 15;
    const rows = 11;
    const spanX = 44;
    const spanY = 28;
    const push = (
      x1: number,
      y1: number,
      z1: number,
      x2: number,
      y2: number,
      z2: number,
      a: number,
    ) => {
      positions.push(x1, y1, z1, x2, y2, z2);
      colors.push(0.32, 0.62, 0.86, a, 0.32, 0.62, 0.86, a);
    };
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const x = (cx / (cols - 1) - 0.5) * spanX;
        const y = (cy / (rows - 1) - 0.5) * spanY;
        // Only the outer shell, so the corridor stays open.
        if (Math.abs(x) < spanX * 0.28 && Math.abs(y) < spanY * 0.28) {
          continue;
        }
        const a = randRange(cx * 31 + cy, 70, 0.06, 0.26);
        push(x, y, zStart, x, y, zEnd, a);
      }
    }
    for (let z = zStart; z <= zEnd; z += ringSpacing) {
      const a = 0.12;
      const hx = spanX / 2;
      const hy = spanY / 2;
      push(-hx, -hy, z, hx, -hy, z, a);
      push(-hx, hy, z, hx, hy, z, a);
      push(-hx, -hy, z, -hx, hy, z, a);
      push(hx, -hy, z, hx, hy, z, a);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    const material = additiveLineMaterial(0xffffff, 1);
    material.vertexColors = true;
    latticeGroup.add(new THREE.LineSegments(geometry, material));
    scene.add(latticeGroup);
  }

  // --- dust ------------------------------------------------------------
  const dust = new THREE.Points(
    (() => {
      const geometry = new THREE.BufferGeometry();
      // Two stacked copies, one loop apart: translating the cloud by
      // LOOP_DEPTH lands copy 2 exactly where copy 1 started, so the
      // dust wraps without a single particle popping.
      const positions = new Float32Array(DUST_COUNT * 2 * 3);
      for (let i = 0; i < DUST_COUNT; i++) {
        const angle = rand(i, 80) * Math.PI * 2;
        const radius = randRange(i, 81, 2, 30);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.6;
        const z = -rand(i, 82) * LOOP_DEPTH;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        const j = DUST_COUNT + i;
        positions[j * 3] = x;
        positions[j * 3 + 1] = y;
        positions[j * 3 + 2] = z - LOOP_DEPTH;
      }
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      return geometry;
    })(),
    new THREE.PointsMaterial({
      map: dotTexture,
      size: 0.075,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  scene.add(dust);

  const bands = BAND_BLUR.map((blur, layer) => ({
    layer,
    blurPx: blur * scale,
    opacity: 1,
  }));

  const update = (frame: number) => {
    const progress = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
    const tau = progress * Math.PI * 2;

    // A slow lateral glide and roll, all at loop-period so the camera
    // returns exactly to its start.
    camera.position.x = Math.sin(tau) * 1.7;
    camera.position.y = Math.cos(tau * 2) * 0.85;
    camera.rotation.z = Math.sin(tau) * 0.04;
    camera.rotation.y = Math.sin(tau * 2) * 0.018;
    camera.rotation.x = Math.cos(tau) * 0.012;

    for (const drifter of drifters) {
      const z = -LOOP_DEPTH + wrap(drifter.z0 + progress * LOOP_DEPTH, LOOP_DEPTH);
      const distance = -z;
      drifter.object.position.z = z;
      // Set, never accumulate: update() runs once per frame but frames
      // are not visited in order, so a += here would drift.
      drifter.object.position.y =
        drifter.y0 + Math.sin(tau + drifter.bobPhase) * drifter.bob;
      if (drifter.spin !== 0) {
        drifter.object.rotation.z =
          Math.sin(tau + drifter.spinPhase) * drifter.spin;
      }
      drifter.material.opacity =
        drifter.baseOpacity * fadeWindow(distance, 0, LOOP_DEPTH, 7, 18);
      drifter.object.layers.set(bandFor(distance));
    }

    latticeGroup.position.z = progress * LOOP_DEPTH;
    latticeGroup.children[0].layers.set(FOCUS);

    dust.position.z = progress * LOOP_DEPTH;
    dust.layers.set(FOCUS);

  };

  const dispose = () => {
    for (const sheet of sheets) {
      sheet.dispose();
    }
    disposeScene(scene);
  };

  return { scene, camera, bands, update, dispose };
};
