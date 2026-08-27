/** Small colour + path helpers. Deliberately free of any literal colour. */

export type RGB = [number, number, number];

const hexCache = new Map<string, RGB>();

export const hexToRgb = (hex: string): RGB => {
	const cached = hexCache.get(hex);
	if (cached) return cached;
	const h = hex.replace('#', '');
	const full =
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h;
	const rgb: RGB = [
		parseInt(full.slice(0, 2), 16),
		parseInt(full.slice(2, 4), 16),
		parseInt(full.slice(4, 6), 16),
	];
	hexCache.set(hex, rgb);
	return rgb;
};

/** hex + alpha -> css rgba() */
export const rgba = (hex: string, alpha: number): string => {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r},${g},${b},${alpha})`;
};

/** Multiply a hex colour's channels by `k` (values are clamped). */
export const shade = (hex: string, k: number, alpha = 1): string => {
	const [r, g, b] = hexToRgb(hex);
	const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
	return `rgba(${c(r)},${c(g)},${c(b)},${alpha})`;
};

/**
 * Linear blend between two hex colours. Returns hex so the result can be fed
 * straight back into `rgba()` / `shade()`.
 */
export const mix = (a: string, b: string, t: number): string => {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	const m = (x: number, y: number) =>
		Math.max(0, Math.min(255, Math.round(x + (y - x) * t)))
			.toString(16)
			.padStart(2, '0');
	return `#${m(ar, br)}${m(ag, bg)}${m(ab, bb)}`;
};

export const roundRect = (
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) => {
	const rr = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.lineTo(x + w - rr, y);
	ctx.arcTo(x + w, y, x + w, y + rr, rr);
	ctx.lineTo(x + w, y + h - rr);
	ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
	ctx.lineTo(x + rr, y + h);
	ctx.arcTo(x, y + h, x, y + h - rr, rr);
	ctx.lineTo(x, y + rr);
	ctx.arcTo(x, y, x + rr, y, rr);
	ctx.closePath();
};

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/**
 * Draw a run of tiny blocks that reads as a line of text at a glance but
 * carries no information. Panel bodies are texture, not data.
 */
export const microText = (
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	seed: string,
	rand: (s: string) => number,
	color: string
) => {
	ctx.fillStyle = color;
	let cx = x;
	let i = 0;
	while (cx < x + width) {
		const wordLen = 26 + rand(`${seed}:w${i}`) * 86;
		const w = Math.min(wordLen, x + width - cx);
		if (w <= 2) break;
		ctx.fillRect(cx, y, w, height);
		cx += w + 14 + rand(`${seed}:g${i}`) * 20;
		i++;
	}
};
