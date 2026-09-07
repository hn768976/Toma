# Digital Bokeh Field — 4K still generator

A field of small bright marks scattered through a depth range and read through
a shallow lens: a circuit board or data display defocused into bokeh. Built in
Remotion, drawn on a 2D canvas — no 3D, no Three.js.

**This project produces still images, not video.** The composition is one frame
long, nothing animates, and there is no loop or timing anywhere in it.

## The composition

| | |
|---|---|
| id | `BokehField` |
| output | 4K 16:9 — 3840 × 2160 PNG |
| duration | 1 frame (a still) |

A second composition, `ContactSheet`, exists only to build the review sheet and
is driven by `scripts/contact-sheet.ts`.

## Props

| prop | type | accepted values | default |
|---|---|---|---|
| `seed` | string | any string | `"a01"` |
| `palette` | string | `cyan` `blue` `green` `amber` `violet` `magenta` | `"cyan"` |
| `density` | string | `sparse` `medium` `dense` | `"medium"` |
| `focusBand` | number | `0`–`1` | `0.5` |
| `orientation` | string | `landscape` | `"landscape"` |

- **`seed`** drives every random value in the piece.
- **`palette`** selects a background plus four element tones, dimmest to
  brightest. Far elements are tinted toward the dimmest tone, near ones toward
  the brightest.
- **`density`** is roughly 340 / 700 / 1400 elements over 6–8 / 10–12 / 12–16
  clusters. At `dense`, individual element opacity is pulled back 25% so the
  additive compositing does not blow out.
- **`focusBand`** is where the sharp band sits in depth. `0` puts the far
  extreme in focus, `1` the near extreme. Everything either side of it blurs,
  by the square of its distance from the band, up to ~60px at 4K.
- **`orientation`** is reserved for a future portrait variant. The composition
  is registered 16:9, so `landscape` is the only accepted value today.

### The same seed always reproduces the same image

Every random value comes from Remotion's `random()` keyed by the `seed` prop —
`Math.random()` is never called anywhere in this project. Rendering a given set
of props twice, on any machine, produces a byte-identical image. That is what
makes the set reproducible: any single output can be re-rendered later from its
filename alone, since each filename encodes the props that made it.

## Rendering one still

```
npx remotion still BokehField out/my-still.png \
  --props='{"seed":"a01","palette":"cyan","density":"medium","focusBand":0.5,"orientation":"landscape"}'
```

## Rendering the batch

36 stills — 6 palettes × 3 densities × 2 focus bands (0.35 and 0.65) — each
with its own seed derived from its parameters:

```
npm run batch                             # all 36, into out/stills/
npm run batch -- --palette=cyan           # one palette
npm run batch -- --density=dense          # one density
npm run batch -- --only=bokeh-cyan-medium-f35
npm run batch -- --cli                    # shell out to `npx remotion still` per image
```

Files are named `bokeh-<palette>-<density>-f<focusband>.png`, e.g.
`bokeh-cyan-medium-f35.png`. The seed for each is its own name.

By default the project is bundled once and all 36 are rendered against that one
bundle through Remotion's Node API, reusing a single browser — about 2½ minutes
for the set. `--cli` runs the literal `npx remotion still` command once per
image instead, which re-bundles every time and is many times slower.

## Contact sheet

```
npm run contact-sheet     # after npm run batch
```

Writes `out/contact-sheet.png`: all 36 tiled 6 × 6, one palette per row,
columns running sparse → medium → dense with both focus bands side by side.
The tiles are true downscales of the delivered 4K PNGs, not fresh renders at a
smaller size, so what you review is what ships. The script drops thumbnails
into `public/contact-tiles/` just long enough to render the sheet and removes
them afterwards.

## Working on it

```
npm install
npm run dev      # Remotion studio
npm run lint     # tsc
```

## How it is put together

```
src/bokeh/config.ts       every tunable number in the piece
src/bokeh/palettes.ts     the six palettes — the only hex literals in the artwork
src/bokeh/rng.ts          the deterministic value stream over Remotion's random()
src/bokeh/elements.ts     clusters, grid alignment, depth, shape geometry
src/bokeh/draw.ts         canvas primitives, the bokeh rim gradient, band compositing
src/bokeh/BokehField.tsx  the composition; owns the canvas and orders the passes
src/bokeh/BackgroundWash.tsx  near-black ground with a broad, very soft variation
src/bokeh/ElementField.tsx    the field itself, in five blurred depth bands
src/bokeh/FocusPass.tsx       bloom over the in-focus marks
src/bokeh/GrainPass.tsx       vignette and fine grain
```

The four passes are separate components that draw into one shared canvas
rather than owning a layer each — five stacked 4K canvases would cost ~165MB
and buy nothing. React runs child layout effects in mount order, so the passes
execute in exactly the order they are written in `BokehField.tsx`.

Elements are bucketed into five bands by how defocused they are, and each band
is painted into one padded offscreen buffer that is blurred exactly once on its
way back into the frame; blurring ~1400 elements individually at 4K is unusably
slow. Everything composites with `lighter`, so overlapping marks pool into hot
regions.

Redesigning the look means editing `src/bokeh/config.ts` and nothing else.
