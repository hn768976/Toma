// Asset loading (map data, dots, font, HDRI, flag images). Each loader is
// cached per page so every frame in a worker reuses the same objects. Callers
// gate rendering with delayRender/continueRender until these resolve.
import {staticFile} from 'remotion';
import * as THREE from 'three';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {FLAGS, type FlagId} from '../flags/flags';
import type {GeoFC, Sources} from '../geo/buildShape';

const cache = new Map<string, Promise<unknown>>();
const once = <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key) as Promise<T>;
};

const json = async <T,>(path: string): Promise<T> => {
  const res = await fetch(staticFile(path));
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
};

export const loadSources = () =>
  once('sources', async (): Promise<Sources> => {
    const [w50, w10, ind, pak] = await Promise.all([
      json<GeoFC>('data/ne_50m_admin_0_countries.geojson'),
      json<GeoFC>('data/ne_10m_admin_0_countries_subset.geojson'),
      json<GeoFC>('data/ne_10m_admin_0_countries_ind_IND.geojson'),
      json<GeoFC>('data/ne_10m_admin_0_countries_pak_PAK.geojson'),
    ]);
    return {'50m': w50, '10m': w10, IND: ind, PAK: pak};
  });

export type Dots = {step: number; cols: number; rows: number; mask: string};
export const loadDots = () => once('dots', () => json<Dots>('data/world-dots.json'));

export const FONT_FAMILY = 'InterFlagMap';
export const loadFont = () =>
  once('font', async () => {
    const face = new FontFace(FONT_FAMILY, `url(${staticFile('fonts/Inter-Medium.woff2')}) format('woff2')`, {weight: '500'});
    await face.load();
    (document.fonts as unknown as {add: (f: FontFace) => void}).add(face);
    await document.fonts.ready;
    return face;
  });

export const loadHdri = () =>
  once('hdri', async () => {
    const tex = await new HDRLoader().loadAsync(staticFile('hdri/studio_small_03_1k.hdr'));
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  });

/** Ensure the SVG root has explicit pixel width/height so it rasterises at any size. */
const sizedSvg = (text: string, w: number, h: number) => {
  const open = text.match(/<svg[^>]*>/)![0];
  let fixed = open.replace(/\s(width|height)="[^"]*"/g, '');
  fixed = fixed.replace('<svg', `<svg width="${w * 100}" height="${h * 100}" preserveAspectRatio="none"`);
  return text.replace(open, fixed);
};

export const flagSvgText = async (id: FlagId) => {
  const def = FLAGS[id] as {w: number; h: number; svg?: string; file?: string};
  const text = def.svg ?? (await (await fetch(staticFile(def.file!))).text());
  return sizedSvg(text, def.w, def.h);
};

export const loadFlagImage = (id: FlagId) =>
  once(`flag:${id}`, async () => {
    const text = await flagSvgText(id);
    const url = URL.createObjectURL(new Blob([text], {type: 'image/svg+xml'}));
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  });
