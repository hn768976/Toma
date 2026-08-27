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

export const VARIANTS: Record<VariantName, Variant> = {
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

	green: {
		name: 'green',
		// Deeper and higher contrast than blue: a near-black ground with a hot
		// green on top, so it reads as a CRT terminal rather than a product UI.
		palette: {
			bgDeep: '#020C06',
			bgMid: '#06210F',
			web: '#0F4A22',
			orb: '#3FFF6A',
			orbWhite: '#E8FFE8',
			panelBorder: '#2ED44F',
			panelFill: '#03150A',
			textPale: '#A8FFC0',
			accentA: '#D9C44F',
			accentB: '#E85040',
		},
		accentAUse: 'amber - log output only',
		accentBUse: 'red - error lines only',
		glyph: '>_',
		// A different typeface, not just different text - the monospace is what
		// makes it read as a prompt.
		glyphFamily: TERMINAL_MONO,
		glyphScale: 0.62,
		glyphTracking: 0.06,
		glyphBlinkCycle: 30,
		panelKind: 'code',
		// Reverse of blue: the frame fills from the outside in.
		panelArrival: 'far-first',
		halftone: true,
		blurMax: 24,
		scanlines: true,
		grainAlpha: 0.03,
	},

	amber: {
		name: 'amber',
		palette: {
			bgDeep: '#1A0E02',
			bgMid: '#3D2408',
			web: '#6B4514',
			orb: '#FFC44F',
			orbWhite: '#FFF5D8',
			panelBorder: '#E8942E',
			panelFill: '#241505',
			textPale: '#FFE0A8',
			accentA: '#B8763A',
			accentB: '#FFF0D0',
		},
		accentAUse: 'bronze - gauge tracks and inactive segments',
		accentBUse: 'cream - numeric readouts',
		glyph: 'CORE',
		glyphFamily: GEOMETRIC_SANS,
		// Four characters instead of two, so the cap height comes down ~30%
		// from blue's "AI" and the tracking opens right out.
		glyphScale: 0.434,
		glyphTracking: 0.24,
		glyphBlinkCycle: null,
		panelKind: 'gauges',
		panelArrival: 'near-first',
		// The one flag that matters: no dot screen, the composite goes straight
		// to the canvas. Crisp vector and smooth gradients where the other two
		// are quantised into dots.
		halftone: false,
		// The halftone was masking how soft the defocus was; without it the
		// depth has to do more work on its own, so the ceiling goes up.
		blurMax: 34,
		scanlines: false,
		// No dot screen to quantise it, so the same grain reads more strongly.
		grainAlpha: 0.04,
	},
};

export const getVariant = (name: VariantName): Variant => {
	const v = VARIANTS[name];
	if (!v) {
		throw new Error(`Unknown variant "${name}"`);
	}
	return v;
};
