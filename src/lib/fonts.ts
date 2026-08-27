import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {GEOMETRIC_SANS, TERMINAL_MONO} from '../variants';

/**
 * Canvas `fillText` silently falls back to a default face if the font is not
 * resolved yet, so drawing has to wait. The load is kicked off once at module
 * scope and every drawing component takes `fontsReady` as an effect dependency
 * so it repaints as soon as the faces land.
 */

const FACES: [string, string][] = [
	[GEOMETRIC_SANS, 'fonts/Poppins-SemiBold.ttf'],
	[TERMINAL_MONO, 'fonts/JetBrainsMono-Medium.ttf'],
];

let resolved = false;

const handle = delayRender('Loading halftone dashboard fonts');

const loading: Promise<void> = Promise.all(
	FACES.map(async ([family, file]) => {
		const face = new FontFace(family, `url(${staticFile(file)})`);
		await face.load();
		document.fonts.add(face);
	})
)
	.then(() => {
		resolved = true;
	})
	.catch((err) => {
		// eslint-disable-next-line no-console
		console.error('Font load failed', err);
		resolved = true;
	});

loading.then(() => continueRender(handle));

export const useFontsReady = (): boolean => {
	const [ready, setReady] = useState(resolved);
	useEffect(() => {
		if (ready) return;
		let live = true;
		loading.then(() => {
			if (live) setReady(true);
		});
		return () => {
			live = false;
		};
	}, [ready]);
	return ready;
};
