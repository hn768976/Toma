export type TokenKind =
	| 'plain'
	| 'keyword'
	| 'string'
	| 'comment'
	| 'number'
	| 'type'
	| 'func'
	| 'punct'
	| 'error'
	| 'decorator';

export type Token = {kind: TokenKind; text: string};
export type Line = Token[];

export type LanguageSpec = {
	keywords: string[];
	types: string[];
	/** Identifiers rendered in the "exception / alarm" colour. */
	errors: string[];
	lineComment: string;
	/** Prefix that marks a decorator / attribute, e.g. `@` or `#[`. */
	decorator?: string;
	/** Delimiters that open and close a comment spanning several lines. */
	blockComment?: [string, string];
};

const PUNCT = new Set('()[]{}<>.,:;=+-*/%&|!?^~'.split(''));

const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
const isIdent = (c: string) => /[A-Za-z0-9_$]/.test(c);
const isDigit = (c: string) => /[0-9]/.test(c);

const push = (out: Line, kind: TokenKind, text: string) => {
	const last = out[out.length - 1];
	if (last && last.kind === kind) {
		last.text += text;
		return;
	}
	out.push({kind, text});
};

/**
 * A deliberately small hand-rolled lexer. It only has to convince at a glance --
 * most of the frame is out of focus -- and staying dependency-free keeps
 * highlighting a pure, synchronous step that runs once at module load.
 */
const tokenizeLine = (
	line: string,
	lang: LanguageSpec,
	state: {inBlock: boolean},
): Line => {
	const out: Line = [];
	const keywords = new Set(lang.keywords);
	const types = new Set(lang.types);
	const errors = new Set(lang.errors);

	// A block comment swallows whole lines until its closing delimiter, so a
	// Python docstring stays one dim run instead of being lexed as code.
	if (lang.blockComment) {
		const [open, close] = lang.blockComment;
		if (state.inBlock) {
			const end = line.indexOf(close);
			if (end === -1) {
				push(out, 'comment', line);
				return out;
			}
			state.inBlock = false;
			push(out, 'comment', line.slice(0, end + close.length));
			if (end + close.length < line.length) {
				for (const t of tokenizeLine(line.slice(end + close.length), lang, state)) {
					push(out, t.kind, t.text);
				}
			}
			return out;
		}
		const start = line.indexOf(open);
		if (start !== -1) {
			const end = line.indexOf(close, start + open.length);
			if (end === -1) {
				state.inBlock = true;
				push(out, 'plain', line.slice(0, start));
				push(out, 'comment', line.slice(start));
				return out;
			}
		}
	}

	// A whole-line comment (after indentation) colours the entire line.
	const trimmed = line.trimStart();
	if (lang.lineComment && trimmed.startsWith(lang.lineComment)) {
		push(out, 'plain', line.slice(0, line.length - trimmed.length));
		push(out, 'comment', trimmed);
		return out;
	}

	let i = 0;
	while (i < line.length) {
		const c = line[i];

		// Strings, including Python triple quotes and template literals.
		if (c === '"' || c === "'" || c === '`') {
			const triple = line.slice(i, i + 3);
			if (triple === '"""' || triple === "'''") {
				const end = line.indexOf(triple, i + 3);
				const stop = end === -1 ? line.length : end + 3;
				push(out, 'comment', line.slice(i, stop));
				i = stop;
				continue;
			}
			let j = i + 1;
			while (j < line.length && line[j] !== c) {
				j += line[j] === '\\' ? 2 : 1;
			}
			push(out, 'string', line.slice(i, Math.min(j + 1, line.length)));
			i = j + 1;
			continue;
		}

		if (lang.blockComment && line.startsWith(lang.blockComment[0], i)) {
			const close = lang.blockComment[1];
			const end = line.indexOf(close, i + lang.blockComment[0].length);
			const stop = end === -1 ? line.length : end + close.length;
			push(out, 'comment', line.slice(i, stop));
			i = stop;
			continue;
		}

		if (lang.lineComment && line.startsWith(lang.lineComment, i)) {
			push(out, 'comment', line.slice(i));
			break;
		}

		if (lang.decorator && line.startsWith(lang.decorator, i)) {
			let j = i + lang.decorator.length;
			while (j < line.length && (isIdent(line[j]) || line[j] === '.')) {
				j++;
			}
			push(out, 'decorator', line.slice(i, j));
			i = j;
			continue;
		}

		if (isDigit(c)) {
			let j = i;
			while (j < line.length && /[0-9a-fA-FxX._]/.test(line[j])) {
				j++;
			}
			push(out, 'number', line.slice(i, j));
			i = j;
			continue;
		}

		if (isIdentStart(c)) {
			let j = i;
			while (j < line.length && isIdent(line[j])) {
				j++;
			}
			const word = line.slice(i, j);
			let kind: TokenKind = 'plain';
			if (keywords.has(word)) {
				kind = 'keyword';
			} else if (errors.has(word)) {
				kind = 'error';
			} else if (types.has(word)) {
				kind = 'type';
			} else if (line[j] === '(') {
				kind = 'func';
			} else if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) {
				kind = 'type';
			}
			push(out, kind, word);
			i = j;
			continue;
		}

		push(out, PUNCT.has(c) ? 'punct' : 'plain', c);
		i++;
	}

	return out;
};

export const tokenize = (source: string, lang: LanguageSpec): Line[] => {
	const state = {inBlock: false};
	return source.split('\n').map((line) => tokenizeLine(line, lang, state));
};
