import opentype from 'opentype.js';
import { Shape, Vector2 } from 'three';
import { staticFile } from 'remotion';
import type { IconRow } from '../icons';
import {
  glyphPathToPolygons,
  polygonBounds,
  polygonsToOutlines,
  polygonsToShapes,
  svgToPolygons,
} from './geometry2d';

export type LabelAssets = {
  shapes: Shape[];
  width: number;
  height: number; // world units, baseline-to-cap of the whole block
};

export type IconAssets = {
  shapes: Shape[];
  outlines: Vector2[][];
  width: number;
  height: number;
  label: LabelAssets | null;
};

// World-unit sizes shared by every icon.
export const LABEL_CAP_HEIGHT = 0.115;
export const LABEL_MAX_WIDTH = 1.25;
const LABEL_LINE_GAP = 0.055;
const LABEL_TRACKING = 0.06; // em

let fontPromise: Promise<opentype.Font> | null = null;
export const loadFont = () => {
  if (!fontPromise) {
    fontPromise = fetch(staticFile('fonts/Montserrat-Bold.ttf'))
      .then((r) => {
        if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => opentype.parse(b));
  }
  return fontPromise;
};

// Work in 100-unit font size for Clipper precision, scale to world after.
const FONT_UNITS = 100;

const lineWidth = (font: opentype.Font, text: string) => {
  const glyphs = font.stringToGlyphs(text);
  const scale = FONT_UNITS / font.unitsPerEm;
  let w = 0;
  glyphs.forEach((g, i) => {
    w += (g.advanceWidth ?? 0) * scale;
    if (i < glyphs.length - 1) w += LABEL_TRACKING * FONT_UNITS;
  });
  return w;
};

const linePath = (font: opentype.Font, text: string, x0: number, y0: number) => {
  const glyphs = font.stringToGlyphs(text);
  const scale = FONT_UNITS / font.unitsPerEm;
  const path = new opentype.Path();
  let x = x0;
  for (const g of glyphs) {
    path.extend(g.getPath(x, y0, FONT_UNITS));
    x += (g.advanceWidth ?? 0) * scale + LABEL_TRACKING * FONT_UNITS;
  }
  return path;
};

const buildLabel = (font: opentype.Font, text: string): LabelAssets => {
  const capUnits = ((font.tables.os2?.sCapHeight as number) || 700) / font.unitsPerEm * FONT_UNITS;
  const toWorld = LABEL_CAP_HEIGHT / capUnits;
  // auto-wrap to two balanced lines if too wide
  let lines = [text];
  if (lineWidth(font, text) * toWorld > LABEL_MAX_WIDTH && text.includes(' ')) {
    const words = text.split(' ');
    let best = lines;
    let bestW = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const w = Math.max(lineWidth(font, a), lineWidth(font, b));
      if (w < bestW) { bestW = w; best = [a, b]; }
    }
    lines = best;
  }
  const maxW = Math.max(...lines.map((l) => lineWidth(font, l)));
  const shrink = Math.min(1, LABEL_MAX_WIDTH / (maxW * toWorld));
  const s = toWorld * shrink;
  const lineStep = capUnits + LABEL_LINE_GAP / s;
  const polys = lines.flatMap((l, i) =>
    glyphPathToPolygons(linePath(font, l, -lineWidth(font, l) / 2, i * lineStep)),
  );
  const lastBaseline = (lines.length - 1) * lineStep;
  // origin: x centred, y = baseline of the last line
  const shapes = polygonsToShapes(polys, 0, lastBaseline, s);
  return {
    shapes,
    width: maxW * s,
    height: (lastBaseline + capUnits) * s,
  };
};

const cache = new Map<string, Promise<IconAssets>>();

export const loadIconAssets = (row: IconRow): Promise<IconAssets> => {
  const key = `${row.id}|${row.svgPath}|${row.label ?? ''}|${row.iconScale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetch(staticFile(row.svgPath));
    if (!res.ok) throw new Error(`SVG fetch failed for ${row.id}: ${res.status}`);
    const polys = svgToPolygons(await res.text());
    const b = polygonBounds(polys);
    const s = row.iconScale / 100; // 100 SVG units → iconScale world units
    const ox = (b.minX + b.maxX) / 2;
    const oy = b.maxY; // bottom of the icon sits on y = 0
    const shapes = polygonsToShapes(polys, ox, oy, s);
    const outlines = polygonsToOutlines(polys, ox, oy, s);
    const label = row.label ? buildLabel(await loadFont(), row.label) : null;
    return {
      shapes,
      outlines,
      width: (b.maxX - b.minX) * s,
      height: (b.maxY - b.minY) * s,
      label,
    };
  })();
  cache.set(key, p);
  return p;
};
