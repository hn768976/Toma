import { staticFile } from "remotion";

// Fonts (OFL) and the Natural Earth dot grid are loaded once per page and
// awaited (delayRender) before the first frame is drawn.

export const MONO = "FS JetBrains Mono";
export const SANS = "FS Inter";

export type WorldDots = {
  cols: number;
  rows: number;
  grid: string[];
  // land cells as [col, row] pairs, precomputed
  cells: Int16Array;
};

export type Assets = { world: WorldDots };

let promise: Promise<Assets> | null = null;

const FONTS: [string, string, string][] = [
  [MONO, "fonts/jetbrains-mono-latin-400-normal.woff2", "400"],
  [MONO, "fonts/jetbrains-mono-latin-500-normal.woff2", "500"],
  [SANS, "fonts/inter-latin-400-normal.woff2", "400"],
  [SANS, "fonts/inter-latin-500-normal.woff2", "500"],
  [SANS, "fonts/inter-latin-600-normal.woff2", "600"],
];

export const loadAssets = (): Promise<Assets> => {
  if (promise) return promise;
  promise = (async () => {
    await Promise.all(
      FONTS.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        await face.load();
        document.fonts.add(face);
      }),
    );
    const res = await fetch(staticFile("data/world-dots.json"));
    const json = (await res.json()) as { cols: number; rows: number; grid: string[] };
    const cells: number[] = [];
    json.grid.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === "1") cells.push(c, r);
    });
    return { world: { ...json, cells: new Int16Array(cells) } };
  })();
  return promise;
};
