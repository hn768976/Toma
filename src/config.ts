import type {VariantName} from './theme';
import {DEFAULT_VARIANT} from './theme';

/**
 * Every tunable number in the piece. The focus curve in particular lives here so
 * a different rack focus (or a second variant) is a data change, not a rewrite.
 */
export type Config = {
	readonly timeline: {
		readonly width: number;
		readonly height: number;
		readonly fps: number;
		readonly durationInFrames: number;
	};
	readonly grid: {
		/** Centre-to-centre spacing of the printed spots, in 4K pixels. */
		readonly pitchPx: number;
		readonly radiusPx: number;
		/** Per-spot positional jitter, +/- this many pixels. */
		readonly jitterPx: number;
		/** Per-spot radius variation, +/- this fraction. */
		readonly radiusVariance: number;
		/** Extra rings of spots generated outside the frame so blur bleeds inwards. */
		readonly marginCells: number;
	};
	readonly spotProfile: {
		/** Alpha at the centre of a spot (slightly under the rim: bokeh donut). */
		readonly coreLevel: number;
		/** Radius fraction at which the rim peaks. */
		readonly rimStop: number;
		readonly rimLevel: number;
		/** Radius fraction where the hard edge starts falling to zero. */
		readonly edgeStop: number;
		readonly edgeLevel: number;
		/** Sprite resolution used to pre-render one disc per palette colour. */
		readonly spriteSizePx: number;
	};
	readonly population: {
		/** Fraction of grid positions that are empty or barely printed. */
		readonly blankChance: number;
		/** Of those, the share that are fully empty rather than very dim. */
		readonly fullyBlankShare: number;
		readonly dimRange: readonly [number, number];
		readonly baseRange: readonly [number, number];
		/** Chance a populated spot is near-saturated instead. */
		readonly hotChance: number;
		readonly hotRange: readonly [number, number];
		/** Chance a spot inherits a neighbour's colour, producing regional clusters. */
		readonly clusterChance: number;
		/** Longest run of inherited colour in one direction. */
		readonly maxClusterRun: number;
	};
	readonly focus: {
		readonly maxBlurPx: number;
		readonly minBlurPx: number;
		/** Frame the opening soft hold ends and the pull into focus begins. */
		readonly holdSoftEnd: number;
		/** Frame the pull into focus completes. */
		readonly pullInEnd: number;
		/** Frame the sharp hold ends and the pull back out begins. */
		readonly holdSharpEnd: number;
		/** Frame the pull back out completes; the closing soft hold runs to the end. */
		readonly pullOutEnd: number;
	};
	readonly exposure: {
		/** Extra gain at maximum blur, so the pull does not read as a fade-up. */
		readonly blurCompensationGain: number;
		readonly blurCompensationExponent: number;
	};
	readonly drift: {
		/**
		 * `closedDiagonal` walks a very thin ellipse along the diagonal: the loop
		 * closes on the frame itself, so the spot field never has to repeat.
		 * `linearTiled` is a constant one-way diagonal translation of exactly
		 * `tileCells` grid cells per loop; the seeded field is made periodic along
		 * that axis to close the loop, which costs some pattern variety.
		 */
		readonly mode: 'closedDiagonal' | 'linearTiled';
		readonly pxPerSecond: number;
		readonly angleDeg: number;
		/** Width of the closed path across the drift axis, as a fraction of its length. */
		readonly lateralRatio: number;
		readonly tileCells: number;
	};
	readonly flicker: {
		readonly amplitude: number;
		/** Every period must divide the loop length exactly. */
		readonly periods: readonly number[];
	};
	readonly flash: {
		readonly minPerSecond: number;
		readonly maxPerSecond: number;
		readonly minFrames: number;
		readonly maxFrames: number;
		readonly boost: number;
	};
	readonly bloom: {
		readonly enabled: boolean;
		readonly downscale: number;
		/** Times the bloom buffer is multiplied by itself to isolate the highlights. */
		readonly gammaPasses: number;
		readonly blurPx: number;
		readonly alpha: number;
	};
	readonly vignette: {
		readonly strength: number;
		/** Radius fraction where the darkening starts. */
		readonly innerStop: number;
	};
	readonly grain: {
		readonly alpha: number;
		readonly tileSizePx: number;
		/** Must divide the loop length so the grain returns at frame 0. */
		readonly tileCount: number;
		/** >1 biases the noise dark, so black stays black. */
		readonly bias: number;
	};
	readonly render: {
		/** Above this blur the spot buffer is drawn at half resolution. */
		readonly halfResBlurThresholdPx: number;
		readonly halfResScale: number;
	};
};

export const CONFIG: Config = {
	timeline: {
		width: 3840,
		height: 2160,
		fps: 30,
		durationInFrames: 360,
	},
	grid: {
		pitchPx: 118,
		radiusPx: 46,
		jitterPx: 4,
		radiusVariance: 0.12,
		marginCells: 3,
	},
	spotProfile: {
		coreLevel: 0.9,
		rimStop: 0.8,
		rimLevel: 1,
		edgeStop: 0.965,
		edgeLevel: 0.96,
		spriteSizePx: 256,
	},
	population: {
		blankChance: 0.12,
		fullyBlankShare: 0.45,
		dimRange: [0.08, 0.22],
		baseRange: [0.55, 0.85],
		hotChance: 0.12,
		hotRange: [0.9, 1],
		clusterChance: 0.34,
		maxClusterRun: 4,
	},
	focus: {
		maxBlurPx: 64,
		minBlurPx: 2,
		holdSoftEnd: 90,
		pullInEnd: 170,
		holdSharpEnd: 250,
		pullOutEnd: 330,
	},
	exposure: {
		blurCompensationGain: 0.1,
		blurCompensationExponent: 0.7,
	},
	drift: {
		mode: 'closedDiagonal',
		pxPerSecond: 14,
		angleDeg: 45,
		lateralRatio: 0.08,
		tileCells: 2,
	},
	flicker: {
		amplitude: 0.08,
		periods: [360, 180, 120, 90, 72, 60, 45, 36],
	},
	flash: {
		minPerSecond: 1,
		maxPerSecond: 2,
		minFrames: 3,
		maxFrames: 4,
		boost: 0.35,
	},
	bloom: {
		enabled: true,
		downscale: 0.25,
		gammaPasses: 2,
		blurPx: 24,
		alpha: 0.4,
	},
	vignette: {
		strength: 0.18,
		innerStop: 0.32,
	},
	grain: {
		alpha: 0.04,
		tileSizePx: 256,
		tileCount: 12,
		bias: 1.35,
	},
	render: {
		halfResBlurThresholdPx: 24,
		halfResScale: 0.5,
	},
};

type ConfigOverride = {
	[K in keyof Config]?: Partial<Config[K]>;
};

/**
 * Per-variant deltas on top of `CONFIG`. A tilted-plane or scanning-sweep
 * version would land here as a focus/drift override plus a theme entry.
 */
const VARIANT_OVERRIDES: Partial<Record<VariantName, ConfigOverride>> = {
	standard: {},
};

export const getConfig = (variant: VariantName): Config => {
	const overrides = VARIANT_OVERRIDES[variant] ?? VARIANT_OVERRIDES[DEFAULT_VARIANT] ?? {};
	const merged = {...CONFIG} as Record<string, unknown>;
	for (const key of Object.keys(overrides) as (keyof Config)[]) {
		merged[key] = {...CONFIG[key], ...overrides[key]};
	}
	return merged as unknown as Config;
};

/** The largest distance the field is ever pushed from its home position. */
export const maxDriftOffset = (config: Config): number => {
	if (config.drift.mode === 'linearTiled') {
		return config.drift.tileCells * config.grid.pitchPx * Math.SQRT2;
	}
	return (config.drift.pxPerSecond * (config.timeline.durationInFrames / config.timeline.fps)) / 4;
};

/** Pixels of buffer generated outside the frame, so blurred off-screen spots bleed in. */
export const bufferMargin = (config: Config): number => {
	// A CSS blur of N px is a Gaussian with a standard deviation of N px, so its
	// visible reach is about 3N.
	const blurSpread = config.focus.maxBlurPx * 3;
	const spotReach = config.grid.radiusPx * (1 + config.grid.radiusVariance) + config.grid.jitterPx;
	return Math.ceil((blurSpread + spotReach + maxDriftOffset(config)) / 4) * 4;
};

/** Rings of spots generated outside the frame — always enough to fill the buffer margin. */
export const marginCells = (config: Config): number =>
	Math.max(config.grid.marginCells, Math.ceil(bufferMargin(config) / config.grid.pitchPx));
