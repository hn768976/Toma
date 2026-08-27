/**
 * The ONE place where palettes, bolt parameters, strike schedules, flash
 * profiles and ambient settings live. No colour literal and no timing number
 * appears anywhere else in the project — every other module reads from here.
 */

export type VariantName = 'blue' | 'violet' | 'white';

/** Inclusive numeric range, resolved with a seeded random. */
export interface Range {
	min: number;
	max: number;
}

export interface Palette {
	/** Near-black base of the frame. */
	background: string;
	/** Cloud haze in the upper third. */
	haze: string;
	/** Pass 1 — very wide atmospheric glow. */
	glowWide: string;
	/** Pass 2 — outer glow. */
	glowOuter: string;
	/** Pass 3 — mid channel (in the "white" variant this is the warm band). */
	channel: string;
	/** Pass 4 — the hot core. */
	core: string;
}

export interface BoltConfig {
	/**
	 * Signed travel direction: 1 travels down the frame, -1 travels up it.
	 * Every generated point is mapped through this sign, so path shape,
	 * branch angles and stroke taper all invert with it.
	 */
	strikeDirection: 1 | -1;
	/** How many simultaneous bolts an event fires. */
	count: Range;
	/** Normalised x of the bolt origin along the edge it starts from. */
	originX: Range;
	/** Normalised distance travelled, as a fraction of frame height. */
	travel: Range;
	/** Normalised sideways drift of the target point, fraction of frame width. */
	drift: Range;
	/** Levels of recursive midpoint displacement on the main channel. */
	depth: number;
	/** Level-0 displacement amplitude as a fraction of the travel distance. */
	displacementScale: number;
	/** Displacement amplitude multiplier per recursion level. */
	displacementFalloff: number;
	/** Recursion levels shallow enough to spawn a branch. */
	branchLevels: number;
	/** Seeded probability of a branch at an eligible midpoint. */
	branchProbability: number;
	/** Branch count kept per bolt after the probability pass. */
	branchCount: Range;
	/** Sub-branch count kept per branch. */
	subBranchCount: Range;
	/** Generations of branching (1 = forks only, 3 = forks of forks of forks). */
	branchDepth: number;
	/** Branch deflection from the parent direction, radians. */
	branchAngle: Range;
	/** Branch length as a fraction of the parent's remaining length. */
	branchLength: Range;
	/** 0 spreads branches evenly, 1 pushes them towards the far tip. */
	branchBias: number;
	/** Brightness multiplier applied per branch generation. */
	branchBrightnessFalloff: number;
	/** Width multiplier applied per branch generation. */
	branchWidthFalloff: number;
	/** Stroke widths at the origin, in 4K canvas pixels. */
	width: {wide: number; outer: number; channel: number; core: number};
	/** Width at the far tip as a fraction of the width at the origin. */
	tipWidth: number;
	/** Per-pass alpha before the peak-brightness multiplier. */
	alpha: {wide: number; outer: number; channel: number; core: number};
	/** shadowBlur per pass, in 4K canvas pixels. */
	blur: {wide: number; outer: number; channel: number; core: number};
	/** Extra additive bloom on the core. */
	bloom: {alpha: number; blur: number; width: number};
	/** Master brightness of one bolt. */
	peakBrightness: number;
	/** Frames a bolt within an event lags behind the flash it belongs to. */
	stagger: Range;
	/** Width bands used to taper a stroke along its length. */
	taperBands: number;
}

export interface ScheduleConfig {
	/** Strike events across the loop. */
	events: number;
	/** Return strokes per event. */
	flashesPerEvent: Range;
	/** Frames a single flash stays lit. */
	flashDuration: Range;
	/** Dark frames between flashes inside one burst. */
	flashGap: Range;
	/** Dark frames between events. */
	eventPause: Range;
	/** Per-flash brightness. */
	flashIntensity: Range;
	/** Dark frames before the first event. */
	headDark: number;
	/** Dark frames after the last event — keeps the loop point clean. */
	tailDark: number;
}

export interface AmbientConfig {
	/** Radius of the soft wash painted around a lit channel, 4K pixels. */
	glowRadius: number;
	/** Peak alpha of that wash. */
	glowAlpha: number;
	/** Frames the wash takes to decay after a flash. */
	glowDecayFrames: number;
	/** Points sampled along a channel when painting the wash. */
	glowSamples: number;
	/** Cloud bands in the upper third. */
	hazeBands: number;
	/** Base alpha of the haze. */
	hazeAlpha: number;
	/** Extra haze alpha at full flash brightness. */
	hazeLift: number;
	/** Haze drift across one loop, as a fraction of frame width. */
	hazeDrift: number;
	/** Fraction of frame height the haze occupies. */
	hazeHeight: number;
	/** How much haze colour is mixed into the top of the background gradient. */
	backgroundTopMix: number;
	/** Same, for the bottom of the background gradient. */
	backgroundBottomMix: number;
}

export interface FrameFlashConfig {
	/** Colour the whole frame lifts to. */
	color: string;
	/** Frames the lift is held at full strength. */
	holdFrames: number;
	/** Frames the lift takes to fall back to black. */
	decayFrames: number;
	/** Flashes dimmer than this fraction of the burst peak do not lift. */
	threshold: number;
}

export interface FinishConfig {
	/** Vignette strength at the corners. */
	vignette: number;
	/** Grain alpha. */
	grainAlpha: number;
	/** Edge of the square noise tile, in noise cells. */
	grainTile: number;
	/** Canvas pixels per noise cell. Cells larger than a pixel keep the grain
	 * stable when the 4K frame is previewed at a smaller scale. */
	grainCell: number;
}

export interface VariantConfig {
	timing: {durationInFrames: number; fps: number; width: number; height: number};
	palette: Palette;
	bolt: BoltConfig;
	schedule: ScheduleConfig;
	ambient: AmbientConfig;
	/** null on variants that do not wash the whole frame. */
	frameFlash: FrameFlashConfig | null;
	finish: FinishConfig;
}

const TIMING = {durationInFrames: 300, fps: 30, width: 3840, height: 2160};

export const VARIANTS: Record<VariantName, VariantConfig> = {
	/**
	 * v1 — a distant strike in clean air. One descending channel, moderate
	 * jaggedness, a handful of forks low down. The classic blue-white look.
	 */
	blue: {
		timing: TIMING,
		palette: {
			background: '#01040C',
			haze: '#0A1A3D',
			glowWide: '#1E4A9F',
			glowOuter: '#3F7FD4',
			channel: '#8FC4F5',
			core: '#F0F8FF',
		},
		bolt: {
			strikeDirection: 1,
			count: {min: 1, max: 1},
			originX: {min: 0.4, max: 0.46},
			travel: {min: 0.78, max: 0.83},
			drift: {min: -0.09, max: 0.13},
			depth: 7,
			displacementScale: 0.085,
			displacementFalloff: 0.5,
			branchLevels: 3,
			branchProbability: 0.55,
			branchCount: {min: 3, max: 5},
			subBranchCount: {min: 0, max: 2},
			branchDepth: 3,
			branchAngle: {min: 0.3, max: 0.78},
			branchLength: {min: 0.5, max: 0.7},
			branchBias: 1,
			branchBrightnessFalloff: 0.5,
			branchWidthFalloff: 0.52,
			width: {wide: 96, outer: 44, channel: 18, core: 5.5},
			tipWidth: 0.3,
			alpha: {wide: 0.2, outer: 0.34, channel: 0.85, core: 1},
			blur: {wide: 90, outer: 40, channel: 14, core: 0},
			bloom: {alpha: 0.5, blur: 60, width: 10},
			peakBrightness: 1,
			stagger: {min: 0, max: 0},
			taperBands: 10,
		},
		schedule: {
			events: 3,
			flashesPerEvent: {min: 4, max: 5},
			flashDuration: {min: 1, max: 3},
			flashGap: {min: 1, max: 4},
			eventPause: {min: 40, max: 90},
			flashIntensity: {min: 0.45, max: 1},
			headDark: 20,
			tailDark: 28,
		},
		ambient: {
			glowRadius: 700,
			glowAlpha: 0.62,
			glowDecayFrames: 8,
			glowSamples: 26,
			hazeBands: 6,
			hazeAlpha: 0.22,
			hazeLift: 0.9,
			hazeDrift: 0.05,
			hazeHeight: 0.36,
			backgroundTopMix: 0.1,
			backgroundBottomMix: 0,
		},
		frameFlash: null,
		finish: {vignette: 0.2, grainAlpha: 0.04, grainTile: 512, grainCell: 2},
	},

	/**
	 * v2 — haze and dust scattering the short wavelengths. Two or three
	 * channels at once, wilder displacement, roughly double the branching, and
	 * each bolt dimmed so the crowded frame does not blow out.
	 */
	violet: {
		timing: TIMING,
		palette: {
			background: '#08031A',
			haze: '#24104A',
			glowWide: '#5A1E9F',
			glowOuter: '#8B3FD4',
			channel: '#C48FF5',
			core: '#F8F0FF',
		},
		bolt: {
			strikeDirection: 1,
			count: {min: 2, max: 3},
			originX: {min: 0.16, max: 0.84},
			travel: {min: 0.7, max: 0.86},
			drift: {min: -0.16, max: 0.16},
			depth: 7,
			displacementScale: 0.13,
			displacementFalloff: 0.5,
			branchLevels: 4,
			branchProbability: 0.72,
			branchCount: {min: 8, max: 12},
			subBranchCount: {min: 1, max: 3},
			branchDepth: 4,
			branchAngle: {min: 0.32, max: 0.92},
			branchLength: {min: 0.5, max: 0.7},
			branchBias: 0,
			branchBrightnessFalloff: 0.52,
			branchWidthFalloff: 0.5,
			width: {wide: 84, outer: 38, channel: 15, core: 4.6},
			tipWidth: 0.28,
			alpha: {wide: 0.2, outer: 0.34, channel: 0.85, core: 1},
			blur: {wide: 90, outer: 40, channel: 14, core: 0},
			bloom: {alpha: 0.45, blur: 60, width: 9},
			peakBrightness: 0.75,
			stagger: {min: 1, max: 3},
			taperBands: 10,
		},
		schedule: {
			events: 5,
			flashesPerEvent: {min: 5, max: 7},
			flashDuration: {min: 1, max: 2},
			flashGap: {min: 1, max: 3},
			eventPause: {min: 25, max: 55},
			flashIntensity: {min: 0.45, max: 1},
			headDark: 15,
			tailDark: 28,
		},
		ambient: {
			glowRadius: 980,
			glowAlpha: 0.66,
			glowDecayFrames: 8,
			glowSamples: 26,
			hazeBands: 8,
			hazeAlpha: 0.34,
			hazeLift: 1.6,
			hazeDrift: 0.07,
			hazeHeight: 0.4,
			backgroundTopMix: 0.13,
			backgroundBottomMix: 0,
		},
		frameFlash: null,
		finish: {vignette: 0.2, grainAlpha: 0.04, grainTile: 512, grainCell: 2},
	},

	/**
	 * v3 — a very close strike, travelling upward out of the top of frame.
	 * One decisive channel, almost no forks, the highest peak brightness, a
	 * whole-frame overexposure flash and a long afterglow.
	 */
	white: {
		timing: TIMING,
		palette: {
			background: '#030303',
			haze: '#1A1A1E',
			glowWide: '#4A6A9F',
			glowOuter: '#A8C4E8',
			channel: '#FFF4D8',
			core: '#FFFFFF',
		},
		bolt: {
			strikeDirection: -1,
			count: {min: 1, max: 1},
			originX: {min: 0.44, max: 0.56},
			travel: {min: 1.02, max: 1.12},
			drift: {min: -0.08, max: 0.08},
			depth: 6,
			displacementScale: 0.055,
			displacementFalloff: 0.5,
			branchLevels: 2,
			branchProbability: 0.5,
			branchCount: {min: 1, max: 2},
			subBranchCount: {min: 0, max: 1},
			branchDepth: 2,
			branchAngle: {min: 0.26, max: 0.6},
			branchLength: {min: 0.3, max: 0.45},
			branchBias: 1,
			branchBrightnessFalloff: 0.45,
			branchWidthFalloff: 0.5,
			width: {wide: 120, outer: 52, channel: 13, core: 6.5},
			tipWidth: 0.34,
			alpha: {wide: 0.22, outer: 0.36, channel: 0.55, core: 1},
			blur: {wide: 90, outer: 40, channel: 14, core: 0},
			bloom: {alpha: 0.7, blur: 60, width: 13},
			peakBrightness: 1.35,
			stagger: {min: 0, max: 0},
			taperBands: 10,
		},
		schedule: {
			events: 2,
			flashesPerEvent: {min: 3, max: 4},
			flashDuration: {min: 2, max: 3},
			flashGap: {min: 1, max: 4},
			eventPause: {min: 80, max: 110},
			flashIntensity: {min: 0.5, max: 1},
			headDark: 25,
			tailDark: 34,
		},
		ambient: {
			glowRadius: 880,
			glowAlpha: 0.7,
			glowDecayFrames: 25,
			glowSamples: 26,
			hazeBands: 5,
			hazeAlpha: 0.16,
			hazeLift: 1.2,
			hazeDrift: 0.04,
			hazeHeight: 0.34,
			backgroundTopMix: 0.1,
			backgroundBottomMix: 0,
		},
		frameFlash: {
			color: '#2A2A2E',
			holdFrames: 3,
			decayFrames: 6,
			threshold: 0.92,
		},
		finish: {vignette: 0.2, grainAlpha: 0.04, grainTile: 512, grainCell: 2},
	},
};
