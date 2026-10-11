// Asset loading (flag images, HDRI), cached per page. Callers gate rendering
// with delayRender/continueRender until these resolve.
import {staticFile} from 'remotion';
import * as THREE from 'three';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {FLAGS, type FlagDef, type FlagId} from '../flags/flags';

const cache = new Map<string, Promise<unknown>>();
const once = <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key) as Promise<T>;
};

export const loadHdri = () =>
  once('hdri', async () => {
    const tex = await new HDRLoader().loadAsync(staticFile('hdri/studio_small_03_1k.hdr'));
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  });

/** SVG root with explicit pixel size (and the official-ratio viewBox if one is set). */
const sizedSvg = (text: string, def: FlagDef) => {
  const open = text.match(/<svg[^>]*>/)![0];
  let fixed = open.replace(/\s(width|height)="[^"]*"/g, '');
  if (def.viewBox) fixed = fixed.replace(/viewBox="[^"]*"/, `viewBox="${def.viewBox}"`);
  fixed = fixed.replace('<svg', `<svg width="${def.w * 100}" height="${def.h * 100}" preserveAspectRatio="none"`);
  return text.replace(open, fixed);
};

export const flagSvgText = async (id: FlagId) => {
  const def = FLAGS[id] as FlagDef;
  const text = def.svg ?? (await (await fetch(staticFile(def.file!))).text());
  return sizedSvg(text, def);
};

export const loadFlagImage = (id: FlagId) =>
  once(`flag:${id}`, async () => {
    const text = await flagSvgText(id);
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([text], {type: 'image/svg+xml'}));
    await img.decode();
    return img;
  });
