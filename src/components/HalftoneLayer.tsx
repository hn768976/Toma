import React, {useLayoutEffect, useRef} from 'react';
import {random} from 'remotion';
import {useDash} from '../context';
import {mix, shade} from '../lib/canvas';
import {GRAIN_TILE_SIZE, grainTiles} from '../lib/grain';
import {ORB} from '../lib/layout';
import {cameraDrift, TAU} from '../lib/motion';
import {LayerKey, resetScene, Scene} from '../lib/scene';
import {DOT_PITCH, Variant} from '../variants';

/**
 * Tone curve for the dot screen's luminance -> radius mapping.
 *
 * A dot's contribution to the cell is its AREA, which goes as radius squared,
 * so radius must go as sqrt(luminance) for the screen to reproduce the
 * composite's tones rather than darkening them. Anything above 0.5 here crushes
 * the shadows and erases the background web; slightly below lifts them.
 */
const EXPOSURE = 1.05;
const TONE_GAMMA = 0.5;
/** How hard a dot's colour is pushed back toward full strength (see below). */
const COLOR_RECOVERY = 0.32;

/** Pure black is used for the vignette and the halftone paper - not a palette colour. */
const BLACK = (a: number) => `rgba(0,0,0,${a})`;

/**
 * Flattens the three depth buffers into one composite, then - for the variants
 * with `halftone: true` - rebuilds that composite out of nothing but circular
 * dots on a regular grid.
 *
 * Order matters: bloom, scanlines and the vignette all land on the composite
 * BEFORE the dot screen, so blurred and glowing regions turn into large soft
 * dots rather than a screen laid over a finished picture. Grain goes on
 * afterwards so it is not quantised away by the dot grid.
 */

const compose = (scene: Scene, variant: Variant, frame: number, duration: number) => {
	const {comp, half, layers} = scene;
	const c = comp.ctx;
	const W = scene.width;
	const H = scene.height;
	const {palette} = variant;

	c.setTransform(1, 0, 0, 1, 0, 0);
	c.globalCompositeOperation = 'source-over';
	c.globalAlpha = 1;
	c.filter = 'none';
	c.clearRect(0, 0, W, H);

	const drift = cameraDrift(frame, duration);

	/* Backdrop - drawn oversized so the camera drift never exposes an edge. */
	c.save();
	c.translate(drift.x * 0.3, drift.y * 0.3);
	const bg = c.createRadialGradient(
		ORB.cx,
		ORB.cy,
		0,
		ORB.cx,
		ORB.cy,
		Math.max(W, H) * 0.85
	);
	// The backdrop has to fall away steeply. A broad, evenly-lit background
	// resolves into an even field of mid-sized dots - the "screen door over a
	// normal image" failure. Keeping the mid tone as a tight glow behind the orb
	// and dropping below the deep tone at the edges is what leaves the dark
	// regions nearly empty.
	bg.addColorStop(0, palette.bgMid);
	bg.addColorStop(0.26, mix(palette.bgMid, palette.bgDeep, 0.58));
	bg.addColorStop(0.62, palette.bgDeep);
	bg.addColorStop(1, shade(palette.bgDeep, 0.45));
	c.fillStyle = bg;
	c.fillRect(-60, -60, W + 120, H + 120);
	c.restore();

	/* Depth of field: three buffers, each blurred exactly once.
	   `mid` and `far` are half-resolution, so they are blurred at half radius in
	   their own space and then upscaled - visually identical to blurring at 4K
	   and a quarter of the fill cost. */
	const buckets: [LayerKey, number, number][] = [
		['far', variant.blurMax, 0.5],
		['mid', variant.blurMax * 0.38, 0.75],
		['sharp', 0, 1],
	];

	for (const [key, blur, parallax] of buckets) {
		const l = layers[key];
		c.save();
		c.translate(drift.x * parallax, drift.y * parallax);
		if (blur > 0 && l.scale < 1) {
			const hw = half.canvas.width;
			const hh = half.canvas.height;
			half.ctx.setTransform(1, 0, 0, 1, 0, 0);
			half.ctx.filter = 'none';
			half.ctx.clearRect(0, 0, hw, hh);
			half.ctx.filter = `blur(${(blur * (hw / W)).toFixed(2)}px)`;
			half.ctx.drawImage(l.canvas, 0, 0, hw, hh);
			half.ctx.filter = 'none';
			c.drawImage(half.canvas, 0, 0, W, H);
		} else {
			c.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : 'none';
			c.drawImage(l.canvas, 0, 0, W, H);
		}
		c.restore();
	}
	c.filter = 'none';

	/* Bloom: the bright-elements buffer, blurred in its own quarter-res space
	   and added back. */
	const bt = scene.bloomTmp;
	bt.ctx.setTransform(1, 0, 0, 1, 0, 0);
	bt.ctx.filter = 'none';
	bt.ctx.clearRect(0, 0, bt.canvas.width, bt.canvas.height);
	bt.ctx.filter = 'blur(5px)';
	bt.ctx.drawImage(layers.bloom.canvas, 0, 0, bt.canvas.width, bt.canvas.height);
	bt.ctx.filter = 'none';
	c.save();
	c.globalCompositeOperation = 'lighter';
	c.globalAlpha = 0.62;
	c.translate(drift.x, drift.y);
	c.drawImage(bt.canvas, 0, 0, W, H);
	c.restore();

	/* Scanlines - before the dot screen, so the halftone breaks them up. */
	if (variant.scanlines) {
		c.fillStyle = BLACK(0.04);
		for (let y = 0; y < H; y += 6) {
			c.fillRect(0, y, W, 3);
		}
	}

	/* Vignette ~20% at the corners. */
	const vg = c.createRadialGradient(
		W / 2,
		H / 2,
		Math.min(W, H) * 0.3,
		W / 2,
		H / 2,
		Math.hypot(W, H) * 0.6
	);
	vg.addColorStop(0, BLACK(0));
	vg.addColorStop(0.6, BLACK(0.06));
	vg.addColorStop(1, BLACK(0.2));
	c.fillStyle = vg;
	c.fillRect(0, 0, W, H);
};

/**
 * The dot screen. The composite is box-averaged down to one sample per dot
 * cell, then the frame is rebuilt from scratch: every cell becomes a circle
 * whose RADIUS is driven by that cell's luminance. Bright cells produce dots
 * large enough to touch their neighbours; dark cells produce nothing at all.
 */
const dotScreen = (scene: Scene, variant: Variant, display: CanvasRenderingContext2D) => {
	const {comp, half, sample, cols, rows} = scene;
	const W = scene.width;
	const H = scene.height;

	// Two-step downsample: 4K -> half -> one pixel per dot cell. Going straight
	// to the cell grid in one step aliases badly at this ratio.
	const hw = half.canvas.width;
	const hh = half.canvas.height;
	half.ctx.setTransform(1, 0, 0, 1, 0, 0);
	half.ctx.filter = 'none';
	half.ctx.imageSmoothingEnabled = true;
	half.ctx.imageSmoothingQuality = 'high';
	half.ctx.clearRect(0, 0, hw, hh);
	half.ctx.drawImage(comp.canvas, 0, 0, hw, hh);

	const s = sample.ctx;
	s.setTransform(1, 0, 0, 1, 0, 0);
	s.imageSmoothingEnabled = true;
	s.imageSmoothingQuality = 'high';
	s.clearRect(0, 0, cols, rows);
	s.drawImage(half.canvas, 0, 0, cols, rows);
	const data = s.getImageData(0, 0, cols, rows).data;

	// The paper: near-black. Everything visible from here is a dot.
	display.setTransform(1, 0, 0, 1, 0, 0);
	display.globalCompositeOperation = 'source-over';
	display.globalAlpha = 1;
	display.filter = 'none';
	display.fillStyle = shade(variant.palette.bgDeep, 0.22);
	display.fillRect(0, 0, W, H);

	const pitch = DOT_PITCH;
	// At 0.66 * pitch the largest dots overlap their neighbours, which is what
	// makes highlights read as solid rather than as a grid.
	const maxR = pitch * 0.66;
	const buckets = new Map<number, Path2D>();

	for (let row = 0; row < rows; row++) {
		const cy = (row + 0.5) * pitch;
		for (let col = 0; col < cols; col++) {
			const i = (row * cols + col) * 4;
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			const lum = ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * EXPOSURE;
			const t = (lum - 0.012) / 0.988;
			if (t <= 0.004) continue;
			const rad = maxR * Math.pow(Math.min(1, t), TONE_GAMMA);
			if (rad < 0.42) continue;

			// Partial luminance normalisation: the dot's AREA carries the tone,
			// so its colour is pushed back up toward full strength and only the
			// hue survives. Without this the dark end goes muddy grey.
			const boost = Math.pow(t, -COLOR_RECOVERY);
			const qr = Math.min(255, r * boost) >> 4;
			const qg = Math.min(255, g * boost) >> 4;
			const qb = Math.min(255, b * boost) >> 4;
			const key = (qr << 8) | (qg << 4) | qb;

			let path = buckets.get(key);
			if (!path) {
				path = new Path2D();
				buckets.set(key, path);
			}
			const cx = (col + 0.5) * pitch;
			path.moveTo(cx + rad, cy);
			path.arc(cx, cy, rad, 0, TAU);
		}
	}

	buckets.forEach((path, key) => {
		const cr = ((key >> 8) & 15) * 17;
		const cg = ((key >> 4) & 15) * 17;
		const cb = (key & 15) * 17;
		display.fillStyle = `rgb(${cr},${cg},${cb})`;
		display.fill(path);
	});
};

const applyGrain = (
	display: CanvasRenderingContext2D,
	scene: Scene,
	variant: Variant,
	frame: number
) => {
	const tiles = grainTiles();
	const tile = tiles[frame % tiles.length];
	const pattern = display.createPattern(tile, 'repeat');
	if (!pattern) return;
	display.save();
	display.globalCompositeOperation = 'overlay';
	display.globalAlpha = variant.grainAlpha;
	display.translate(
		-Math.floor(random(`grain-ox-${frame}`) * GRAIN_TILE_SIZE),
		-Math.floor(random(`grain-oy-${frame}`) * GRAIN_TILE_SIZE)
	);
	display.fillStyle = pattern;
	display.fillRect(0, 0, scene.width + GRAIN_TILE_SIZE, scene.height + GRAIN_TILE_SIZE);
	display.restore();
};

export const HalftoneLayer: React.FC = () => {
	const {scene, variant, frame, duration, width, height, fontsReady} = useDash();
	const ref = useRef<HTMLCanvasElement>(null);

	useLayoutEffect(() => {
		resetScene(scene, frame);
		const canvas = ref.current;
		if (!canvas) return;
		const display = canvas.getContext('2d') as CanvasRenderingContext2D;

		compose(scene, variant, frame, duration);

		if (variant.halftone) {
			dotScreen(scene, variant, display);
		} else {
			display.setTransform(1, 0, 0, 1, 0, 0);
			display.globalCompositeOperation = 'source-over';
			display.globalAlpha = 1;
			display.filter = 'none';
			display.clearRect(0, 0, scene.width, scene.height);
			display.drawImage(scene.comp.canvas, 0, 0);
		}

		applyGrain(display, scene, variant, frame);
	}, [scene, variant, frame, duration, fontsReady]);

	return (
		<canvas
			ref={ref}
			width={width}
			height={height}
			style={{width: '100%', height: '100%', display: 'block'}}
		/>
	);
};
