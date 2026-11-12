export type FiberPalette = {
	name: string;
	bgTop: string;
	bgMid: string;
	bgBottom: string;
	bgGlow: string;
	strandEdge: string;
	strandCore: string;
	strandHead: string;
	tip: string;
	envSky: string;
	envHorizon: string;
	envSoftbox: string;
	envRim: string;
	keyLight: string;
	rimLight: string;
	boot: string;
	glowPort: string;
	lift: [number, number, number];
	gain: [number, number, number];
};

/** Version 1 — matches the reference: electric blue fibres on deep navy. */
export const REFERENCE_BLUE: FiberPalette = {
	name: 'Reference Blue',
	bgTop: '#0b1d40',
	bgMid: '#1a407e',
	bgBottom: '#050d1d',
	bgGlow: '#1b7d9e',
	strandEdge: '#1257d6',
	strandCore: '#57b8ff',
	strandHead: '#d9f3ff',
	tip: '#b8e6ff',
	envSky: '#2a5cb0',
	envHorizon: '#0d2350',
	envSoftbox: '#cfe6ff',
	envRim: '#2fa8ff',
	keyLight: '#a9cfff',
	rimLight: '#3aa0ff',
	boot: '#2463b8',
	glowPort: '#e6f6ff',
	lift: [0.0, 0.004, 0.012],
	gain: [0.97, 1.0, 1.04],
};

/** Version 2 — alternative palette: molten amber/copper fibres on deep plum. */
export const AMBER_PLUM: FiberPalette = {
	name: 'Amber Plum',
	bgTop: '#1e0918',
	bgMid: '#521a45',
	bgBottom: '#0c040a',
	bgGlow: '#b8481c',
	strandEdge: '#d9400f',
	strandCore: '#ff9a3c',
	strandHead: '#fff0d6',
	tip: '#ffd9a8',
	envSky: '#8a3a52',
	envHorizon: '#2a0d24',
	envSoftbox: '#ffe2c4',
	envRim: '#ff7a2e',
	keyLight: '#ffc89a',
	rimLight: '#ff6a2a',
	boot: '#e8641e',
	glowPort: '#fff1dc',
	lift: [0.012, 0.002, 0.008],
	gain: [1.04, 0.99, 0.96],
};
