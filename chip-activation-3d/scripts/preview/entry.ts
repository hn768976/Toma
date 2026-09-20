/**
 * Standalone preview entry — the same scene code the compositions use, but
 * driven directly in a page instead of through Remotion. Used by
 * `scripts/preview.mjs` to shoot look-development frames quickly and to
 * separate three.js problems from render-pipeline problems.
 */
import { createStage } from '../../src/engine/stage';
import { THEMES, type VersionId } from '../../src/themes';

interface ShootOptions {
  version: VersionId;
  width: number;
  height: number;
  textureSize: number;
  post: boolean;
  forceWebGL: boolean;
  postStopAfter?: number;
}

declare global {
  interface Window {
    setup: (opts: ShootOptions) => Promise<string>;
    shoot: (seconds: number) => Promise<number>;
  }
}

let stage: Awaited<ReturnType<typeof createStage>> | null = null;
let outputCanvas: HTMLCanvasElement | null = null;

/** Builds the renderer and scene once; `shoot()` then draws individual frames. */
window.setup = async ({ version, width, height, textureSize, post, forceWebGL, postStopAfter }) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  outputCanvas = canvas;

  stage = await createStage({
    canvas,
    theme: THEMES[version],
    width,
    height,
    textureSize,
    enablePost: post,
    forceWebGL,
    postStopAfter,
  });
  return stage.backend;
};

/** Draws one frame and returns how long it took, in milliseconds. */
window.shoot = async (seconds) => {
  if (!stage || !outputCanvas) throw new Error('setup() has not run');
  const started = performance.now();
  await stage.renderFrame(seconds);
  return performance.now() - started;
};
