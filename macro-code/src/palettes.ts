import type {TokenKind} from './code/tokenize';
import type {CorpusName} from './code/sources';

export type Palette = {
	id: string;
	/** Deliverable file stem; composition ids may not contain underscores. */
	outputName: string;
	corpus: CorpusName;
	/** Colour of the screen surface behind the glyphs. */
	background: string;
	token: Record<TokenKind, string>;
	/** Full-frame cast laid over everything, and how strongly. */
	cast: string;
	castOpacity: number;
	/** Tint of the corner flare. */
	flare: string;
	flareStreak: string;
	/** Multiplier on glyph glow; phosphor reads hotter than an LCD. */
	glow: number;
	/** Deepest background plane, seen as soft colour blocks. */
	deepTint: string;
};

const V1: Palette = {
	id: 'V1-MacroCodeBlue',
	outputName: 'V1_MacroCodeBlue',
	corpus: 'python',
	background: '#0a1420',
	token: {
		plain: '#dfe9f7',
		keyword: '#4fc3f7',
		string: '#e5c07b',
		comment: '#5b6b80',
		number: '#d19a66',
		type: '#9d8fd6',
		func: '#7fc4e8',
		punct: '#7e94ad',
		error: '#e06c75',
		decorator: '#7fd6c0',
	},
	cast: '#0f3f7a',
	castOpacity: 0.12,
	flare: 'rgba(196, 226, 255, 1)',
	flareStreak: 'rgba(214, 236, 255, 1)',
	glow: 1,
	deepTint: '#0c2036',
};

const V2: Palette = {
	id: 'V2-MacroCodeAmber',
	outputName: 'V2_MacroCodeAmber',
	corpus: 'typescript',
	background: '#150d07',
	token: {
		plain: '#f2e2cc',
		keyword: '#ffb454',
		string: '#7fd4c1',
		comment: '#7a5f45',
		number: '#ff8f57',
		type: '#ffd08a',
		func: '#ffc98c',
		punct: '#b99672',
		error: '#ff6b5e',
		decorator: '#8fd8c8',
	},
	cast: '#8a3d05',
	castOpacity: 0.14,
	flare: 'rgba(255, 226, 178, 1)',
	flareStreak: 'rgba(255, 238, 208, 1)',
	glow: 1.1,
	deepTint: '#2a1608',
};

const V3: Palette = {
	id: 'V3-MacroCodeGreen',
	outputName: 'V3_MacroCodeGreen',
	corpus: 'rust',
	background: '#030705',
	token: {
		plain: '#4ade80',
		keyword: '#a7f3c4',
		string: '#86efac',
		comment: '#1f6b3d',
		number: '#bbf7d0',
		type: '#6ee7a4',
		func: '#5ee68e',
		punct: '#2f8f57',
		error: '#dcffc9',
		decorator: '#34d399',
	},
	cast: '#053a1c',
	castOpacity: 0.1,
	flare: 'rgba(190, 255, 214, 1)',
	flareStreak: 'rgba(214, 255, 228, 1)',
	glow: 1.6,
	deepTint: '#04150b',
};

export const PALETTES = {V1, V2, V3};
