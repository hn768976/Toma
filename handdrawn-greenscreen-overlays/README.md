# Hand-Drawn Green Screen Overlays (Remotion)

Ten hand-drawn overlay clips on a flat `#00FF00` green screen: 3840×2160, 30 fps, H.264.
Key out the green and drop the doodles, transitions and handwriting over your footage.

| File | Composition id | Length | What it is |
|------|----------------|--------|------------|
| `GS_DoodleArrows.mp4` | `GS-DoodleArrows` | 10 s | 8 arrows draw on one at a time, pointing inward |
| `GS_CirclesHighlights.mp4` | `GS-CirclesHighlights` | 10 s | circles, ovals, boxes, yellow highlighter |
| `GS_UnderlinesStrikes.mp4` | `GS-UnderlinesStrikes` | 8 s | underline, double, wavy, strike-through, swoosh |
| `GS_StarsSparkles.mp4` | `GS-StarsSparkles` | 8 s | stars, sparkle bursts, shine marks, pop + twinkle |
| `GS_SpeechBubbles.mp4` | `GS-SpeechBubbles` | 10 s | 4 empty bubbles (left, right, top, bottom) |
| `GS_ScribbleWipe.mp4` | `GS-ScribbleWipe` | 3 s | scribble transition, fully covered 1.2–1.6 s |
| `GS_BrushStrokeReveal.mp4` | `GS-BrushStrokeReveal` | 4 s | p5.brush ink band for a title |
| `GS_TitleFrame.mp4` | `GS-TitleFrame` | 6 s | hand-drawn frame, corner curls, little doodles |
| `GS_LikeSubscribe.mp4` | `GS-LikeSubscribe` | 6 s | Tegaki handwriting, heart, bell, arrow |
| `GS_Countdown.mp4` | `GS-Countdown` | 5 s | handwritten 3‑2‑1, circled, then a burst |

Remotion composition ids may not contain `_`, so each one is registered with a hyphen
(`GS-DoodleArrows`). The render scripts write the files with the underscore names.

## Setup

```bash
npm ci            # exact versions are pinned in package.json / package-lock.json
npm run dev       # Remotion Studio, to preview and scrub
```

Pinned libraries (all MIT): `remotion` / `@remotion/cli` / `@remotion/paths` 4.0.515,
`perfect-freehand` 1.2.3, `roughjs` 4.6.6, `tegaki` 1.1.0, `p5.brush` 2.2.3 (standalone build, no p5).

## Render at 4K

```bash
scripts/render-4k.sh out/4k
```

This is the same as running, for each clip:

```bash
npx remotion render build GS-DoodleArrows out/4k/GS_DoodleArrows.mp4 \
  --codec=h264 --pixel-format=yuv420p --crf=16 --muted
```

(`build` is created by `npx remotion bundle src/index.ts --out-dir=build`; you can also pass
`src/index.ts` instead of `build`.) `remotion.config.ts` already sets H.264, yuv420p, CRF 16, no audio
and a 120 s per-frame timeout (a 4K p5.brush frame takes ~15–20 s on a 4-core machine).

For a cleaner key you can render 4:4:4 instead: add `--pixel-format=yuv444p` (or use
`--codec=prores --prores-profile=4444`).

720p previews: `scripts/render-previews.sh out/preview` (adds `--scale=0.3333333333333333`).

## How to key

* Chroma key on **`#00FF00`** (RGB 0, 255, 0). The background is exactly that on every frame:
  no grain, gradient, vignette, glow, shadow or blur.
* Premiere: Ultra Key, key colour `#00FF00`. Resolve: 3D Keyer, or Delta Keyer in Fusion.
  Final Cut: Keyer. CapCut / mobile: Chroma Key, pick the green, intensity around 10–20 %.
* Ink edges are antialiased, so turn on **spill suppression / despill**. It removes the faint green
  rim on edge pixels, and this matters most at small sizes.
  ffmpeg: `chromakey=0x00FF00:0.12:0.05,despill=type=green`.
* Nothing in the ink is green, lime, teal or cyan. The yellow highlighter and white bubble fills are
  fully opaque, so they never go see-through.

## Change ink colours or the handwritten words

Both are one data row each, in `src/lib/config.ts`:

```ts
export const INK = { main: '#141414', red: '#D8343A', yellow: '#FFD43A', orange: '#F08A2A', white: '#FAFAFA' };
export const WORDS = { likeSubscribe: 'Like & Subscribe', countdown: ['3', '2', '1'] };
```

Keep inks away from green hues or the key will eat them.

## Timings (30 fps)

| Clip | Timeline |
|------|----------|
| DoodleArrows (10 s) | arrows draw on from 0.27 s, one about every 0.9 s; hold with boil; staggered reverse-draw exits from 8.2 s (0.4 s each); clean green from 9.6 s |
| CirclesHighlights (10 s) | 8 marks draw on 0.27–7.5 s; hold; staggered exits from 8.1 s; clean from 9.5 s |
| UnderlinesStrikes (8 s) | 5 marks 0.27–5.2 s; hold; exits from 6.3 s; clean from 7.3 s |
| StarsSparkles (8 s) | 9 pop-ins 0.2–4.6 s (quick draw-on + overshoot on twos), then twinkle; exits from 6.3 s; clean from 7.6 s |
| SpeechBubbles (10 s) | left, right, top, bottom draw on in turn 0.27–6.9 s, white paint fill after each outline; hold; exits from 8.1 s; clean from 9.3 s |
| ScribbleWipe (3 s) | scribble 0–1.2 s; **fully covered 1.2–1.6 s (frames 36–47) = cut point**; un-scribbles to the right 1.6–2.9 s; clean green after |
| BrushStrokeReveal (4 s) | sweep 0–1.5 s; hold (solid band, 35 % of frame height) 1.5–3.5 s; wipes off to the right 3.5–3.8 s; clean green to 4 s |
| TitleFrame (6 s) | frame 0.2–2.3 s, corner curls to 3.4 s, doodles pop to 4.2 s; staggered exits 4.4–5.5 s; clean green after |
| LikeSubscribe (6 s) | writes 0–2.9 s; heart, bell, arrow 3–4 s; hold, bell wiggles at 4.2 s and 4.8 s; ink thins away 5.33–5.8 s (a key-safe "fade": the ink erodes instead of going translucent); clean green to 6 s |
| Countdown (5 s) | each number writes in 0.53 s, red circle at +0.6 s, clears at +0.97 s (per 1.2 s slot); burst 3.6–4.5 s; clean green 4.6–5 s |

## How it is built

* `src/lib/pen.ts` is the pen. It sets each stroke's duration (√length, so long strokes are slower
  but not proportionally), uses hand easing (slow start, fast middle, slight slow-down), seeded
  2–5 frame pen lifts, speed-based pressure into perfect-freehand (`thinning` 0.6, tapered ends),
  draw-on and exits updated on twos, and a boil whose seeded offsets change every 3 frames.
* `src/lib/geom.ts` and `src/lib/shapes.ts` hold the imperfect geometry: circles that don't close,
  wobbly lines, uneven arrowheads.
* `src/lib/rough.ts`: Rough.js (seeded) makes the sketchy outlines and zig-zag hatch fills, and
  `@remotion/paths` measures and resamples them into pen strokes.
* `src/lib/TegakiText.tsx` is Tegaki handwriting, frame-driven (see below).
* `src/clips/BrushStrokeReveal.tsx` is p5.brush, frame-driven (see below).
* The scribble wipe uses a fat ~480 px marker (not the 28 px line weight) so a hand-speed zig-zag can bury a 4K frame in 1.2 s; overlapping passes darken like real marker ink.
* Exports use a keyframe every 15 frames (`remotion.config.ts`) so H.264 never carries a faint ghost of erased ink into the clean-green tail.
* Determinism: no `Math.random`, `Date.now`, `useFrame` or state-driven visuals. Everything comes from
  `useCurrentFrame()` and `mulberry32` seeded from the composition id, the element and `floor(frame/3)`.

### Tegaki: what was changed to make it frame-driven

Started from Tegaki's Remotion example (`<TegakiRenderer time={{mode:'controlled', value, unit:'progress'}}>`), then:
1. It drives `TegakiEngine` (`tegaki/core`) directly from `useLayoutEffect`, under `delayRender`, so each
   frame is drawn synchronously for exactly that frame. The React wrapper updates in a passive `useEffect`.
2. Time is always `controlled`, and the progress comes from `useCurrentFrame()` (quantised on twos).
   Tegaki's own `requestAnimationFrame` playback clock is never started.
3. Tegaki's boil plugin chooses its drawing from Tegaki's clock. It is wrapped in a small plugin whose
   drawing index is `floor(frame/3)`, so finished text boils on the project's beat.
4. The fixed `seed` is never `'random'`, and the Caveat files are served from `public/fonts` and loaded
   once (module-level `TegakiEngine.preload` promise, awaited behind `delayRender`).

### p5.brush: what was changed to make it frame-driven

1. It uses the standalone build (`p5.brush/standalone`), so there is no p5 draw loop at all.
2. Every frame: `brush.seed()` / `brush.noiseSeed()` from the composition id and `floor(frame/3)`
   (each bristle is re-seeded by its index too, so the drawn part of a stroke stays stable while it
   grows), `brush.clear()`, then the **whole frame is redrawn from scratch** and flushed with
   `brush.render()`, all inside `useLayoutEffect` under `delayRender`.
3. `brush.clear()` leaves transparent *white*, which composites as white on a premultiplied canvas,
   so the WebGL canvas is cleared to (0,0,0,0) instead.
4. p5.brush mixes grain colours as if on white paper, so the canvas is shown through an
   "inkify" SVG filter: exact ink colour, alpha steepened. Faint grains become ink or nothing,
   with no grey speckles to key. Below 4K the canvas is supersampled 1.5×.

## Fonts

Caveat (Copyright 2014 The Caveat Project Authors) is in `public/fonts/` with its SIL Open Font
Licence (`public/fonts/OFL.txt`). `Caveat-tegaki-subset.ttf` is the subset Tegaki ships with its
stroke data.
