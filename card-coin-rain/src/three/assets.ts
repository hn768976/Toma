import {
  Color,
  DataTexture,
  DataUtils,
  EquirectangularReflectionMapping,
  FloatType,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  RGBAFormat,
  Texture,
} from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { staticFile } from "remotion";
import { Look } from "../lib/looks";
import {
  makeBarTextures,
  makeBrushedTextures,
  makeCardPrintTexture,
  makeChipTextures,
  makeCoinTextures,
  makeFoilTextures,
} from "./textures";

export type Assets = {
  hdri: DataTexture;
  cardFront: { normal: Texture; roughness: Texture };
  coin: { normal: Texture; roughness: Texture };
  bar: { normal: Texture; roughness: Texture } | null;
  chip: { color: Texture; bump: Texture };
  print: Texture | null;
};

let fontsPromise: Promise<void> | null = null;
const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const faces = [
        new FontFace("Inter", `url(${staticFile("fonts/Inter-Regular.woff2")}) format("woff2")`, { weight: "400" }),
        new FontFace("Inter", `url(${staticFile("fonts/Inter-Medium.woff2")}) format("woff2")`, { weight: "500" }),
      ];
      for (const f of faces) {
        await f.load();
        (document.fonts as unknown as Set<FontFace>).add(f);
      }
      await document.fonts.ready;
    })();
  }
  return fontsPromise;
};

let hdriPromise: Promise<DataTexture> | null = null;
const loadHdri = () => {
  if (!hdriPromise) {
    hdriPromise = new HDRLoader()
      .setDataType(FloatType)
      .loadAsync(staticFile("hdri/studio_small_03_1k.hdr"));
  }
  return hdriPromise;
};

/**
 * Grade the studio HDRI toward each look's set: compress its peaks, tint it, lift its black
 * surroundings toward the backdrop colour, so the metals reflect a warm
 * beige (or pink) room instead of a dark grey one. Stored as half float.
 */
const gradeEnv = (src: DataTexture, look: Look) => {
  const { width: w, height: h } = src.image;
  const data = src.image.data as Float32Array;
  const tint = new Color(look.env.tint);
  const amb = new Color(look.env.ambient);
  const k = look.env.ambientAmount;
  const out = new Uint16Array(w * h * 4);
  const white = look.env.peak;
  for (let i = 0; i < w * h; i++) {
    // Soft-compress the softbox peaks (~3400 in the raw file): at the
    // roughness of a flat ingot face they otherwise fill it with flat white.
    const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    const c = white > 0 ? (look.env.gain * (1 + l / (white * white))) / (1 + l / white) : look.env.gain;
    const r = data[i * 4] * tint.r * c + amb.r * k;
    const g = data[i * 4 + 1] * tint.g * c + amb.g * k;
    const b = data[i * 4 + 2] * tint.b * c + amb.b * k;
    out[i * 4] = DataUtils.toHalfFloat(r);
    out[i * 4 + 1] = DataUtils.toHalfFloat(g);
    out[i * 4 + 2] = DataUtils.toHalfFloat(b);
    out[i * 4 + 3] = DataUtils.toHalfFloat(1);
  }
  const t = new DataTexture(out, w, h, RGBAFormat, HalfFloatType);
  t.mapping = EquirectangularReflectionMapping;
  t.colorSpace = LinearSRGBColorSpace;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.flipY = true;
  t.needsUpdate = true;
  return t;
};

let rectInit = false;

const cache = new Map<string, Promise<Assets>>();

/** Loads the HDRI + font and bakes every procedural texture. Cached per look. */
export const loadAssets = (look: Look): Promise<Assets> => {
  const hit = cache.get(look.id);
  if (hit) return hit;
  const p = (async () => {
    if (!rectInit) {
      RectAreaLightUniformsLib.init();
      rectInit = true;
    }
    const [raw] = await Promise.all([loadHdri(), loadFonts()]);
    const hdri = gradeEnv(raw, look);
    const gold = look.id === "gold";
    return {
      hdri,
      cardFront: gold ? makeFoilTextures() : makeBrushedTextures(),
      coin: makeCoinTextures(),
      bar: look.bars ? makeBarTextures() : null,
      chip: gold
        ? makeChipTextures("#F0BE4C", "#FFE39A", "#7A4E12")
        : makeChipTextures("#D9A54A", "#F1CF86", "#8B6129"),
      print: look.card.text ? makeCardPrintTexture("#7B443F") : null,
    };
  })();
  cache.set(look.id, p);
  return p;
};
