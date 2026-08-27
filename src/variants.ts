/**
 * The ONE place where palettes, glyphs, panel types and post-processing flags
 * live. Nothing else in this project may contain a hex literal or a glyph
 * string -- every component reads what it needs from here via `useVariant()`.
 */

export type VariantName = 'blue' | 'green' | 'amber';

export type PanelKind = 'charts' | 'code' | 'gauges';

/**
 * Palette keys are deliberately identical across all three variants so the
 * drawing code never has to know which variant it is painting.
 *
 *   bgDeep / bgMid  background gradient stops
 *   web             network-web line colour
 *   orb             the centre orb's signature hue
 *   orbWhite        the near-white used for the rim highlight and the glyph
 *   panelBorder     thin bright panel outline
 *   panelFill       dark semi-transparent panel body
 *   textPale        panel body text / labels
 *   accentA         first sparse accent (see `accentAUse`)
 *   accentB         second sparse accent (see `accentBUse`)
 */
export type Palette = {
	bgDeep: string;
	bgMid: string;
	web: string;
	orb: string;
	orbWhite: string;
	panelBorder: string;
	panelFill: string;
	textPale: string;
	accentA: string;
	accentB: string;
};

export type Variant = {
	name: VariantName;
	palette: Palette;
	/** Where each accent is allowed to appear. Purely documentary + asserted by use-site. */
	accentAUse: string;
	accentBUse: string;

	/** Centre glyph. */
	glyph: string;
	/** Font family used for the centre glyph. */
	glyphFamily: string;
	/** Cap-height multiplier relative to the orb radius. */
	glyphScale: number;
	/** Extra letter spacing for the glyph, as a fraction of the glyph size. */
	glyphTracking: number;
	/** When set, the trailing character blinks on this frame cycle. */
	glyphBlinkCycle: number | null;

	/** Which SidePanel body renderer to switch to. */
	panelKind: PanelKind;
	/** 'near-first' fills the frame centre-out, 'far-first' fills it outside-in. */
	panelArrival: 'near-first' | 'far-first';

	/** THE flag. false => the dot screen is skipped and the buffer is shown directly. */
	halftone: boolean;
	/** Maximum depth-of-field blur in 4K pixels. */
	blurMax: number;
	/** CRT scanlines, applied pre-halftone. */
	scanlines: boolean;
	/** Film grain alpha, applied post-halftone. */
	grainAlpha: number;
};

export const GEOMETRIC_SANS = 'HalftoneGeometric';
export const TERMINAL_MONO = 'HalftoneMono';

/** Shared across every variant: dot pitch of the halftone screen at 4K. */
export const DOT_PITCH = 14;

/**
 * Filled in one variant per stage; `getVariant` guards the lookup so a name
 * that has not been added yet fails loudly instead of rendering blank.
 */
export const VARIANTS: Partial<Record<VariantName, Variant>> = {
	blue: {
		name: 'blue',
		palette: {
			bgDeep: '#0A1230',
			bgMid: '#16255E',
			web: '#2E4A8F',
			orb: '#4FE8F5',
			orbWhite: '#E8FDFF',
			panelBorder: '#5FA8E0',
			panelFill: '#0E1C44',
			textPale: '#C8DCF0',
			accentA: '#C44FA8',
			accentB: '#E8B04F',
		},
		accentAUse: 'magenta - background web only',
		accentBUse: 'amber - inside panels only',
		glyph: 'AI',
		glyphFamily: GEOMETRIC_SANS,
		glyphScale: 0.62,
		glyphTracking: 0.04,
		glyphBlinkCycle: null,
		panelKind: 'charts',
		panelArrival: 'near-first',
		halftone: true,
		blurMax: 24,
		scanlines: false,
		grainAlpha: 0.03,
	},
};

export const getVariant = (name: VariantName): Variant => {
	const v = VARIANTS[name];
	if (!v) {
		throw new Error(`Unknown variant "${name}"`);
	}
	return v;
};
