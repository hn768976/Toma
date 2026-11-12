/** Deterministic PRNG (mulberry32) so every render tab builds an identical scene. */
export const createRng = (seed: number) => {
	let a = seed >>> 0;
	const next = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		next,
		range: (min: number, max: number) => min + (max - min) * next(),
		pick: <T,>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
	};
};
export type Rng = ReturnType<typeof createRng>;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (x: number) =>
	x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
