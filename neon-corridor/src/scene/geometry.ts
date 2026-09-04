import {BoxGeometry, BufferGeometry} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {HALF_WIDTH, HEIGHT_UNITS, TUBE_THICKNESS as T} from '../config';

/**
 * The arch of one neon rectangle — top bar plus both uprights — merged into a
 * single geometry so the whole tunnel costs one draw call per frame rather
 * than four. Bars have real thickness; these are tubes, not hairlines.
 */
export const makeFrameArchGeometry = (): BufferGeometry => {
	const w = HALF_WIDTH * 2;
	const h = HEIGHT_UNITS;

	const top = new BoxGeometry(w + T, T, T).translate(0, h, 0);
	const left = new BoxGeometry(T, h, T).translate(-HALF_WIDTH, h / 2, 0);
	const right = new BoxGeometry(T, h, T).translate(HALF_WIDTH, h / 2, 0);

	const merged = mergeGeometries([top, left, right], false);
	[top, left, right].forEach((g) => g.dispose());
	if (!merged) throw new Error('Failed to merge neon frame geometry');
	return merged;
};

/**
 * The bottom bar, kept separate so it can be driven much dimmer than the rest
 * of the rectangle.
 *
 * In the reference these read as a faint ladder along the floor, nowhere near
 * the clipped white of the uprights — and that matters more than it sounds:
 * at full brightness the bar of the frame currently sweeping past the camera
 * lands across the bottom third and takes over the shot.
 *
 * It sits just *on* the floor, so its mirror image kisses it and gives the
 * corridor its floor line.
 */
export const makeFrameBaseGeometry = (): BufferGeometry =>
	new BoxGeometry(HALF_WIDTH * 2 + T, T, T).translate(0, T / 2, 0);

/**
 * A floor-to-ceiling wall strip. These sit between the rectangles on the left
 * and right walls; without them the corridor reads as floating rectangles
 * rather than a tunnel.
 */
export const makeStripGeometry = (): BufferGeometry =>
	new BoxGeometry(T, HEIGHT_UNITS - T, T).translate(0, HEIGHT_UNITS / 2, 0);
