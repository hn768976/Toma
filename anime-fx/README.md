# Anime FX, Graffiti Wall, Style Walk, Ink Figure

One Remotion project, 8 compositions, all hand-animated 2D looks drawn with
Canvas 2D (no WebGL), perfect-freehand and Rough.js. Compositions are defined
at **3840×2160, 30 fps**.

| # | Composition id | Output file | Length |
|---|----------------|-------------|--------|
| 1 | `AnimeShards-Neon` | `AnimeShards_Neon.mp4` | 10 s loop |
| 2 | `AnimeShards-Ice` | `AnimeShards_Ice.mp4` | 10 s loop |
| 3 | `GraffitiWall-Neon` | `GraffitiWall_Neon.mp4` | 10 s loop |
| 4 | `GraffitiWall-Paper` | `GraffitiWall_Paper.mp4` | 10 s loop |
| 5 | `AnimeFire-Red` | `AnimeFire_Red.mp4` | 10 s loop |
| 6 | `AnimeFire-Blue` | `AnimeFire_Blue.mp4` | 10 s loop |
| 7 | `StyleWalk-Colours` | `StyleWalk_Colours.mp4` | 13 s |
| 8 | `InkFigure-DotBurst` | `InkFigure_DotBurst.mp4` | 12 s |

Remotion does not allow `_` in composition ids, so ids use `-`. The render
scripts write the files with `_`.

## Setup

```bash
npm ci
```

Node 18+ is required. Versions are pinned exactly in `package.json`. Remotion
downloads its own headless Chrome on first render.

## Render at 4K

All 8 at 3840×2160 (H.264, yuv420p, CRF 16, PNG intermediates, no audio):

```bash
bash scripts/render-4k.sh
```

One clip:

```bash
npx remotion render src/index.ts GraffitiWall-Neon out/4k/GraffitiWall_Neon.mp4 --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted
```

The canvas is sized to the device pixels Remotion captures, so `--scale`
changes the real drawing resolution, not just the output size. Expect about
1.5–2.5 s per 4K frame per tab for the heavy clips (graffiti, fire). Raise
`--concurrency` if you have the cores and memory; each graffiti tab caches its
painted marks (a few hundred MB at 4K).

720p previews (what was delivered):

```bash
bash scripts/render-previews.sh
```

This runs `--scale=0.3333333333333333`, which gives exactly 1280×720.

Preview in the Studio with `npm run dev`. Studio draws at full 4K, so playback
is slow.

## Changing a palette (one data row each)

| Clip | File | Row |
|------|------|-----|
| Anime Shards Neon / Ice | `src/shards/palettes.ts` | `SHARD_PALETTES.neon` / `.ice`: `bg`, `glow` (core, main, haze), `darks`, `mids`, `brights`, `core`, `hairline`, `bolt` |
| Graffiti Neon / Paper | `src/graffiti/palettes.ts` | `GRAFFITI_PALETTES.neon` / `.paper`: `bg`, `wash`, `spray`, `brush`, `marker`, `symbol`, `pen`, `splat`, `grain` |
| Anime Fire Red / Blue | `src/fire/palettes.ts` | `FIRE_PALETTES.red` / `.blue`: `bands` (edge → core), `back` (dim background flames), `glow`, `ember`, `emberCore` |
| Style Walk | `src/stylewalk/StyleWalk.tsx` | `WALK_STYLES` (one row per cut: `bg`, `style`), plus `INK` |
| Ink Figure | `src/inkfigure/InkFigure.tsx` | `INK_COLORS`: `bg`, `ink`, `scratch`, `white`, `lips`, `hatch` |

To add another colourway, add a row and register a composition in
`src/Root.tsx` the same way the existing pairs are registered.

## Style Walk: order and colours

A new style and background every **39 frames** (1.3 s), 10 cuts in 13 s:

| Cut | Frames | Background | Style |
|-----|--------|------------|-------|
| 1 | 0–38 | orange `#F5820A` | scribble loops filling the body |
| 2 | 39–77 | red `#FF1A3A` | dense, tighter scribble loops |
| 3 | 78–116 | magenta `#FF3AE0` | thin wobbly line loops stacked down the body |
| 4 | 117–155 | violet `#9A4AFF` | halftone: grid of small dark squares |
| 5 | 156–194 | blue `#4A7AFF` | solid black silhouette (far limbs a shade lighter) |
| 6 | 195–233 | cyan `#3AFFF8` | loose spiral scribble losing the body shape |
| 7 | 234–272 | green `#22F04A` | diagonal Rough.js hatch inside the outline |
| 8 | 273–311 | lime `#66FF00` | solid silhouette with hatched rings orbiting it |
| 9 | 312–350 | yellow `#F5D80A` | one rounded black blob per body part |
| 10 | 351–389 | orange `#F5820A` | scribble loops again |

Line colour is `#141414`. Each background has a faint, static paper texture of
pale ticks, specks and a few long faint curves.

**Walk timing:** one step pair (a full stride) every **60 frames** (one step
per 30 frames). The pelvis travels at constant speed from −4% to 104% of the
frame width over 13 s. Feet are planted: heel strike → flat → heel-off on the
ball → swing on an arc. Legs use 2-bone IK, so nothing slides. The pose
updates on twos and the outline boils with 4 variants held 2 frames each.
(The brief asked for 30 frames per step pair. That can't be combined with
crossing the frame in 13 s at 75% height without the feet sliding, so the
cadence was halved.)

## Timings

**Loops (1–6).** 300 frames, animated on twos (150 drawings). Noise is
sampled on a time circle, and every value derives from `frame mod 300`, so
frame 300 = frame 0. Pass `--props='{"loopCheck":true}'` to make a loop
composition 301 frames long so frame 300 can be rendered.

- **Shards:** shards live 10–50 drawings (periods divide 150), drift right,
  jitter, flip and pulse each drawing. Cracks re-route every 3 drawings and
  flicker every drawing. A brightness flare comes every 15 drawings (1 s).
- **Graffiti:** the wall boils on twos (2 cached variants per mark plus a
  small random offset and rotation each drawing). 7 replacement events per
  loop at frames 0, 42, 86, 128, 172, 214 and 258 (about every 1.43 s, so the
  schedule closes at 300). Each event swaps 3 marks, each slot swaps A→B→A
  within a loop, and a new mark sprays on over 6 frames. Drips run over about
  1–2 s after a mark appears.
  Marks are abstract: X's, zigzags, rings, uneven loops, triangles,
  letter-like scribbles built to stay illegible, stars, arrows, hearts,
  lightning bolts, smiley circles, targets, splats and dots. Crowns from the
  brief were left out, because an outlined three-point crown reads as a
  specific artist's signature motif.
- **Fire:** two-phase flow-map noise rising with a 50-drawing period (closes 3×
  per loop), domain-warped on a time circle. Embers rise on integer laps of
  the loop.

**Ink Figure (12 s).**

| Time | Frames | What happens |
|------|--------|--------------|
| 0–1.5 s | 0–44 | Ink dots swarm in from the left and gather into her shape; the pink dot goes to the lips |
| 1.5–5 s | 45–149 | Black figure sways and tilts her head (on twos, outline boiling) |
| 5–6 s | 150–179 | Bursts into dots that scatter and fall; the pink dot lingers |
| 6–6.5 s | 180–194 | Nearly empty frame, a few drifting dots |
| 6.5–7.5 s | 195–224 | White version (white ink, blue Rough.js hatching) draws on from the top |
| 7.5–10 s | 225–299 | Sways and tilts the other way |
| 10–12 s | 300–359 | Blue hatched ribbons wrap around her body; pose holds from 11.2 s |

## How it's built

- `src/lib/CanvasComp.tsx`: one `<canvas>` per composition, drawn in
  `useLayoutEffect` from `useCurrentFrame()` only. The backing store matches
  device pixels.
- `src/lib/rng.ts`: `mulberry32`, seeded from a module-level `ROOT_SEED` plus
  keys (composition id, drawing index, element index). No `Math.random()`, no
  `Date.now()`, no state.
- `src/lib/brush.ts`: a seeded Canvas-2D brush module (spray with mist and
  overspray, dry-brush bristles, marker, pen, splats, drips, paint masses, ink
  fill). It stands in for p5.brush, which needs WebGL in every release.
- `src/lib/dither.ts`: ±1/255 triangular dither, applied only to the soft
  glow layers (shards' glow, the fire's haze), never to flat backgrounds or
  pure black.
- Graffiti marks are painted once per (mark, variant, spray-on step) into
  offscreen canvases and cached. The fire field and shard glow are cached per
  drawing.

## Verification

`scripts/verify.py` (Python 3, numpy and Pillow) runs these checks:

```bash
python3 scripts/verify.py probe
```

```bash
python3 scripts/verify.py loops
```

```bash
python3 scripts/verify.py background
```

```bash
python3 scripts/verify.py twos
```

```bash
python3 scripts/verify.py determinism
```
