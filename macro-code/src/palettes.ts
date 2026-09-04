import type {TokenKind} from './code/tokenize';
import type {CorpusName} from './code/sources';

export type Palette = {
	id: string;
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
};

const V1: Palette = {
	id: 'V1-MacroCodeBlue',
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
};

const V2: Palette = {
	id: 'V2-MacroCodeCyan',
	corpus: 'typescript',
	background: '#04151c',
	token: {
		plain: '#d6f3fa',
		keyword: '#22d3ee',
		string: '#7ee8c8',
		comment: '#3f6f7d',
		number: '#f4a2b6',
		type: '#8fdcf0',
		func: '#5fd0e8',
		punct: '#5f93a4',
		// The one warm note, so the frame reads cyan rather than monochrome.
		error: '#ff7b93',
		decorator: '#9ae6d8',
	},
	cast: '#0596aa',
	castOpacity: 0.16,
	flare: 'rgba(186, 244, 255, 1)',
	flareStreak: 'rgba(214, 250, 255, 1)',
	glow: 1.15,
};

const V3: Palette = {
	id: 'V3-MacroCodeGreen',
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
};

export const PALETTES = {V1, V2, V3};
