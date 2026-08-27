/**
 * The offscreen buffer set.
 *
 * Depth of field is done with exactly three buffers - sharp / mid / far.
 * Elements are bucketed by depth, each buffer is blurred once on the way into
 * the composite. Blurring per element would be unusable at 4K.
 *
 * `mid` and `far` are stored at half resolution: they are about to be blurred
 * by 9-34px anyway, so the detail is thrown away regardless and we save 4x the
 * fill cost. `bloom` is quarter resolution for the same reason. Every buffer
 * carries a base transform so all drawing code works in 4K composition
 * coordinates and never has to know its own scale.
 */

export type LayerKey = 'sharp' | 'mid' | 'far' | 'bloom';

export type Layer = {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	scale: number;
};

export type Surface = {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
};

export type Scene = {
	width: number;
	height: number;
	layers: Record<LayerKey, Layer>;
	comp: Surface;
	half: Surface;
	bloomTmp: Surface;
	sample: Surface;
	cols: number;
	rows: number;
	lastReset: number;
	drawn: Map<string, number>;
};

/** depth 0 = focal band, 1 = mid ground, 2 = far. */
export const DEPTH_LAYER: Record<number, LayerKey> = {0: 'sharp', 1: 'mid', 2: 'far'};

const surface = (w: number, h: number, readFrequently = false): Surface => {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(w));
	canvas.height = Math.max(1, Math.round(h));
	const ctx = canvas.getContext('2d', {
		alpha: true,
		willReadFrequently: readFrequently,
	}) as CanvasRenderingContext2D;
	return {canvas, ctx};
};

const layer = (w: number, h: number, scale: number): Layer => {
	const s = surface(w * scale, h * scale);
	return {canvas: s.canvas, ctx: s.ctx, scale};
};

export const createScene = (width: number, height: number, pitch: number): Scene => {
	const cols = Math.ceil(width / pitch);
	const rows = Math.ceil(height / pitch);
	return {
		width,
		height,
		layers: {
			sharp: layer(width, height, 1),
			mid: layer(width, height, 0.5),
			far: layer(width, height, 0.5),
			bloom: layer(width, height, 0.25),
		},
		comp: surface(width, height),
		half: surface(width / 2, height / 2),
		bloomTmp: surface(width / 4, height / 4),
		sample: surface(cols, rows, true),
		cols,
		rows,
		lastReset: -1,
		drawn: new Map(),
	};
};

/**
 * Wipe every buffer exactly once per frame. Called at the top of each drawing
 * component's layout effect; the frame guard makes it idempotent so the order
 * of the callers only has to put *some* drawing component first.
 */
export const resetScene = (scene: Scene, frame: number) => {
	if (scene.lastReset === frame) return;
	scene.lastReset = frame;
	scene.drawn.clear();
	(Object.keys(scene.layers) as LayerKey[]).forEach((key) => {
		const l = scene.layers[key];
		l.ctx.setTransform(1, 0, 0, 1, 0, 0);
		l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
		l.ctx.setTransform(l.scale, 0, 0, l.scale, 0, 0);
		l.ctx.lineCap = 'round';
		l.ctx.lineJoin = 'round';
	});
};

/**
 * Guard against a component drawing twice into the same frame (React StrictMode
 * double-invokes layout effects in the Studio).
 */
export const shouldDraw = (scene: Scene, key: string, frame: number) => {
	if (scene.drawn.get(key) === frame) return false;
	scene.drawn.set(key, frame);
	return true;
};
