import { staticFile } from 'remotion';

// OFL fonts shipped in public/fonts (from @fontsource): Share Tech Mono for numbers, Rajdhani for labels.
export const MONO = '"Share Tech Mono", monospace';
export const LABEL = '"Rajdhani", sans-serif';

let p: Promise<void> | null = null;
export function loadFonts(): Promise<void> {
  if (p) return p;
  const faces = [
    new FontFace('Share Tech Mono', `url(${staticFile('fonts/share-tech-mono-latin-400-normal.woff2')})`, { weight: '400' }),
    new FontFace('Rajdhani', `url(${staticFile('fonts/rajdhani-latin-500-normal.woff2')})`, { weight: '500' }),
    new FontFace('Rajdhani', `url(${staticFile('fonts/rajdhani-latin-600-normal.woff2')})`, { weight: '600' }),
    new FontFace('Rajdhani', `url(${staticFile('fonts/rajdhani-latin-700-normal.woff2')})`, { weight: '700' }),
  ];
  p = Promise.all(faces.map((f) => f.load())).then((loaded) => {
    loaded.forEach((f) => (document.fonts as unknown as { add: (x: FontFace) => void }).add(f));
  });
  return p;
}
