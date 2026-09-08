/**
 * Flag SVGs, prepared for inlining.
 *
 * Flags are kept as vector all the way to the 4K frame — the flag fill is
 * clipped to the country silhouette, so it is scaled up hard and any raster
 * intermediate would show. Each file's own viewBox is preserved, which is what
 * keeps the national proportions correct (they are not all 2:3).
 */

import {readFileSync} from 'node:fs';

export interface PreparedFlag {
  /** The flag's own aspect box: [x, y, width, height] from its viewBox. */
  viewBox: [number, number, number, number];
  /** Everything inside the root <svg>, with ids namespaced. */
  inner: string;
  /** width / height, i.e. the official ratio as published. */
  ratio: number;
}

const VIEWBOX = /viewBox\s*=\s*"([^"]+)"/i;
const ROOT_OPEN = /<svg[^>]*>/i;
const ROOT_CLOSE = /<\/svg\s*>\s*$/i;
const COMMENT = /<!--[\s\S]*?-->/g;
const DOCTYPE = /<\?xml[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>/gi;

/**
 * Namespace every id in the file. Flag SVGs from Wikimedia are full of generic
 * ids ("a", "b", "path-1") and several are reused across files; inlining two of
 * them into one document without this would cross-wire gradients and clip paths.
 */
const namespaceIds = (svg: string, prefix: string): string => {
  const ids = new Set<string>();
  for (const m of svg.matchAll(/\sid\s*=\s*"([^"]+)"/g)) ids.add(m[1]);
  let out = svg;
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`(\\sid\\s*=\\s*")${esc}(")`, 'g'), `$1${prefix}${id}$2`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${prefix}${id})`)
      .replace(new RegExp(`((?:xlink:)?href\\s*=\\s*")#${esc}(")`, 'g'), `$1#${prefix}${id}$2`);
  }
  return out;
};

export const prepareFlag = (file: string, prefix: string): PreparedFlag => {
  let svg = readFileSync(file, 'utf8').replace(DOCTYPE, '').replace(COMMENT, '');

  const vbMatch = svg.match(VIEWBOX);
  if (!vbMatch) throw new Error(`${file}: no viewBox — cannot establish the flag's ratio`);
  const nums = vbMatch[1].trim().split(/[\s,]+/).map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
    throw new Error(`${file}: unreadable viewBox "${vbMatch[1]}"`);
  }
  const viewBox = nums as [number, number, number, number];

  const open = svg.match(ROOT_OPEN);
  if (!open) throw new Error(`${file}: no root <svg>`);
  svg = svg.slice(open.index! + open[0].length).replace(ROOT_CLOSE, '');
  const inner = namespaceIds(svg, prefix).trim();

  return {viewBox, inner, ratio: viewBox[2] / viewBox[3]};
};

/**
 * Official width:height ratios, for verification against the source files.
 * Sourced from each country's flag legislation / official specification.
 */
export const OFFICIAL_RATIOS: Record<string, number> = {
  USA: 19 / 10,
  CHN: 3 / 2,
  IND: 3 / 2,
  RUS: 3 / 2,
  JPN: 3 / 2,
  DEU: 5 / 3,
  GBR: 2,
  FRA: 3 / 2,
  BRA: 10 / 7,
  CAN: 2,
  IDN: 3 / 2,
  MEX: 7 / 4,
  TUR: 3 / 2,
  SAU: 3 / 2,
  KOR: 3 / 2,
  AUS: 2,
  ITA: 3 / 2,
  ESP: 3 / 2,
  ZAF: 3 / 2,
  POL: 8 / 5,
  NLD: 3 / 2,
  ARE: 2,
  SGP: 3 / 2,
  VNM: 3 / 2,
  NGA: 2,
  EGY: 3 / 2,
  ARG: 14 / 9,
  SWE: 8 / 5,
  THA: 3 / 2,
  PHL: 2,
  CHE: 1,
  NOR: 11 / 8,
  CHL: 3 / 2,
};
