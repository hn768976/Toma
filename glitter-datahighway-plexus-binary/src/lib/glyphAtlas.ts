// JetBrains Mono glyph atlas, built once per page. Loads the bundled OFL font
// with the FontFace API and draws the characters into a canvas; callers wait
// on the promise with delayRender/continueRender before the first frame.
import { staticFile } from "remotion";

export const GLYPHS = ["0", "1", "S", "H", "T", "=", "+"];
export const CELL_PX = 128;

let atlasPromise: Promise<HTMLCanvasElement> | null = null;

export const loadGlyphAtlas = () => {
  if (atlasPromise) return atlasPromise;
  atlasPromise = (async () => {
    const face = new FontFace("JetBrains Mono Atlas", `url(${staticFile("fonts/JetBrainsMono-Bold.woff2")}) format("woff2")`, { weight: "700" });
    await face.load();
    (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    const canvas = document.createElement("canvas");
    canvas.width = CELL_PX * 8; // 7 glyphs + one empty cell; power of two for mipmaps
    canvas.height = CELL_PX;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(CELL_PX * 0.74)}px "JetBrains Mono Atlas"`;
    GLYPHS.forEach((g, i) => ctx.fillText(g, i * CELL_PX + CELL_PX / 2, CELL_PX * 0.53));
    return canvas;
  })();
  return atlasPromise;
};
