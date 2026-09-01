/**
 * Condensed technical sans for every readout.
 *
 * Loading is gated with delayRender()/continueRender() so no frame is ever
 * captured before the face is available to the canvas.
 *
 * By default the woff2 files bundled in `public/fonts` are used: the render
 * then needs no network at all, which keeps `npx remotion render` fast and
 * deterministic on any machine (and works behind a TLS-inspecting proxy,
 * where the headless browser cannot reach fonts.gstatic.com). Flip
 * USE_GOOGLE_FONTS_CDN to true to pull the identical family through
 * @remotion/google-fonts instead.
 */
import { continueRender, delayRender, staticFile } from "remotion";

export const FONT = "Barlow Condensed";

const WEIGHTS = ["400", "500", "600", "700"] as const;

export const USE_GOOGLE_FONTS_CDN = false;

const handle = delayRender("Loading the condensed technical sans");

const warmUp = async (family: string): Promise<void> => {
  await Promise.all(
    WEIGHTS.map((w) => document.fonts.load(`${w} 100px "${family}"`)),
  );
};

const loadBundled = async (): Promise<void> => {
  await Promise.all(
    WEIGHTS.map(async (weight) => {
      const face = new FontFace(
        FONT,
        `url(${staticFile(`fonts/BarlowCondensed-${weight}-latin.woff2`)}) format('woff2')`,
        { weight, style: "normal" },
      );
      await face.load();
      document.fonts.add(face);
    }),
  );
  await warmUp(FONT);
};

const loadFromGoogle = async (): Promise<void> => {
  const { loadFont } = await import("@remotion/google-fonts/BarlowCondensed");
  const loaded = loadFont("normal", {
    weights: [...WEIGHTS],
    subsets: ["latin"],
  });
  await loaded.waitUntilDone();
  await warmUp(loaded.fontFamily);
};

(USE_GOOGLE_FONTS_CDN ? loadFromGoogle() : loadBundled())
  .catch(() => undefined)
  .then(() => {
    continueRender(handle);
  });

/** Tabular figures are enforced by the glyph layout in `text()`, not by CSS. */
export const fontOf = (size: number, weight = 500): string =>
  `${weight} ${size}px "${FONT}", "Roboto Condensed", "Arial Narrow", sans-serif`;
