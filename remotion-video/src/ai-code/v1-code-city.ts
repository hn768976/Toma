import * as THREE from "three";
import { DURATION_IN_FRAMES } from "./constants";
import { monoFontReady } from "./fonts";
import { createCodeSheet } from "./code-canvas";
import { createChipTexture, createDotTexture, type ChipVariant } from "./textures";
import {
  additive,
  disposeScene,
  makeCanvasTexture,
  quad,
  subTexture,
} from "./scene-kit";
import { rand, randRange, wrap } from "./rng";
import type { ThemeName } from "./code-canvas";
import type { Stage, StageContext } from "./ThreeStage";

// The shared code-plate stage, behind V1, V4 and V5: a column of
// identical "AI" cards rising through frame over a quiet bed of
// scrolling code. V4 drops the cards; V5 recolours the code.
//
// Two independent loops, both exact:
//   - the cards travel RISE_DISTANCE upward and wrap, and because they
//     wrap well outside the frame they need no fade to hide the join;
//   - the background code scrolls inside its panels by whole texture
//     repeats, so the panels themselves never move and nothing has to
//     dissolve at an edge.
//
// Depth bands are assigned once at build time rather than per frame.
// Nothing here changes depth, so a fixed assignment is both cheaper and
// safer: an object re-banded mid-flight would snap between blur levels.

const RISE_DISTANCE = 34;

// Every card sits on one plane at one size, so they all read at exactly
// the same scale on screen.
const CARD_PLANE_Z = -20;
const CARD_SIZE = 3.4;
const CARD_COUNT = 12;
const CARD_SPREAD_X = 13;

const PANEL_COUNT = 28;
const PANEL_NEAR_Z = 26;
const PANEL_FAR_Z = 50;
const DUST_COUNT = 700;
const SHEET_COUNT = 6;

const CARD_BAND = 0;
const BG_NEAR_BAND = 1;
const BG_FAR_BAND = 2;
const BAND_BLUR = [0, 1.2, 5];
const BG_BAND_SPLIT_Z = 37;

const CHIP_VARIANTS: readonly ChipVariant[] = [
  "glass",
  "particle",
  "ray",
  "wire",
];

type Card = {
  readonly object: THREE.Object3D;
  readonly baseX: number;
  readonly y0: number;
  readonly swayAmplitude: number;
  readonly swayPhase: number;
  readonly tilt: number;
};

type Panel = {
  readonly map: THREE.Texture;
  readonly material: THREE.MeshBasicMaterial;
  /**
   * Whole UV units travelled per loop, signed for direction. It must be
   * a whole number: texture wrapping is modulo 1 in UV, so any
   * fractional total leaves the panel offset at the loop point. How fast
   * that reads on screen still varies per panel, because a panel
   * showing `repeat.y` repeats moves its content 1/repeat.y of its own
   * height per UV unit.
   */
  readonly scrollRate: number;
  readonly scrollOffset: number;
  readonly baseOpacity: number;
  readonly breathPhase: number;
};

export type CodePlateOptions = {
  /** V4 turns the rising cards off and keeps only the code bed. */
  readonly showCards: boolean;
  /** V5 swaps the syntax palette to green. */
  readonly codeTheme: ThemeName;
};

export const createCodePlateStage =
  (options: CodePlateOptions) =>
  async (ctx: StageContext): Promise<Stage> => {
  await monoFontReady;
  const { scale } = ctx;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 36, 66);

  const camera = ctx.makeCamera(45, 0.5, 80);

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
          theme: options.codeTheme,
          alpha: i % 3 === 0 ? 1 : 0.85,
          highlightRate: 0.05,
          paintBackground: false,
        }),
        true,
      ),
    );
  }
  const chipTextures = options.showCards
    ? CHIP_VARIANTS.map((variant, i) =>
        makeCanvasTexture(
          createChipTexture(Math.round(384 * scale), variant, 60 + i),
        ),
      )
    : [];
  const dotTexture = makeCanvasTexture(createDotTexture(Math.round(64 * scale)));

  // --- background code bed ---------------------------------------------
  const panels: Panel[] = [];
  for (let i = 0; i < PANEL_COUNT; i++) {
    const sheet = sheets[i % SHEET_COUNT];
    const repeatX = randRange(i, 20, 0.5, 1.05);
    const repeatY = randRange(i, 21, 1, 2.2);
    const map = subTexture(sheet, randRange(i, 22, 0, 1), 0, repeatX, repeatY);

    const width = randRange(i, 24, 10, 26);
    const height = (width * repeatY) / repeatX;
    const material = additive(map, 1);
    const mesh = quad(material, width, height);

    const z = -randRange(i, 25, PANEL_NEAR_Z, PANEL_FAR_Z);
    mesh.position.set(
      randRange(i, 26, -32, 32),
      randRange(i, 27, -16, 16),
      z,
    );
    mesh.rotation.y = randRange(i, 28, -0.22, 0.22);
    mesh.rotation.z = randRange(i, 29, -0.03, 0.03);
    mesh.layers.set(-z < BG_BAND_SPLIT_Z ? BG_NEAR_BAND : BG_FAR_BAND);
    scene.add(mesh);

    panels.push({
      map,
      material,
      scrollRate:
        (rand(i, 30) < 0.5 ? -1 : 1) * (1 + Math.floor(rand(i, 31) * 2)),
      scrollOffset: rand(i, 32),
      baseOpacity: randRange(i, 33, 0.38, 0.9),
      breathPhase: rand(i, 34) * Math.PI * 2,
    });
  }

  // --- rising AI cards --------------------------------------------------
  const cards: Card[] = [];
  for (let i = 0; options.showCards && i < CARD_COUNT; i++) {
    const material = additive(chipTextures[i % chipTextures.length], 1);
    material.opacity = randRange(i, 40, 0.85, 1);
    const baseX = randRange(i, 41, -CARD_SPREAD_X, CARD_SPREAD_X);
    const mesh = quad(material, CARD_SIZE, CARD_SIZE);
    mesh.position.set(baseX, 0, CARD_PLANE_Z);
    mesh.layers.set(CARD_BAND);
    scene.add(mesh);

    cards.push({
      object: mesh,
      baseX,
      // Evenly spaced along the travel, with a little jitter so the
      // column does not read as a metronome.
      y0:
        ((i + randRange(i, 42, -0.28, 0.28)) / CARD_COUNT) * RISE_DISTANCE,
      swayAmplitude: randRange(i, 43, 0.15, 0.6),
      swayPhase: rand(i, 44) * Math.PI * 2,
      tilt: randRange(i, 45, 0.02, 0.07),
    });
  }

  // --- dust -------------------------------------------------------------
  // Two stacked copies one rise apart, so translating by RISE_DISTANCE
  // lands copy 2 exactly where copy 1 started.
  const dustGeometry = new THREE.BufferGeometry();
  {
    const positions = new Float32Array(DUST_COUNT * 2 * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      const x = randRange(i, 80, -26, 26);
      const y = rand(i, 81) * RISE_DISTANCE - RISE_DISTANCE / 2;
      const z = -randRange(i, 82, 16, 46);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const j = DUST_COUNT + i;
      positions[j * 3] = x;
      positions[j * 3 + 1] = y - RISE_DISTANCE;
      positions[j * 3 + 2] = z;
    }
    dustGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
  }
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      map: dotTexture,
      size: 0.075,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  dust.layers.set(BG_NEAR_BAND);
  scene.add(dust);

  // The band list need not be contiguous: each entry names the layer it
  // draws. With no cards there is nothing on the card layer, so omitting
  // it saves a whole render pass per frame rather than compositing an
  // empty buffer.
  const bands = BAND_BLUR.map((blur, layer) => ({
    layer,
    blurPx: blur * scale,
    opacity: 1,
  })).filter((band) => options.showCards || band.layer !== CARD_BAND);

  const update = (frame: number) => {
    const progress = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
    const tau = progress * Math.PI * 2;

    // A very small drift only — the motion in this plate belongs to the
    // cards, not the camera.
    camera.position.x = Math.sin(tau) * 0.45;
    camera.position.y = Math.cos(tau) * 0.3;
    camera.rotation.z = Math.sin(tau) * 0.008;

    for (const panel of panels) {
      panel.map.offset.y = panel.scrollOffset + progress * panel.scrollRate;
      panel.material.opacity =
        panel.baseOpacity *
        (0.78 + 0.22 * Math.sin(tau + panel.breathPhase));
    }

    for (const card of cards) {
      card.object.position.y =
        -RISE_DISTANCE / 2 +
        wrap(card.y0 + progress * RISE_DISTANCE, RISE_DISTANCE);
      // Set from the stored base, never accumulated: Remotion does not
      // visit frames in order.
      card.object.position.x =
        card.baseX + Math.sin(tau + card.swayPhase) * card.swayAmplitude;
      card.object.rotation.z = Math.sin(tau + card.swayPhase) * card.tilt;
    }

    dust.position.y = progress * RISE_DISTANCE;
  };

  const dispose = () => {
    for (const sheet of sheets) {
      sheet.dispose();
    }
    disposeScene(scene);
  };

  return { scene, camera, bands, update, dispose };
};
