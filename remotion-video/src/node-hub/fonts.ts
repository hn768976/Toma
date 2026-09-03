/**
 * Font loading for the node-hub compositions.
 *
 * Two faces are used across every variant: a condensed technical sans
 * (Barlow Condensed) for labels and numeric readouts, and a monospace
 * (Share Tech Mono) for the dense illegible panel blocks.
 *
 * Both faces are vendored into public/fonts by scripts/fetch-fonts.mjs, whose
 * URLs come from `@remotion/google-fonts` metadata. They are registered from
 * those local copies rather than fetched at render time, so a render needs no
 * network access and cannot vary between machines.
 *
 * Canvas text is drawn imperatively, so a face that arrived *after* a layer
 * had painted would be baked in with fallback metrics and never repainted.
 * Loading is therefore gated with a single `delayRender()` handle opened at
 * module scope and released only once every face is registered. Remotion
 * mounts a composition only after the module-scope handles clear, so by the
 * time any layer draws its first pixel the faces are already in
 * `document.fonts` — there is no repaint race to lose.
 *
 * Nothing here reads Date.now() or uses rAF, so renders stay deterministic.
 */
import { continueRender, delayRender, staticFile } from "remotion";

export const FONT_CONDENSED = "Barlow Condensed";
export const FONT_MONO = "Share Tech Mono";

const FACES: { family: string; weight: string; file: string }[] = [
  { family: FONT_CONDENSED, weight: "400", file: "barlow-condensed-400.woff2" },
  { family: FONT_CONDENSED, weight: "500", file: "barlow-condensed-500.woff2" },
  { family: FONT_CONDENSED, weight: "600", file: "barlow-condensed-600.woff2" },
  { family: FONT_MONO, weight: "400", file: "share-tech-mono-400.woff2" },
];

const handle = delayRender("Loading node-hub fonts");

let ready = false;

Promise.all(
  FACES.map(async ({ family, weight, file }) => {
    const face = new FontFace(
      family,
      `url(${staticFile(`fonts/${file}`)}) format("woff2")`,
      { weight, style: "normal" },
    );
    document.fonts.add(await face.load());
  }),
)
  .catch((err) => {
    // A face that fails to arrive must not wedge the render; canvas text
    // falls back to a generic family instead.
    console.error("node-hub font load failed", err);
  })
  .then(() => {
    ready = true;
    continueRender(handle);
  });

/**
 * True once the vendored faces are registered. Layers draw regardless — this
 * is only here so a font failure is observable rather than silent.
 */
export const getFontsReady = () => ready;
