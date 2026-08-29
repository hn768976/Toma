// Typeface for the whole notation library.
//
// IBM Plex Sans: a technical sans with near-uniform stems (so it sits
// consistently beside the hairline vector symbols in symbols.ts), full Greek
// coverage for the physics and mathematics sets, and lining figures that stay
// legible when set at 60% as a subscript.
//
// The font is taken from @remotion/google-fonts, which supplies the family
// name, the subset unicode-ranges and the URLs of the exact woff2 subsets.
// Those subsets are vendored into public/fonts by `npm run vendor-font`, and
// the faces are registered from there rather than fetched at render time: a
// 4K master must not fail because fonts.gstatic.com was unreachable, and the
// glyph atlas is measured with measureText(), so a fallback face silently
// substituted mid-render would misplace every subscript in the piece.
//
// The load is gated with delayRender()/continueRender(), so no frame is
// captured — in the Studio or under `npx remotion render` — before the faces
// are rasterisable.

import { getInfo } from "@remotion/google-fonts/IBMPlexSans";
import { continueRender, delayRender, staticFile } from "remotion";

const INFO = getInfo();

export const FONT_FAMILY = INFO.fontFamily;
export const FONT_WEIGHT = 300;

/** Latin for element symbols and operators, Greek for ψ, λ, ω, θ, Δ and π. */
export const FONT_SUBSETS = ["latin", "greek"] as const;
export const FONT_STYLES = ["normal", "italic"] as const;

export const vendoredFontPath = (style: string, subset: string) =>
  `fonts/ibm-plex-sans/${style}-${FONT_WEIGHT}-${subset}.woff2`;

const handle = delayRender("Loading IBM Plex Sans for the notation library");

const load = async () => {
  await Promise.all(
    FONT_STYLES.flatMap((style) =>
      FONT_SUBSETS.map(async (subset) => {
        const face = new FontFace(
          FONT_FAMILY,
          `url(${staticFile(vendoredFontPath(style, subset))}) format("woff2")`,
          {
            weight: String(FONT_WEIGHT),
            style,
            unicodeRange: INFO.unicodeRanges[subset],
          },
        );
        document.fonts.add(await face.load());
      }),
    ),
  );

  // Force the faces the atlas is measured with to be decoded before anything
  // calls measureText().
  await Promise.all([
    document.fonts.load(`${FONT_WEIGHT} 88px "${FONT_FAMILY}"`, "0123456789ABCabc"),
    document.fonts.load(`italic ${FONT_WEIGHT} 88px "${FONT_FAMILY}"`, "0123456789ABCabc"),
    document.fonts.load(`${FONT_WEIGHT} 88px "${FONT_FAMILY}"`, "λψωΔπθ"),
  ]);
};

/**
 * Resolves once the notation typeface is ready. Every canvas pass awaits this
 * before drawing, which keeps the passes in tree order (promise callbacks run
 * in the order they were attached) without any component-level state.
 */
export const fontsReady: Promise<void> = load()
  .catch((err) => {
    console.error("Failed to load IBM Plex Sans", err);
  })
  .then(() => {
    continueRender(handle);
  });
