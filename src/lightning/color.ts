/** Hex parsing so palette values from the config are the only colour source. */

const parse = (hex: string): [number, number, number] => {
	const h = hex.replace('#', '');
	const full =
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h;
	return [
		parseInt(full.slice(0, 2), 16),
		parseInt(full.slice(2, 4), 16),
		parseInt(full.slice(4, 6), 16),
	];
};

export const withAlpha = (hex: string, alpha: number): string => {
	const [r, g, b] = parse(hex);
	return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};

/** Multiplies a colour towards black, then applies alpha. */
export const scaled = (hex: string, gain: number, alpha: number): string => {
	const [r, g, b] = parse(hex);
	const k = Math.max(0, gain);
	return `rgba(${Math.round(Math.min(255, r * k))}, ${Math.round(
		Math.min(255, g * k),
	)}, ${Math.round(Math.min(255, b * k))}, ${Math.max(0, Math.min(1, alpha))})`;
};

export const blend = (a: string, b: string, t: number): string => {
	const [ar, ag, ab] = parse(a);
	const [br, bg, bb] = parse(b);
	const m = (x: number, y: number) => Math.round(x + (y - x) * t);
	return `rgb(${m(ar, br)}, ${m(ag, bg)}, ${m(ab, bb)})`;
};
