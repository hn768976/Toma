# Neon Frame — Amber

A 4K neon title-plate animation built with Remotion. A wide, short bar
outlined in amber, with four bright, differently hued corner nodes, sits
centred over a dense field of falling monospace characters, flanked by two
thin horizontal rules.

## The clip

| | |
| --- | --- |
| Composition id | `NeonFrameAmber` |
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
negative space ready for a title. The bar is roughly 5:1 — short and broad,
centred both horizontally and vertically — which suits a single line of type,
where the blue variant's taller 4:3 plate suits a stacked title. Because the
bar's corner nodes sit close together vertically, their anamorphic streaks are
50% longer so the horizontal light emphasis matches the shape.

## Render at full 4K

```
npm install
npx remotion render NeonFrameAmber out/neon-frame-amber.mp4 --codec=h264 --crf=12 --concurrency=8
```

Drop `--concurrency` (or lower it) if you have fewer than 8 CPU cores —
Remotion rejects a concurrency higher than the available core count.

For a quick 1080p check:

```
npx remotion render NeonFrameAmber out/preview.mp4 --codec=h264 --crf=18 --scale=0.5
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
    RuleLines.tsx             the two horizontal rules with irregular ticks
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
