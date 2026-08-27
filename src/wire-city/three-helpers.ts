/**
 * three-helpers.ts — tiny shared utilities for the scene.
 *
 * Note on colour: `new THREE.Color(hex)` converts sRGB -> linear working
 * space because THREE.ColorManagement is enabled by default. Every raw
 * rgb triple we hand to a shader or a vertex-colour buffer therefore has to
 * come from a THREE.Color, never from parsing the hex by hand, or the whole
 * scene comes out too bright.
 */

import {Color, Vector2, type WebGLRenderer} from 'three';

export const toLinearRGB = (hex: string): [number, number, number] => {
	const c = new Color(hex);
	return [c.r, c.g, c.b];
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const mixRGB = (
	a: [number, number, number],
	b: [number, number, number],
	t: number,
): [number, number, number] => [
	lerp(a[0], b[0], t),
	lerp(a[1], b[1], t),
	lerp(a[2], b[2], t),
];

/**
 * Reference height the pixel-authored sizes in `variants.ts` are written
 * against, so a `--scale=0.5` preview is an honest preview of the 4K render.
 */
export const REFERENCE_HEIGHT = 2160;

const _bufferSize = new Vector2();

/**
 * Drawing-buffer size at DRAW time.
 *
 * GOTCHA: reading the buffer size during React render and poking it into a
 * uniform does not work under Remotion. <ThreeCanvas> sets the canvas size in
 * a layout effect, so the first commit sees a stale (often zero) size, and
 * the once-per-frame `advance()` can fire before the corrected value has been
 * committed — leaving LineMaterial with a bogus `resolution` and the ground
 * dots one-third brightness and one pixel wide, i.e. invisible.
 *
 * Reading it from an `onBeforeRender` hook sidesteps React entirely: three
 * calls it immediately before the draw, when the renderer is guaranteed to
 * know its real size.
 */
export const getDrawingBufferSize = (renderer: WebGLRenderer): Vector2 =>
	renderer.getDrawingBufferSize(_bufferSize);
