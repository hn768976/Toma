// Font + generated textures. Everything is built once per acronym and
// cached at module level; the composition holds a delayRender() handle until
// it is ready, so no frame can render with blank cubes or a missing font.

import { staticFile } from "remotion";
import type { AcronymRow } from "../data/acronyms";
import { sideFacesFor } from "../lib/sideFaces";
import { lightPatternCanvas } from "../textures/lightPattern";
import { paperCanvas } from "../textures/paper";
import { FONT_FAMILY, contactCanvas, cubeFaces } from "../textures/wood";

export type SceneAssets = {
  paper: HTMLCanvasElement;
  faces: HTMLCanvasElement[][]; // [cube][face], BoxGeometry group order
  pattern: HTMLCanvasElement;
  contact: HTMLCanvasElement;
};

let fontPromise: Promise<void> | null = null;

export const loadFont = () => {
  if (!fontPromise) {
    fontPromise = (async () => {
      const face = new FontFace(
        FONT_FAMILY,
        `url(${staticFile("fonts/ArchivoBlack-Regular.woff2")}) format("woff2")`,
      );
      await face.load();
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
      await document.fonts.ready;
      if (!document.fonts.check(`100px "${FONT_FAMILY}"`)) {
        throw new Error(`${FONT_FAMILY} failed to load`);
      }
    })();
  }
  return fontPromise;
};

const cache = new Map<string, Promise<SceneAssets>>();

export const loadSceneAssets = (row: AcronymRow): Promise<SceneAssets> => {
  const key = `${row.id}/${row.seed}/${row.shape}`;
  let p = cache.get(key);
  if (!p) {
    p = loadFont().then(() => {
      const sides = sideFacesFor(row);
      return {
        paper: paperCanvas(row),
        faces: sides.map((chars, i) => cubeFaces(`${row.id}/${row.seed}/${i}`, chars)),
        pattern: lightPatternCanvas(),
        contact: contactCanvas(),
      };
    });
    cache.set(key, p);
  }
  return p;
};
