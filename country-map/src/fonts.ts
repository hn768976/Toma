import { staticFile } from 'remotion';

export const FONT_FAMILY = 'Source Sans 3';

let loading: Promise<void> | null = null;

/** Loads the three OFL Source Sans 3 weights once per tab. */
export const loadFonts = (): Promise<void> => {
	if (!loading) {
		const faces = [
			['SourceSans3-Regular.ttf', '400'],
			['SourceSans3-Semibold.ttf', '600'],
			['SourceSans3-Bold.ttf', '700'],
		].map(([file, weight]) => new FontFace(FONT_FAMILY, `url(${staticFile(`fonts/${file}`)})`, { weight }));
		loading = Promise.all(faces.map((f) => f.load())).then(async (loaded) => {
			loaded.forEach((f) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(f));
			await document.fonts.ready;
		});
	}
	return loading;
};
