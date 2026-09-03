# Neon Frame — Blue

A 4K neon title-plate animation built with Remotion. A thin rectangular
outline with four bright, differently hued corner nodes sits right of centre
over a field of falling monospace characters.

## The clip

| | |
| --- | --- |
| Composition id | `NeonFrameBlue` |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | 360 frames |
| Frame rate | 30 fps |
| Running time | 12.0 s |
| Loops | **Yes — seamlessly.** Frame 0 and frame 360 are pixel-identical. |
| Audio | None |

Every rain column completes a whole number of traversals in 360 frames, every
corner-node pulse period divides 360, and the travelling perimeter highlight
makes exactly 2 circuits, so the clip can be looped end to end with no visible
seam.

## The frame interior is intentionally empty

This is a title plate. Nothing is drawn inside the outline, and whatever is
behind it is calmed by a soft scrim, so the space inside is clean, legible
negative space ready for a title. The plate is roughly 4:3, moderately tall,
and positioned right of centre with its left edge near the composition
midline — that asymmetry is deliberate and leaves usable open space beside
the plate.

## Render at full 4K

```
npm install
npx remotion render NeonFrameBlue out/neon-frame-blue.mp4 --codec=h264 --crf=12 --concurrency=8
```

Drop `--concurrency` (or lower it) if you have fewer than 8 CPU cores —
Remotion rejects a concurrency higher than the available core count.

For a quick 1080p check:

```
npx remotion render NeonFrameBlue out/preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

Or open the Studio:

```
npm run dev
```

## What's in here

```
src/
  index.ts                    entry point (registerRoot)
  Root.tsx                    <Composition> registration
  neon-frame/
    variants.ts               THE palette and proportions — the only file with
                              hex colour literals, keyed "blue" | "amber"
    constants.ts              3840x2160, 30fps, 360 frames, the loop clock
    NeonFrame.tsx             layer stack + ambient camera drift
    CornerNodeFrame.tsx       the plate (adapter over the shared library)
    CharacterRain.tsx         the falling glyph columns (adapter)
    SparkField.tsx            ~200 drifting, twinkling accent-hued points
    BackgroundWash.tsx        the slow drifting background
    RuleLines.tsx             horizontal rules (used by the amber variant)
    FilmGrade.tsx             vignette (22%) + film grain (4%)
    font.ts                   monospace loading, delayRender-gated
  lib/                        vendored shared component library
public/fonts/                 self-hosted Roboto Mono (latin subset)
```

## How it is built

- **2D canvas only.** No WebGL, no Three.js. Each layer owns one
  3840 × 2160 `<canvas>`, drawn once per React render.
- **Deterministic.** All motion is a pure function of `useCurrentFrame()`.
  No `Date.now()`, no `requestAnimationFrame`, no CSS animation, no component
  state. All randomness goes through Remotion's `random()` with stable seeds,
  so frames render identically in any order across any number of workers.
- **One palette object.** `VARIANTS` in `src/neon-frame/variants.ts` holds
  every colour and proportion. No hex literal appears anywhere else.
- **Fast at 4K.** Characters are rasterised once per size bracket into glyph
  atlases and blitted; depth blur uses three offscreen buffers (near / mid /
  far) blurred once each rather than per column; every glow is a pre-rendered
  radial sprite.
