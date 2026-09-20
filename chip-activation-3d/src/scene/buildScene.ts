import * as THREE from 'three/webgpu';
import type { Theme } from '../themes';
import { computeFrameState } from '../timeline';
import { createBoard } from './board';
import { createCamera } from './camera';
import { createChip, createChipShadow } from './chip';
import { createEnergy } from './energy';
import { createLighting } from './lighting';
import { createParts } from './parts';
import { createPost } from './post';
import { createSocket } from './socket';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  post: THREE.RenderPipeline | null;
  /** Tone-mapping exposure for the current frame. */
  exposure: number;
  update: (seconds: number) => void;
  dispose: () => void;
}

export interface BuildSceneOptions {
  theme: Theme;
  renderer: THREE.WebGPURenderer;
  width: number;
  height: number;
  textureSize: number;
  enablePost: boolean;
  /** Diagnostics: truncate the post chain after this stage index. */
  postStopAfter?: number;
}

/**
 * Vertical gradient backdrop, so the far field is never a flat clear colour.
 *
 * This texture is used twice: directly as `scene.background`, and — after
 * being run through PMREM — as `scene.environment`. Assigning the raw
 * texture as the environment is not enough: metals sample the environment
 * by roughness across pre-filtered mips, and an unfiltered canvas texture
 * gives them nothing to sample, so every metallic surface (the socket
 * frame, the heat spreader, the pin headers) renders near-black.
 */
const createBackdrop = (theme: Theme) => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, theme.background[0]);
  g.addColorStop(1, theme.background[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
};

export const buildScene = (opts: BuildSceneOptions): SceneBundle => {
  const { theme, renderer, width, height, textureSize, enablePost, postStopAfter } = opts;

  const scene = new THREE.Scene();
  const backdrop = createBackdrop(theme);
  scene.background = backdrop;

  // Pre-filtered version of the same gradient. This is most of what sells
  // the metal on the socket and the glass parts in V2.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(backdrop);
  scene.environment = envRT.texture;
  pmrem.dispose();
  scene.environmentIntensity = theme.id === 'v2' ? 1.15 : 0.55;
  scene.fog = new THREE.Fog(new THREE.Color(theme.fog.color), theme.fog.near, theme.fog.far);

  const rig = createCamera(theme, width / height);
  const lighting = createLighting(theme);
  const board = createBoard(theme, textureSize);
  const parts = createParts(theme);
  const socket = createSocket(theme, textureSize);
  const chip = createChip(theme, textureSize);
  const chipShadow = createChipShadow(theme);
  const energy = createEnergy(theme);

  scene.add(lighting.group);
  scene.add(board.group);
  scene.add(parts.group);
  scene.add(socket.group);
  scene.add(chipShadow.mesh);
  scene.add(chip.group);
  scene.add(energy.group);

  const post = enablePost ? createPost(renderer, scene, rig.camera, theme, postStopAfter) : null;

  let exposure = theme.post.exposure;

  return {
    scene,
    camera: rig.camera,
    post: post?.post ?? null,
    get exposure() {
      return exposure;
    },

    update: (seconds: number) => {
      const s = computeFrameState(theme, seconds);
      // Kept for the no-post path; with post the grade owns exposure.
      exposure = s.exposure;

      rig.update(s);
      lighting.update(s);
      board.update(s);
      parts.update(s);
      socket.update(s);
      chip.update(s);
      chipShadow.update(s);
      energy.update(s, rig.camera);
      post?.update(s, rig.focusDistance());
    },

    dispose: () => {
      post?.dispose();
      energy.dispose();
      chipShadow.dispose();
      chip.dispose();
      socket.dispose();
      parts.dispose();
      board.dispose();
      lighting.dispose();
      envRT.dispose();
      backdrop.dispose();
    },
  };
};
