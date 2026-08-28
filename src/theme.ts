/**
 * Every colour in the piece lives here. Nothing else in the project may contain
 * a hex literal — a new look is a new entry in `THEMES`, not a code change.
 */

export type PaletteEntry = {
	/** Stable id — used as part of the seed string, so it must never change. */
	readonly key: string;
	readonly color: string;
	/** Relative weight of the seeded draw. Weights do not have to sum to 1. */
	readonly weight: number;
	/** Notes only — kept so the palette documents the fluorophore it stands for. */
	readonly channel: string;
};

export type Theme = {
	readonly name: string;
	/** Near-black slide background. */
	readonly background: string;
	readonly palette: readonly PaletteEntry[];
	/** Colour the vignette darkens towards. */
	readonly vignette: string;
	/** Sensor grain is mixed between these two per pixel. */
	readonly grainShadow: string;
	readonly grainHighlight: string;
};

/**
 * Realistic fluorophore weighting: Cy5 (red) and Cy3 (green) dominate, both
 * channels expressed reads yellow, everything else is a garnish. An even
 * distribution would read as decorative confetti rather than an array.
 */
export const THEME: Theme = {
	name: 'standard',
	background: '#04060A',
	palette: [
		{key: 'red', color: '#E82D2D', weight: 0.3, channel: 'Cy5'},
		{key: 'green', color: '#2FC43F', weight: 0.3, channel: 'Cy3'},
		{key: 'yellow', color: '#C8D44F', weight: 0.18, channel: 'Cy3 + Cy5'},
		{key: 'blue', color: '#2F5FE8', weight: 0.14, channel: 'DAPI'},
		{key: 'orange', color: '#E8763A', weight: 0.06, channel: 'Cy3 bleed'},
		{key: 'white', color: '#F0F8FF', weight: 0.02, channel: 'saturated'},
	],
	vignette: '#000000',
	grainShadow: '#000000',
	grainHighlight: '#FFFFFF',
};

/**
 * Variant registry. A second look (tilted plane, scanning sweep, a different
 * fluorophore set) is a new entry here plus an optional config override in
 * `config.ts` — never a change to the render code.
 */
export const THEMES = {
	standard: THEME,
} as const;

export type VariantName = keyof typeof THEMES;

export const DEFAULT_VARIANT: VariantName = 'standard';

export const getTheme = (variant: VariantName): Theme =>
	THEMES[variant] ?? THEMES[DEFAULT_VARIANT];
