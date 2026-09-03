/**
 * Builds one block of cards and lays them out so the block tiles seamlessly
 * along the scroll axis.
 *
 * Cards are positioned across the axis so that every headline's keyword lands
 * on the same screen point, which is what lets the eye stop hunting for it.
 * Along the axis they overlap slightly, so one card is always partly entering
 * as another is partly leaving and the background never shows through as a gap.
 *
 * The whole thing is built once per variant and cached: card layout is
 * expensive, blitting is not.
 */
import { ArticleCard, type ArticleCardPalette } from "./vendor/ArticleCard";
import { composeMotionBlurred, type ComposedSprite } from "./vendor/motion-blur-compose";
import { randRange } from "./vendor/seeded-random";
import { SANS, SERIF, UI } from "./fonts";
import { VARIANTS, type Palette, type VariantName } from "./variants";

export interface SceneCard {
  composed: ComposedSprite;
  /** Centre of the card along the scroll axis, within one block. */
  mainCentre: number;
  /** Centre of the card across the scroll axis — fixed for the whole loop. */
  crossCentre: number;
}

export interface Scene {
  cards: SceneCard[];
  /** One block length: the exact distance the scroll covers in one loop. */
  blockLength: number;
}

const MOTION_SAMPLES = 9;

/** Maps this project's palette onto the library's role-named one. */
const cardPalette = (p: Palette): ArticleCardPalette => ({
  surface: p.cardBase,
  surfaceAlt: p.cardAlt,
  surfaceShade: p.texture,
  inkStrong: p.inkBlack,
  inkMid: p.inkMid,
  inkSoft: p.inkLight,
  ruleDark: p.ruleDark,
  ruleAccent: p.ruleAccent,
  imagePlaceholder: p.imageGrey,
});

const cache = new Map<string, Scene>();

export const buildScene = (
  variantName: VariantName,
  width: number,
  height: number,
  durationInFrames: number,
): Scene => {
  const key = `${variantName}-${width}x${height}-${durationInFrames}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const v = VARIANTS[variantName];
  const vertical = v.axis === "vertical";
  const fonts = { serif: SERIF, sans: SANS, ui: UI };
  const palette = cardPalette(v.palette);

  // Pass 1 — lay every card out, so the exact block length (and therefore the
  // exact scroll speed, and therefore the motion blur) is known.
  const built = [];
  for (let i = 0; i < v.cardCount; i += 1) {
    const seed = `${variantName}-card-${i}`;
    const cardWidth = vertical
      ? randRange(`${seed}-w`, v.crossMin, v.crossMax)
      : randRange(`${seed}-w`, v.mainMin, v.mainMax);
    const targetHeight = vertical
      ? randRange(`${seed}-h`, v.mainMin, v.mainMax)
      : randRange(`${seed}-h`, v.crossMin, v.crossMax);
    const layers = ArticleCard({
      seed,
      headline: v.headlines[i % v.headlines.length],
      keyword: v.keyword,
      palette,
      fonts,
      width: cardWidth,
      targetHeight,
      headlineSize: v.headlineSize,
      headroom: v.headroom,
      serifBias: v.serifBias,
      serifLabels: v.serifLabels,
      focusBlurMax: v.focusBlurMax,
      focusFalloff: v.focusFalloff,
      texturedSurface: v.paper,
      sectionColor: v.paper ? v.palette.inkMid : v.palette.ruleAccent,
      wordmarks: v.wordmarks,
      sections: v.sections,
      bylines: v.bylines,
      dates: v.dates,
      breadcrumbs: v.breadcrumbs,
    });
    const tilt = v.tiltDeg === 0 ? 0 : randRange(`${seed}-tilt`, -v.tiltDeg, v.tiltDeg);
    const theta = (tilt * Math.PI) / 180;
    const extentAlongAxis = vertical
      ? layers.width * Math.abs(Math.sin(theta)) + layers.height * Math.abs(Math.cos(theta))
      : layers.width * Math.abs(Math.cos(theta)) + layers.height * Math.abs(Math.sin(theta));
    const overlap = randRange(`${seed}-ov`, v.overlapMin, v.overlapMax);
    built.push({ seed, layers, tilt, extentAlongAxis, overlap });
  }

  const blockLength = built.reduce((sum, c) => sum + c.extentAlongAxis - c.overlap, 0);
  const perFrameTravel = blockLength / durationInFrames;

  // Pass 2 — bake tilt, shadow and motion blur, then place.
  const cards: SceneCard[] = [];
  let cursor = 0;
  for (const item of built) {
    const composed = composeMotionBlurred(item.layers, {
      axis: v.axis,
      tiltDeg: item.tilt,
      shutter: perFrameTravel * v.shutter,
      overlayShutter: perFrameTravel * v.keywordShutter,
      samples: MOTION_SAMPLES,
      shadow: v.paper
        ? { color: v.palette.shadow, alpha: 0.26, blur: 34, offset: 22 }
        : null,
    });

    // The keyword lands on the same screen point for every card. A couple of
    // pixels of jitter keeps it from looking mechanically pinned.
    const jitter = randRange(`${item.seed}-anchor`, -18, 18);
    const crossCentre = vertical
      ? width * v.anchorCross + jitter - composed.anchorOffsetX
      : height * v.anchorCross + jitter - composed.anchorOffsetY;

    cards.push({
      composed,
      mainCentre: cursor + item.extentAlongAxis / 2,
      crossCentre,
    });
    cursor += item.extentAlongAxis - item.overlap;
  }

  const scene: Scene = { cards, blockLength };
  cache.set(key, scene);
  return scene;
};
