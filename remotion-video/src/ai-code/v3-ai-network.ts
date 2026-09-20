import * as THREE from "three";
import { DURATION_IN_FRAMES } from "./constants";
import { monoFontReady } from "./fonts";
import { createCodeSheet } from "./code-canvas";
import { createLetterTexture, createNodeTexture } from "./textures";
import {
  additive,
  additiveLineMaterial,
  disposeScene,
  makeCanvasTexture,
  quad,
  subTexture,
} from "./scene-kit";
import { rand, randRange, smoothstep } from "./rng";
import type { Stage, StageContext } from "./ThreeStage";

// V3 — "AI network": dim code panels underneath, an interconnected graph
// of "AI" nodes floating over them, and oversized defocused lettering
// drifting past the lens. The moodiest of the three, and the one built
// to sit behind text.
//
// Nothing here scrolls. Every motion is a Lissajous figure on integer
// harmonics of the clip length, so the whole plate returns to its
// starting state exactly at the loop point.

const PANEL_COUNT = 34;
const NODE_COUNT = 30;
const EDGES_PER_NODE = 2;
const LETTER_COUNT = 5;
const SHEET_COUNT = 5;

const NEAR_BAND = 0;
const FOCUS_BAND = 1;
const FAR_BAND = 2;
const BAND_BLUR = [30, 0.4, 9];
const NEAR_EDGE = 11;
const FAR_EDGE = 33;

const bandFor = (distance: number) =>
  distance < NEAR_EDGE
    ? NEAR_BAND
    : distance < FAR_EDGE
      ? FOCUS_BAND
      : FAR_BAND;

type Wanderer = {
  readonly object: THREE.Object3D;
  readonly material: THREE.MeshBasicMaterial;
  readonly base: THREE.Vector3;
  readonly amplitude: THREE.Vector3;
  readonly harmonics: THREE.Vector3;
  readonly phase: THREE.Vector3;
  readonly baseOpacity: number;
};

const wanderPosition = (w: Wanderer, tau: number, out: THREE.Vector3) =>
  out.set(
    w.base.x + Math.sin(tau * w.harmonics.x + w.phase.x) * w.amplitude.x,
    w.base.y + Math.sin(tau * w.harmonics.y + w.phase.y) * w.amplitude.y,
    w.base.z + Math.sin(tau * w.harmonics.z + w.phase.z) * w.amplitude.z,
  );

export const createAiNetworkStage = async (
  ctx: StageContext,
): Promise<Stage> => {
  await monoFontReady;
  const { scale } = ctx;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 30, 58);

  const camera = ctx.makeCamera(46, 0.5, 70);

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
          seed: 900 + i,
          theme: "muted",
          alpha: i % 2 === 0 ? 0.95 : 0.7,
          highlightRate: 0.04,
          paintBackground: false,
        }),
        true,
      ),
    );
  }
  const nodeTextures = [false, true].map((wire) =>
    makeCanvasTexture(createNodeTexture(Math.round(256 * scale), wire)),
  );
  const letterTexture = makeCanvasTexture(
    createLetterTexture(Math.round(768 * scale)),
  );

  const wanderers: Wanderer[] = [];

  const addWanderer = (
    object: THREE.Object3D,
    material: THREE.MeshBasicMaterial,
    index: number,
    salt: number,
    amplitude: THREE.Vector3,
    baseOpacity: number,
  ): Wanderer => {
    const w: Wanderer = {
      object,
      material,
      base: object.position.clone(),
      amplitude,
      // Integer harmonics only: any other frequency would not come back
      // round at the loop point.
      harmonics: new THREE.Vector3(
        1 + Math.floor(rand(index, salt) * 2),
        1 + Math.floor(rand(index, salt + 1) * 3),
        1,
      ),
      phase: new THREE.Vector3(
        rand(index, salt + 2) * Math.PI * 2,
        rand(index, salt + 3) * Math.PI * 2,
        rand(index, salt + 4) * Math.PI * 2,
      ),
      baseOpacity,
    };
    scene.add(object);
    wanderers.push(w);
    return w;
  };

  // --- dim code bed -----------------------------------------------------
  for (let i = 0; i < PANEL_COUNT; i++) {
    const sheet = sheets[i % SHEET_COUNT];
    const repeatX = randRange(i, 10, 1.15, 2.3);
    const repeatY = randRange(i, 11, 0.95, 1.9);
    const map = subTexture(
      sheet,
      randRange(i, 12, 0, 1),
      randRange(i, 13, 0, 1),
      repeatX,
      repeatY,
    );
    const width = randRange(i, 14, 14, 32);
    const material = additive(map, 1);
    const mesh = quad(material, width, (width * repeatY) / repeatX);
    mesh.position.set(
      randRange(i, 15, -30, 30),
      randRange(i, 16, -18, 18),
      -randRange(i, 17, 18, 50),
    );
    mesh.rotation.y = randRange(i, 18, -0.34, 0.34);
    mesh.rotation.z = randRange(i, 19, -0.05, 0.05);
    addWanderer(
      mesh,
      material,
      i,
      100,
      new THREE.Vector3(
        randRange(i, 20, 0.3, 1.4),
        randRange(i, 21, 0.3, 1.6),
        randRange(i, 22, 0.4, 1.8),
      ),
      randRange(i, 23, 0.16, 0.42),
    );
  }

  // --- network nodes ----------------------------------------------------
  const nodes: Wanderer[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const material = additive(nodeTextures[i % 2 === 0 ? 0 : 1], 1);
    const size = randRange(i, 30, 1.3, 2.9);
    const mesh = quad(material, size, size);
    mesh.position.set(
      randRange(i, 31, -26, 26),
      randRange(i, 32, -15, 15),
      -randRange(i, 33, 11, 31),
    );
    nodes.push(
      addWanderer(
        mesh,
        material,
        i,
        200,
        new THREE.Vector3(
          randRange(i, 34, 0.8, 2.6),
          randRange(i, 35, 0.8, 2.6),
          randRange(i, 36, 0.5, 2),
        ),
        randRange(i, 37, 0.5, 0.9),
      ),
    );
  }

  // Edges are fixed pairs chosen from the rest positions. Re-deciding
  // connectivity per frame would make links blink as nodes cross each
  // other; fixing the pairs and fading them by current length does not.
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const distances = nodes
      .map((n, j) => ({ j, d: n.base.distanceTo(nodes[i].base) }))
      .filter((entry) => entry.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, EDGES_PER_NODE);
    for (const { j } of distances) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([i, j]);
      }
    }
  }

  const edgePositions = new Float32Array(pairs.length * 6);
  const edgeColors = new Float32Array(pairs.length * 8);
  const edgeGeometry = new THREE.BufferGeometry();
  const edgePositionAttribute = new THREE.BufferAttribute(edgePositions, 3);
  const edgeColorAttribute = new THREE.BufferAttribute(edgeColors, 4);
  edgePositionAttribute.setUsage(THREE.DynamicDrawUsage);
  edgeColorAttribute.setUsage(THREE.DynamicDrawUsage);
  edgeGeometry.setAttribute("position", edgePositionAttribute);
  edgeGeometry.setAttribute("color", edgeColorAttribute);
  const edgeMaterial = additiveLineMaterial(0xffffff, 1);
  edgeMaterial.vertexColors = true;
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.frustumCulled = false;
  scene.add(edges);

  // --- oversized defocused lettering -----------------------------------
  const letters: Wanderer[] = [];
  for (let i = 0; i < LETTER_COUNT; i++) {
    const material = additive(letterTexture, 1);
    const width = randRange(i, 40, 3.6, 8);
    const mesh = quad(material, width, width * 0.6);
    mesh.position.set(
      randRange(i, 41, -12, 12),
      randRange(i, 42, -7, 7),
      -randRange(i, 43, 5, 10.5),
    );
    mesh.rotation.z = randRange(i, 44, -0.1, 0.1);
    letters.push(
      addWanderer(
        mesh,
        material,
        i,
        300,
        new THREE.Vector3(
          randRange(i, 45, 5, 11),
          randRange(i, 46, 1.5, 4),
          randRange(i, 47, 0.5, 1.5),
        ),
        randRange(i, 48, 0.22, 0.5),
      ),
    );
  }

  const bands = BAND_BLUR.map((blur, layer) => ({
    layer,
    blurPx: blur * scale,
    opacity: 1,
  }));

  const scratch = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  const update = (frame: number) => {
    const progress = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
    const tau = progress * Math.PI * 2;

    camera.position.x = Math.sin(tau) * 1.2;
    camera.position.y = Math.cos(tau) * 0.7;
    camera.rotation.z = Math.sin(tau) * 0.02;
    camera.rotation.y = Math.sin(tau * 2) * 0.012;

    for (const w of wanderers) {
      wanderPosition(w, tau, scratch);
      w.object.position.copy(scratch);
      w.material.opacity = w.baseOpacity;
      w.object.layers.set(bandFor(-scratch.z));
    }

    // Letters pulse as they sweep the lens, which is what sells them as
    // out-of-focus foreground rather than flat overlay.
    letters.forEach((letter, i) => {
      letter.material.opacity =
        letter.baseOpacity *
        (0.45 + 0.55 * Math.sin(tau * (1 + (i % 2)) + i) ** 2);
    });

    for (let i = 0; i < pairs.length; i++) {
      const [p, q] = pairs[i];
      a.copy(nodes[p].object.position);
      b.copy(nodes[q].object.position);
      edgePositions[i * 6] = a.x;
      edgePositions[i * 6 + 1] = a.y;
      edgePositions[i * 6 + 2] = a.z;
      edgePositions[i * 6 + 3] = b.x;
      edgePositions[i * 6 + 4] = b.y;
      edgePositions[i * 6 + 5] = b.z;
      // Long links fade out, so the graph reads as proximity rather
      // than a fixed cat's cradle.
      const alpha = 0.46 * (1 - smoothstep(9, 21, a.distanceTo(b)));
      for (let k = 0; k < 2; k++) {
        edgeColors[i * 8 + k * 4] = 0.44;
        edgeColors[i * 8 + k * 4 + 1] = 0.86;
        edgeColors[i * 8 + k * 4 + 2] = 0.83;
        edgeColors[i * 8 + k * 4 + 3] = alpha;
      }
    }
    edgePositionAttribute.needsUpdate = true;
    edgeColorAttribute.needsUpdate = true;
    edges.layers.set(FOCUS_BAND);
  };

  const dispose = () => {
    for (const sheet of sheets) {
      sheet.dispose();
    }
    disposeScene(scene);
  };

  return { scene, camera, bands, update, dispose };
};
