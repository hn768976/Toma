import {continueRender, delayRender, staticFile} from 'remotion';

export const MONO_FAMILY = 'MacroMono';

/**
 * The monospace face is embedded in `public/fonts` rather than pulled from a
 * system stack: a substituted font changes the advance width and line height,
 * and the integer-line scroll loop depends on the line height being exactly
 * what the layout maths assumes.
 */
const FACES = [
	{weight: 400, file: 'fonts/JetBrainsMono-400.woff2'},
	{weight: 500, file: 'fonts/JetBrainsMono-500.woff2'},
	{weight: 700, file: 'fonts/JetBrainsMono-700.woff2'},
];

let installed = false;

export const loadMonoFont = () => {
	if (installed || typeof document === 'undefined') {
		return;
	}
	installed = true;

	const css = FACES.map(
		({weight, file}) => `@font-face{
  font-family:'${MONO_FAMILY}';
  src:url('${staticFile(file)}') format('woff2');
  font-weight:${weight};
  font-style:normal;
  font-display:block;
}`,
	).join('\n');

	const style = document.createElement('style');
	style.textContent = css;
	document.head.appendChild(style);

	const handle = delayRender('Loading embedded monospace font');
	Promise.all(
		FACES.map(({weight}) =>
			document.fonts.load(`${weight} 100px '${MONO_FAMILY}'`),
		),
	)
		.then(() => document.fonts.ready)
		.then(() => continueRender(handle))
		.catch(() => continueRender(handle));
};
