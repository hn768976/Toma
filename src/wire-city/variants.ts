/**
 * variants.ts — THE single source of truth for every per-version difference.
 *
 * Rule enforced across this project: no colour hex literal exists anywhere
 * else in `src/`. Every colour, every camera-path selection, every building
 * render mode and every post-processing setting is read from `VARIANTS`.
 *
 * Adding a fourth version therefore means adding one entry here (plus a
 * `<Composition>` in Root.tsx) — never touching scene, camera or post code.
 */

export type VariantName = 'mint' | 'emerald' | 'blueprint';

/** Named camera-path modes. Each maps to a function in `camera-paths.ts`. */
export type CameraPathMode = 'orbit' | 'descend' | 'levelOrbit';

/** Named building render modes. Each maps to a branch in `Buildings.tsx`. */
export type BuildingRenderMode = 'wireframe' | 'windows' | 'blueprint';

export type Palette = {
	/** Scene clear colour. Also the colour distant geometry fades into. */
	background: string;
	/** Base colour of the ground dot grid at mid distance. */
	groundDot: string;
	/** Ground dots nearest the camera. */
	groundBright: string;
	/** Wireframe edge colour of the buildings. */
	buildingLine: string;
	/** Edge colour of the very tallest towers (height ramp target). */
	buildingGlow: string;
	/** Lit-window points (only used when buildingMode === 'windows'). */
	windowLit: string;
	/** Dimension lines / ticks (only used when annotations.enabled). */
	annotation: string;
	/** Horizon glow band. */
	haze: string;
	/**
	 * Opaque body colour of each building. Buildings are filled with this so
	 * that near wireframes correctly occlude far ones (hidden-line removal).
	 * Keep it very close to `background` so the fill reads as "empty".
	 */
	buildingFill: string;
	/** Colour the vignette pushes the corners toward. */
	vignette: string;
};

export type BloomSettings = {
	intensity: number;
	luminanceThreshold: number;
	luminanceSmoothing: number;
	mipmapBlur: boolean;
	radius: number;
};

export type PostSettings = {
	/** `null` = no Bloom pass is mounted at all (not "bloom at intensity 0"). */
	bloom: BloomSettings | null;
	vignette: {
		/** 0 = off. Positive = mix corners toward `palette.vignette`. */
		strength: number;
		/** Radius (0..1, normalised) at which the vignette starts. */
		offset: number;
	};
};

export type VariantConfig = {
	palette: Palette;
	cameraPath: CameraPathMode;
	buildingMode: BuildingRenderMode;
	/** Screen-space line width in px (LineMaterial, worldUnits=false). */
	lineWidth: number;
	/** Ramp edge brightness with building height (buildingLine -> buildingGlow). */
	heightRamp: boolean;
	/** Opacity of the wireframe edges. */
	lineOpacity: number;
	windows: {
		enabled: boolean;
		/** Frame range across which windows switch on, inclusive. */
		onFrom: number;
		onTo: number;
		/** Frames a single window takes to fade up. */
		fadeFrames: number;
		/** Fraction of the candidate window grid that is actually lit. */
		density: number;
		/** Window point size in WORLD units (attenuated with distance). */
		size: number;
	};
	annotations: {
		enabled: boolean;
		/** Number of dimension-line annotations. */
		count: number;
		/** Number of small ground tick marks. */
		tickCount: number;
		lineWidth: number;
	};
	ground: {
		/** Brightness multiplier for the whole dot grid. */
		intensity: number;
		/** Multiplier on the dot size, which is expressed in WORLD units. */
		dotSize: number;
	};
	/**
	 * Linear scene fog toward `palette.haze`. Wireframe edges fade into the
	 * haze with distance; the building fills opt out so occlusion stays clean.
	 */
	fog: {near: number; far: number};
	post: PostSettings;
	/** Alpha of the 2D film-grain layer over the canvas. */
	grainOpacity: number;
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
	/* ─────────────────────────── v1 — mint ─────────────────────────── */
	mint: {
		palette: {
			background: '#010D0A',
			groundDot: '#145247',
			groundBright: '#2E8F7A',
			buildingLine: '#4FFFD4',
			buildingGlow: '#A8FFE8',
			windowLit: '#A8FFE8',
			annotation: '#2E8F7A',
			haze: '#0A3D33',
			buildingFill: '#03150F',
			vignette: '#010D0A',
		},
		cameraPath: 'orbit',
		buildingMode: 'wireframe',
		lineWidth: 1.6,
		heightRamp: true,
		lineOpacity: 0.95,
		windows: {
			enabled: false,
			onFrom: 60,
			onTo: 380,
			fadeFrames: 8,
			density: 0.5,
			size: 0.62,
		},
		annotations: {enabled: false, count: 0, tickCount: 0, lineWidth: 1},
		ground: {intensity: 1.9, dotSize: 1},
		fog: {near: 210, far: 620},
		post: {
			bloom: {
				intensity: 1.55,
				luminanceThreshold: 0.24,
				luminanceSmoothing: 0.32,
				mipmapBlur: true,
				radius: 0.82,
			},
			vignette: {strength: 0.8, offset: 0.28},
		},
		grainOpacity: 0.04,
	},

	/* ────────────────────────── v2 — emerald ───────────────────────── */
	emerald: {
		palette: {
			background: '#020F04',
			groundDot: '#1A5C22',
			groundBright: '#3FA84F',
			buildingLine: '#3FFF6A',
			buildingGlow: '#8CFFA4',
			windowLit: '#C4FF8F',
			annotation: '#3FA84F',
			haze: '#0F4415',
			buildingFill: '#04170A',
			vignette: '#020F04',
		},
		cameraPath: 'descend',
		buildingMode: 'windows',
		lineWidth: 1.5,
		heightRamp: true,
		lineOpacity: 0.9,
		windows: {
			enabled: true,
			onFrom: 60,
			onTo: 380,
			fadeFrames: 9,
			density: 0.42,
			size: 0.62,
		},
		annotations: {enabled: false, count: 0, tickCount: 0, lineWidth: 1},
		ground: {intensity: 1.9, dotSize: 1},
		fog: {near: 210, far: 620},
		post: {
			bloom: {
				intensity: 1.05,
				luminanceThreshold: 0.28,
				luminanceSmoothing: 0.3,
				mipmapBlur: true,
				radius: 0.7,
			},
			vignette: {strength: 0.78, offset: 0.3},
		},
		grainOpacity: 0.04,
	},

	/* ───────────────────────── v3 — blueprint ──────────────────────── */
	blueprint: {
		palette: {
			background: '#EDF4F0',
			groundDot: '#B8CFC4',
			groundBright: '#8FB0A4',
			buildingLine: '#1F4A3A',
			buildingGlow: '#1F4A3A',
			windowLit: '#2E7A5F',
			annotation: '#2E7A5F',
			haze: '#D4E4DC',
			buildingFill: '#EDF4F0',
			vignette: '#FFFFFF',
		},
		cameraPath: 'levelOrbit',
		buildingMode: 'blueprint',
		lineWidth: 1.1,
		heightRamp: false,
		lineOpacity: 1,
		windows: {
			enabled: false,
			onFrom: 60,
			onTo: 380,
			fadeFrames: 8,
			density: 0.5,
			size: 0.62,
		},
		annotations: {enabled: true, count: 25, tickCount: 46, lineWidth: 0.9},
		ground: {intensity: 1, dotSize: 0.95},
		fog: {near: 240, far: 640},
		post: {
			// No Bloom pass is mounted for this variant — additive glow on a
			// light background is always wrong.
			bloom: null,
			// Corners are LIGHTENED ~12% toward palette.vignette (white).
			vignette: {strength: 0.12, offset: 0.34},
		},
		grainOpacity: 0.035,
	},
};
