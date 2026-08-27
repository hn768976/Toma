import {random} from 'remotion';

/**
 * Pre-rendered monochrome noise tiles. Built once per page and reused for every
 * frame; three tiles plus a per-frame offset keep the grain from visibly
 * repeating. Values come from Remotion's seeded `random`, never Math.random.
 */

const SIZE = 256;
const TILES = 3;

let cache: HTMLCanvasElement[] | null = null;

export const grainTiles = (): HTMLCanvasElement[] => {
	if (cache) return cache;
	cache = Array.from({length: TILES}, (_, k) => {
		const canvas = document.createElement('canvas');
		canvas.width = SIZE;
		canvas.height = SIZE;
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
		const img = ctx.createImageData(SIZE, SIZE);
		const d = img.data;
		for (let i = 0; i < SIZE * SIZE; i++) {
			// Bias toward mid-grey so `overlay` compositing neither lifts nor
			// crushes the picture on average.
			const v = Math.round(96 + random(`grain-${k}-${i}`) * 118);
			const o = i * 4;
			d[o] = v;
			d[o + 1] = v;
			d[o + 2] = v;
			d[o + 3] = 255;
		}
		ctx.putImageData(img, 0, 0);
		return canvas;
	});
	return cache;
};

export const GRAIN_TILE_SIZE = SIZE;
