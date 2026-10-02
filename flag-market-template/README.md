# Flag Market Chart — Remotion template

A country's national flag fills the frame (darkened, vignetted, with a slow
cloth ripple and scanlines), overlaid with scrolling ticker rows, a bright
jagged stock line drawing left → right with value labels, and striped LED
arrows shooting up (rally) or down (crash).

**10 countries × 2 directions = 20 compositions**, 3840×2160, 30 fps,
450 frames (15 s). 2D only — the camera is a 2D push-in/drift transform.

| Country | Up | Down |
|---|---|---|
| United States | `FlagMarket-USA-Up` | `FlagMarket-USA-Down` |
| China | `FlagMarket-China-Up` | `FlagMarket-China-Down` |
| Japan | `FlagMarket-Japan-Up` | `FlagMarket-Japan-Down` |
| Germany | `FlagMarket-Germany-Up` | `FlagMarket-Germany-Down` |
| United Kingdom | `FlagMarket-UK-Up` | `FlagMarket-UK-Down` |
| India | `FlagMarket-India-Up` | `FlagMarket-India-Down` |
| France | `FlagMarket-France-Up` | `FlagMarket-France-Down` |
| Canada | `FlagMarket-Canada-Up` | `FlagMarket-Canada-Down` |
| South Korea | `FlagMarket-SouthKorea-Up` | `FlagMarket-SouthKorea-Down` |
| Australia | `FlagMarket-Australia-Up` | `FlagMarket-Australia-Down` |

> **Ids use `-`, not `_`.** Remotion only allows `a-z A-Z 0-9 -` in
> composition ids, so `FlagMarket_China_Up` is registered as
> `FlagMarket-China-Up`. The render commands below still write files named
> `FlagMarket_China_Up.mp4`.

Also registered: `FlagContactSheet` (1280×720 still: all 10 flags uncropped)
and `Flag-<Country>` (each flag alone, uncropped, for spec checks).

## Setup

```bash
npm install
npx remotion studio        # preview everything in the browser
```

Node 18+ (tested on Node 22). Remotion downloads its own headless Chrome on
first render.

## Render (4K)

Codec settings live in `remotion.config.ts`: H.264, CRF 16, `yuv420p`,
no audio track. Each command renders the composition at its native
3840×2160:

```bash
npx remotion render src/index.ts FlagMarket-USA-Up               out/FlagMarket_USA_Up.mp4
npx remotion render src/index.ts FlagMarket-USA-Down             out/FlagMarket_USA_Down.mp4
npx remotion render src/index.ts FlagMarket-China-Up             out/FlagMarket_China_Up.mp4
npx remotion render src/index.ts FlagMarket-China-Down           out/FlagMarket_China_Down.mp4
npx remotion render src/index.ts FlagMarket-Japan-Up             out/FlagMarket_Japan_Up.mp4
npx remotion render src/index.ts FlagMarket-Japan-Down           out/FlagMarket_Japan_Down.mp4
npx remotion render src/index.ts FlagMarket-Germany-Up           out/FlagMarket_Germany_Up.mp4
npx remotion render src/index.ts FlagMarket-Germany-Down         out/FlagMarket_Germany_Down.mp4
npx remotion render src/index.ts FlagMarket-UK-Up                out/FlagMarket_UK_Up.mp4
npx remotion render src/index.ts FlagMarket-UK-Down              out/FlagMarket_UK_Down.mp4
npx remotion render src/index.ts FlagMarket-India-Up             out/FlagMarket_India_Up.mp4
npx remotion render src/index.ts FlagMarket-India-Down           out/FlagMarket_India_Down.mp4
npx remotion render src/index.ts FlagMarket-France-Up            out/FlagMarket_France_Up.mp4
npx remotion render src/index.ts FlagMarket-France-Down          out/FlagMarket_France_Down.mp4
npx remotion render src/index.ts FlagMarket-Canada-Up            out/FlagMarket_Canada_Up.mp4
npx remotion render src/index.ts FlagMarket-Canada-Down          out/FlagMarket_Canada_Down.mp4
npx remotion render src/index.ts FlagMarket-SouthKorea-Up        out/FlagMarket_SouthKorea_Up.mp4
npx remotion render src/index.ts FlagMarket-SouthKorea-Down      out/FlagMarket_SouthKorea_Down.mp4
npx remotion render src/index.ts FlagMarket-Australia-Up         out/FlagMarket_Australia_Up.mp4
npx remotion render src/index.ts FlagMarket-Australia-Down       out/FlagMarket_Australia_Down.mp4
```

**Batch, all 20:**

```bash
npm run render:all                 # scripts/render-all.mjs, sequential
npm run render:all -- China        # only ids containing "China"
```

or plain shell:

```bash
for c in USA China Japan Germany UK India France Canada SouthKorea Australia; do
  for d in Up Down; do
    npx remotion render src/index.ts FlagMarket-$c-$d out/FlagMarket_${c}_${d}.mp4
  done
done
```

Add `--concurrency=N` to use more cores (default is half of them).

**720p preview** (what the delivered previews used):

```bash
npx remotion render src/index.ts FlagMarket-USA-Up out/FlagMarket_USA_Up.mp4 --scale=0.3333333333333333
```

`--scale=0.3333333333333333` gives exactly 1280×720 (checked with ffprobe).

## Stills (6K)

6000×3375 at frame 420. The composition is 3840×2160, so the scale is
6000 / 3840 = **1.5625**, which gives exactly 6000×3375:

```bash
npx remotion still src/index.ts FlagMarket-USA-Up out/FlagMarket_USA_Up_6K.png --frame=420 --scale=1.5625
```

For all 20:

```bash
for c in USA China Japan Germany UK India France Canada SouthKorea Australia; do
  for d in Up Down; do
    npx remotion still src/index.ts FlagMarket-$c-$d out/FlagMarket_${c}_${d}_6K.png --frame=420 --scale=1.5625
  done
done
```

The flag contact sheet:

```bash
npx remotion still src/index.ts FlagContactSheet out/flag-contact-sheet.png
```

## Render time

Measured in a 4 vCPU / 15 GB Linux container (Chrome headless shell, software
rendering, Remotion's default concurrency = 2):

| | per frame |
|---|---|
| 720p video render (450 frames in 110–113 s, wall clock) | **≈ 0.25 s** wall clock (≈ 0.5 s per frame per render thread) |
| 720p single still (warm browser) | ≈ 0.85–0.95 s |
| 1080p single still (warm browser), for scaling | ≈ 1.0 s |

**4K estimate:** most of the per-frame cost is fixed (the grain canvas is
always computed at 1920×1080, plus the React/DOM work), and the pixel-dependent
part grows by about 0.09 s per megapixel in the still timings. Extrapolating
to 8.3 MP (plus larger PNG frames and x264 work), expect about **0.6–0.8 s per
frame wall clock** on the same 4 vCPU machine. That is about **5–6 minutes per
composition** and about **2 hours for all 20**. On an 8–16 core machine with
`--concurrency=8`, expect roughly a third of that.

## Banding check

The darkened flag and the vignette are large, smooth gradients, so the scene
adds ~2 % film grain (`src/scene/Grain.tsx`). The grain comes from a fixed
integer hash of (pixel x, pixel y, frame), drawn on a 1920×1080 canvas. It
never uses `Math.random()`.

Checked on frames **decoded from the encoded 720p mp4s** (frame 420), not the
preview. The test read pixel rows across the vignette, from the dark left
edge towards the centre:

| | 16-px block means (left → centre) | max step between 16-px blocks | max step per pixel (9-px smoothed) | grain σ |
|---|---|---|---|---|
| USA Up (y = 640) | 19 21 21 23 24 26 26 28 30 31 32 33 35 36 37 37 38 40 41 42 … | 2.65 levels | 0.41 levels | 1.6 levels |
| China Down (y = 532) | 27 27 28 29 29 31 32 32 34 36 38 39 40 41 43 44 46 46 47 48 … | 2.12 levels | 0.42 levels | 1.8 levels |

The values change smoothly, with no plateaus followed by jumps, so there is no
banding. A ×4 contrast stretch of the same frames shows no contour lines either.

That stretch did expose one real artefact, which is now fixed. The ripple
bands were first animated with `background-position`, which slides the
element-sized gradient tile and leaves a visible vertical seam where tiles meet.
The bands now move by shifting the gradient's stop offsets, so there is no seam.

## Determinism

Every on-screen value is a pure function of `useCurrentFrame()`:

- Per-composition randomness comes from `mulberry32`, seeded per country and
  direction and run once at module load (`src/scene/scene-data.ts`).
- No `Math.random()`, `Date.now()`, CSS animations or transitions, and no
  state carried between frames.
- Fonts load behind `delayRender` / `continueRender` (`src/load-fonts.ts`).

Check: frame 300 rendered alone from a cold start vs frame 300 from a full
(multi-threaded, out-of-order) PNG-sequence render: **byte-identical** for
both USA Up and China Down.

## How to add a country

1. **Flag component**: create `src/flags/<Name>.tsx` exporting a `FlagDef`:

   ```tsx
   import { FlagDef } from "./shared";
   export const ItalyFlag: FlagDef = {
     width: 3,          // native construction grid (aspect = official ratio)
     height: 2,
     draw: () => (
       <>
         <rect width={1} height={2} fill="#009246" />
         <rect x={1} width={1} height={2} fill="#FFFFFF" />
         <rect x={2} width={1} height={2} fill="#CE2B37" />
       </>
     ),
   };
   ```

   Export it from `src/flags/index.ts`. Use `starPoints()` from `shared.tsx`
   for stars, and `uid` for any `<defs>` ids (see `UK.tsx`).

2. **Data row**: add one line to `COUNTRIES` in `src/countries.ts`:

   ```ts
   { id: "Italy", name: "Italy", flag: ItalyFlag, focus: { x: 0.5, y: 0.5 }, seed: 11 },
   ```

   - `id`: letters and digits only (it becomes `FlagMarket-Italy-Up` / `-Down`).
   - `focus`: the point of the flag (0–1) that must stay visible after the
     16:9 cover crop.
   - optional `anchor` (where that point lands in the frame) and `zoom`
     (extra zoom on top of "cover"). Japan uses these to sit its disc left of
     centre.
   - `seed`: any unused integer. It drives the line shape, labels, arrows and
     ticker rows.

Both compositions appear in the Studio automatically. Add the id to
`scripts/render-all.mjs` to include it in the batch.

## Project layout

```
src/
  Root.tsx              20 compositions (rows × Up/Down) + flag stills
  FlagMarket.tsx        the scene (layer order, fade-in, camera)
  countries.ts          ONE ROW PER COUNTRY
  constants.ts          size, fps, timeline, Up/Down presets
  load-fonts.ts         Inter + JetBrains Mono behind delayRender
  random.ts             mulberry32 + pixel hash
  flags/                one SVG flag per file, built from construction sheets
  scene/
    scene-data.ts       seeded line / labels / arrows / ticker rows (module load)
    FlagBackground.tsx  cover crop, ripple, darkening, scanlines, vignette, camera
    Tickers.tsx         scrolling rows (invented codes only)
    LineChart.tsx       outlined + glowing line, dash-drawn, head, labels
    Arrows.tsx          striped LED arrows with glow and motion trail
    Grain.tsx           deterministic film grain
public/fonts/           Inter + JetBrains Mono (woff2) with OFL licences
scripts/
  render-all.mjs        batch 4K render
  frames.mjs            render chosen frames of chosen compositions to PNG
```

Ticker codes are drawn from invented prefixes (`IDX SEC FND GRP SET LOT BLK
SER UNT CMP BND MKT`) plus a `-12` / `-B` / `-7` suffix, a format no exchange
uses. No real company or stock symbols appear.

## Fonts

- **Inter** (400/600/700, Latin): SIL Open Font License 1.1, see `public/fonts/OFL-Inter.txt`
- **JetBrains Mono** (400/500/700, Latin): SIL Open Font License 1.1, see `public/fonts/OFL-JetBrainsMono.txt`

## Completion checklist

- [x] 20 compositions (10 countries × Up/Down), 3840×2160, 30 fps, 450 frames
- [x] Flags drawn in SVG code from construction sheets: no images, no flag libraries
- [x] Flag fills the 16:9 frame (cover crop + `focus`), darkened (~60 %; Down 54 %), vignette, ripple, scanlines
- [x] Camera: ~8 % push-in with slight drift (2D transform)
- [x] 7 ticker rows, alternating directions, different speeds, 2 to 3 rows out of focus, tinted, about 45 % opacity
- [x] Jagged line drawn with `stroke-dasharray`/`stroke-dashoffset`, dark outline, glow, near-white core, bright head that pulses after frame 390
- [x] Value labels with dots pop in as the head passes; signed % per direction
- [x] 3–5 striped arrows, one at a time, glow + motion trail, up/down per preset
- [x] Timeline: fade 0–30, line 15–390, arrows 60–420, hold/pulse 390–450
- [x] Grain ~2 % from a hash of (x, y, frame); banding checked on encoded mp4
- [x] Deterministic: frame 300 cold == frame 300 in full render, byte for byte
- [x] Fonts shipped with OFL licences, loaded behind `delayRender`
- [x] 720p previews of USA Up and China Down: 1280×720, h264, yuv420p, 30/1, 15.0 s, no audio
- [x] Frame 420 of all 20 compositions renders without error
- [x] `npm install && npx remotion studio` works from a clean copy
