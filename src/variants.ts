/**
 * The ONE place where palettes, glyphs, panel types and post-processing flags
 * live. Nothing else in this project may contain a hex literal or a glyph
 * string -- every component reads what it needs from here via `useVariant()`.
 */

export type VariantName = 'blue' | 'green' | 'amber';

export type PanelKind = 'charts' | 'code' | 'gauges';

/**
 * One line of the centre glyph. `scale` multiplies the variant's base glyph
 * scale, so a variant can set one line larger than another.
 */
export type GlyphLine = {
	text: string;
	scale: number;
	/** Overrides the variant's tracking for this line only. */
	tracking?: number;
};

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

	/** Centre glyph, one entry per line. */
	glyph: GlyphLine[];
	/** Font family used for the centre glyph. */
	glyphFamily: string;
	/** Cap-height multiplier relative to the orb radius. */
	glyphScale: number;
	/** Extra letter spacing for the glyph, as a fraction of the glyph size. */
	glyphTracking: number;
	/** Gap between glyph lines, as a fraction of the base glyph size. */
	glyphLineGap: number;
	/** When set, the trailing character of the last line blinks on this cycle. */
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

/**
 * Shared across every variant: dot pitch of the halftone screen at 4K.
 * Finer pitch = more cells = a less pixelated reconstruction, at the cost of
 * roughly (14/pitch)^2 more dots to rasterise per frame.
 */
export const DOT_PITCH = 9;

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
		glyph: [{text: 'AI', scale: 1}],
		glyphFamily: GEOMETRIC_SANS,
		glyphScale: 0.62,
		glyphTracking: 0.04,
		glyphLineGap: 0,
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
		// Trailing underscore is the cursor - CentreOrb blinks the last character
		// of the last line on `glyphBlinkCycle`.
		glyph: [{text: 'AI LOG_', scale: 1}],
		// A different typeface, not just different text. The monospace is doing
		// as much work as the text: it is what makes the orb read as a terminal
		// rather than a product logo, and it matches the log panels beside it.
		glyphFamily: TERMINAL_MONO,
		// Six characters plus the cursor, so cap height comes down ~35% from
		// blue's "AI" and the tracking closes right up to clear the rim.
		glyphScale: 0.4,
		glyphTracking: 0,
		glyphLineGap: 0,
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
		// Two lines rather than one: seven characters on a single line would
		// force the type small enough to lose against the gauge assembly.
		glyph: [
			{text: 'AI', scale: 0.8},
			// CORE sets tighter than the line above it - four wide letters at the
			// variant tracking crowded the rim.
			{text: 'CORE', scale: 1, tracking: 0.11},
		],
		glyphFamily: GEOMETRIC_SANS,
		// Overall cap height ~30% below blue's single-line "AI", tracking wide.
		glyphScale: 0.434,
		glyphTracking: 0.24,
		glyphLineGap: 0.34,
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
