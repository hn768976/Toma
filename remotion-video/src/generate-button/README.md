# "Generate" button — circuit burst

A 20-second (600 frame @ 30 fps) motion graphic: a glowing **Generate**
button, a cursor that glides up and clicks it, a camera pull-back, and a
PCB circuit field that lights up and radiates outward from the button.

Ships in two looks — `dark` (deep navy, neon) and `light` (near-white,
light-blue button, blueprint traces) — and at two resolutions.

## Compositions

| id | size | notes |
| --- | --- | --- |
| `GenerateButtonDark1080p`  | 1920x1080 | delivery master |
| `GenerateButtonDark4K`     | 3840x2160 | 4K master |
| `GenerateButtonLight1080p` | 1920x1080 | delivery master |
| `GenerateButtonLight4K`    | 3840x2160 | 4K master |

## Rendering

```bash
npm install

# 1080p delivery masters (~2 min each)
npm run render:dark:1080
npm run render:light:1080

# 4K masters (~12 min each)
npm run render:dark:4k
npm run render:light:4k

# ...or all four
npm run render:all
```

Each script expands to, for example:

```bash
npx remotion render GenerateButtonDark4K out/generate-button_dark_4k.mp4 \
  --codec=h264 --crf=16 --muted --image-format=png --color-space=bt709
```

Those flags matter for a delivery master:

* `--muted` — the reference has no audio, and Remotion otherwise muxes a
  silent AAC track that pushes the duration past 20.000s.
* `--image-format=png` — JPEG frames are full-range, and ffmpeg tags the
  result `yuvj420p`. PNG frames encode to limited-range `yuv420p`, which is
  what players and NLEs expect; without it the dark theme's blacks get
  crushed anywhere the range tag is ignored. It costs about 2x the render
  time.
* `--color-space=bt709` — tags the stream rather than leaving it unknown.

Or open the studio and scrub: `npm run dev`.

Both the label text and the theme are composition props, so a different
word or the other palette can be rendered without touching the source:

```bash
npx remotion render GenerateButtonDark4K out/x.mp4 \
  --props='{"label":"Create","theme":"light"}'
```

## How the resolution independence works

Every measurement in `constants.ts` is authored in a fixed **1920x1080
design space**. `GenerateButtonScene` reads the real composition width and
applies a single `scale(width / 1920)` transform to the whole scene, and the
circuit field is SVG with a `0 0 1920 1080` viewBox.

Nothing is rasterised at 1080p and stretched: the 4K render is genuinely
resampled vector geometry and live-rendered text, so strokes and glyph edges
are sharp at 3840x2160. The two masters are otherwise frame-identical.

## Files

| file | what it does |
| --- | --- |
| `constants.ts` | geometry + every timing beat, in design-space units |
| `theme.ts` | the dark and light palettes |
| `rng.ts` | seeded PRNG — nothing uses `Math.random()` |
| `traceField.ts` | generates the static PCB trace geometry |
| `CircuitField.tsx` | draws the field: base, bloom, pulses, reveal wave |
| `GenerateButton.tsx` | the button (ring / body / hairline / label) |
| `Cursor.tsx` | the pointer |
| `Backdrop.tsx` | background gradient, ambient pool, vignette, grain |
| `GenerateButtonScene.tsx` | timing and composition |
| `load-font.ts` | self-hosted Liberation Sans (Arial metrics) |

## Timeline

| frame | time | beat |
| --- | --- | --- |
| 0–5 | 0.00–0.17s | button held at hero size |
| 6–32 | 0.20–1.07s | cursor glides up from below the frame |
| 33 | 1.10s | click — press, flash |
| 33–55 | 1.10–1.83s | camera pulls back to 0.538x |
| 50–58 | 1.67–1.93s | cursor fades out |
| 90–118 | 3.00–3.93s | circuit field fades in |
| 101–215 | 3.37–7.17s | brightness wave sweeps outward from the button |
| 118–600 | 3.93–20.00s | steady state; light pulses run along the traces |

## Determinism

Remotion renders frames out of order across worker processes, so every value
that describes the scene is a pure function of its index — the trace field is
built once from a fixed seed (`TRACE_SEED`) and cached, and the pulses are
driven by `frame`, never by wall-clock time. Re-rendering always produces the
same pixels.

## Retiming / re-skinning

* **Different length** — change `DURATION_IN_FRAMES`. The beats before frame
  ~215 are absolute; everything after is a steady state that simply continues.
* **Different look** — edit `theme.ts`. `glowBlend` is the switch that makes
  the glow additive (dark) or subtractive (light); a new theme needs to set it
  correctly or the bloom will fight the background.
* **Denser / sparser field** — `BUNDLE_COUNT` and `FRAGMENT_COUNT`. Segment
  lengths in `routeSpine` set the *scale* of the routing; the counts set its
  density. Changing either changes the field completely, since the seeded
  stream shifts.
