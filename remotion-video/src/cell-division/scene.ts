// Builds the three.js scene and drives it from a frame number.
//
// setFrame() is a pure jump: it never reads the previously rendered frame,
// so Remotion workers can render frames in any order and still agree.

import * as THREE from "three/webgpu";
import {
  MAX_CELL_COUNT,
  buildColony,
  cellPosition,
  cellRadius,
  expansion,
  isAlive,
  type Cell,
} from "./colony";
import { FPS, DURATION_IN_SECONDS } from "./constants";
import { FUZZ_MARGIN, createCellMaterial } from "./cellMaterial";
import { createBackgroundNode } from "./background";
import type { Theme } from "./themes";

const FOV = 34;

/**
 * Camera dolly. It starts close on the single cell and eases back as the
 * colony swells -- but deliberately slower than the swell, so the frame
 * keeps filling and, by the end, cells drift past the lens and smear.
 */
// Sized against the reference: a single cell reads about a fifth of the
// frame height at t=0, and a mid-depth cell about an eighth at the end.
const CAM_Z_START = 8.4;
const CAM_Z_END = 12.8;

/**
 * The focal plane rides just in front of whatever the camera is aimed at,
 * so the cells at the heart of the colony stay crisp while everything
 * nearer and further falls away.
 */
const FOCUS_OFFSET = -0.35;

/** Defocus strength, ramped up as the colony closes in around the lens. */
const BLUR_START = 0.17;
const BLUR_END = 0.42;

/** Cells nearer than this fade out rather than pop as the camera passes them. */
const NEAR_FADE_IN = 0.9;
const NEAR_FADE_OUT = 3.4;

const easeInOutCubic = (u: number) =>
  u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type CellScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  setFrame: (frame: number) => void;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
};

export const createCellScene = (theme: Theme, seed: number): CellScene => {
  const cells = buildColony(seed);

  const scene = new THREE.Scene();
  const background = createBackgroundNode(theme);
  scene.backgroundNode = background.node;

  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 400);

  const { material, uniforms } = createCellMaterial(theme);

  // One 2x2 quad, instanced per live cell. Quad-local xy therefore runs
  // -1..1, which the material reads directly as the sphere coordinate.
  const base = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.getAttribute("position"));
  geometry.setAttribute("uv", base.getAttribute("uv"));

  const centers = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_CELL_COUNT * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  const params = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_CELL_COUNT * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aCenter", centers);
  geometry.setAttribute("aParams", params);
  geometry.instanceCount = 0;

  const mesh = new THREE.Mesh(geometry, material);
  // The quads are built in view space in the vertex shader, so three's
  // own bounds and culling would be meaningless here.
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Scratch, reused every frame so setFrame() allocates nothing.
  const pos: [number, number, number] = [0, 0, 0];
  const target = new THREE.Vector3();
  const live: { x: number; y: number; z: number; r: number; seed: number; d: number; fade: number }[] =
    Array.from({ length: MAX_CELL_COUNT }, () => ({
      x: 0, y: 0, z: 0, r: 0, seed: 0, d: 0, fade: 0,
    }));
  const order: number[] = Array.from({ length: MAX_CELL_COUNT }, (_, i) => i);

  const setFrame = (frame: number) => {
    const t = frame / FPS;
    const progress = Math.min(1, t / DURATION_IN_SECONDS);
    const eased = easeInOutCubic(progress);

    const camZ = CAM_Z_START + (CAM_Z_END - CAM_Z_START) * eased;
    // A slow lateral drift gives parallax between near and far cells --
    // without it the push-in alone reads as a zoom rather than a move.
    camera.position.set(
      Math.sin(t * 0.17) * 0.75,
      0.2 + Math.sin(t * 0.13 + 1.2) * 0.5,
      camZ,
    );
    target.set(
      Math.sin(t * 0.11 + 2.1) * 0.5,
      Math.sin(t * 0.09) * 0.4,
      0,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld(true);

    // Focus is a true camera-to-subject distance, not the dolly value --
    // the lateral drift means those are not the same number.
    const focus = camera.position.distanceTo(target) + FOCUS_OFFSET;
    uniforms.focus.value = focus;
    uniforms.blur.value = BLUR_START + (BLUR_END - BLUR_START) * progress;
    // Haze has to start further out as the colony grows, or the whole
    // frame washes to fog colour in the last seconds.
    uniforms.fogStart.value = focus + 0.7 * expansion(t);

    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    let count = 0;
    for (let i = 0; i < cells.length; i++) {
      const cell: Cell = cells[i];
      if (!isAlive(cell, t)) continue;

      cellPosition(cell, t, pos);
      const d = Math.hypot(pos[0] - cx, pos[1] - cy, pos[2] - cz);
      const fade = smoothstep(NEAR_FADE_IN, NEAR_FADE_OUT, d);
      if (fade <= 0.001) continue;

      const slot = live[count];
      slot.x = pos[0];
      slot.y = pos[1];
      slot.z = pos[2];
      slot.r = cellRadius(cell, t);
      slot.seed = cell.seed;
      slot.d = d;
      slot.fade = fade;
      order[count] = count;
      count++;
      if (count >= MAX_CELL_COUNT) break;
    }

    // Back-to-front. The cells are alpha-blended with depth testing off,
    // so draw order *is* the occlusion.
    const active = order.slice(0, count);
    active.sort((a, b) => live[b].d - live[a].d);

    const cArr = centers.array as Float32Array;
    const pArr = params.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const s = live[active[i]];
      cArr[i * 3] = s.x;
      cArr[i * 3 + 1] = s.y;
      cArr[i * 3 + 2] = s.z;
      pArr[i * 3] = s.r;
      pArr[i * 3 + 1] = s.seed;
      pArr[i * 3 + 2] = s.fade;
    }

    centers.needsUpdate = true;
    params.needsUpdate = true;
    geometry.instanceCount = count;
  };

  const setSize = (width: number, height: number) => {
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    background.setAspect(aspect);
  };

  const dispose = () => {
    base.dispose();
    geometry.dispose();
    material.dispose();
  };

  return { scene, camera, setFrame, setSize, dispose };
};

export { FUZZ_MARGIN };
