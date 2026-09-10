# Trading Macro Stills

A Remotion project that generates **still images** — not video — of a financial
trading display photographed close up at an angle: candlesticks, moving-average
curves, binary and numeric fields, code, grids and LED panels, stacked at
different depths, heavily defocused, with a lens flare.

Everything is drawn on a 2D `<canvas>` in a single pass. There is no 3D, no
animation, no loop and no timing: the composition's `durationInFrames` is `1`.

## The composition

| | |
|---|---|
| Composition id | `TradingMacro` |
| Size | **3840 × 2560** (4K, 3:2) |
| Output | PNG still |
| `durationInFrames` | 1 |

A second composition, `ContactSheet` (3840 × 1920), tiles all twelve stills at
reduced scale.

## Props

Two props, both strings.

| Prop | Accepted values |
|---|---|
| `composition` | `t01` `t02` `t03` `t04` `t05` `t06` |
| `palette` | `cyanNavy` `tealBlue` `violetPink` `amberDark` `greenSlate` `magentaBlue` |

An unrecognised value falls back to `t01` / `cyanNavy`.

### The six compositions

| id | |
|---|---|
| `t01` | **Curve over candles.** A bright moving-average curve is the sharp layer, crossing the frame in a broad S. A dense candle series and a red numeric field behind it; a soft grid and a binary field in front. Strong tilt receding right, cool flare upper-right. |
| `t02` | **Depth of panels.** The sharp layer is a sparse candle series in the lower left with an angular node line over it. Dot-matrix panels at visibly different tilts recede to the upper right. Warm flare, lower-left corner. The most three-dimensional setup. |
| `t03` | **Dense candles.** A tall dense candle series fills the frame as the sharp layer, with a solid and a dashed curve over it and a binary field behind. Warm flare lower-right, moderate tilt. The busiest setup. |
| `t04` | **Soft and dark.** The sharp band falls on a numeric field, so the candles behind it are soft and the whole image is quieter and darker. One pale curve rises across the frame; a dot matrix occupies the lower right. Small cool flare, lower centre. The one most usable behind text. |
| `t05` | **Warm crossing.** A warm curve crosses a cool candle series, so the frame carries two temperatures. The curve is sharp; a dashed second curve runs beneath it, binary fields sit in both upper corners. Large warm flare bleeding in from the upper right. |
| `t06` | **Code and charts.** A code block is the sharp layer, occupying the left third at a steep tilt with its syntax colouring visible. Candles and curves fill the right, softer, over a dot matrix. Warm flare on the right edge. |

### The six palettes

Each palette defines a background, candle up and down, curve primary and
secondary, dim and bright text, and a flare core. Candle up and candle down
are always in contrasting hues — that distinction is the one piece of
information a financial image has to carry.

`cyanNavy` · `tealBlue` · `violetPink` · `amberDark` · `greenSlate` ·
`magentaBlue`

## Rendering a single still

```bash
npx remotion still TradingMacro out/stills/trading-t01-cyanNavy.png \
  --props='{"composition":"t01","palette":"cyanNavy"}'
```

## Rendering the batch

Renders twelve stills — each composition in two palettes — into `out/stills/`,
then the contact sheet to `out/contact-sheet.png`:

```bash
npm run batch
# or
node --experimental-strip-types scripts/render-batch.ts
```

Files are named `trading-<composition>-<palette>.png`, for example
`trading-t01-cyanNavy.png`.

The pairs live in `src/batch.json`, which both the script and the contact
sheet read:

| | |
|---|---|
| `t01` | `cyanNavy`, `violetPink` |
| `t02` | `tealBlue`, `amberDark` |
| `t03` | `cyanNavy`, `greenSlate` |
| `t04` | `violetPink`, `tealBlue` |
| `t05` | `amberDark`, `magentaBlue` |
| `t06` | `magentaBlue`, `cyanNavy` |

Two optional environment variables:

* `REMOTION_BROWSER_EXECUTABLE` — path to an existing Chrome/Chromium, so
  Remotion does not download its own.
* `OUT_DIR` — output root, `./out` by default.

## Reproducibility

**The same composition and palette always produce the same image.** All
randomness runs through Remotion's `random()` with seeds derived from the
composition name and the layer id; `Math.random()` is not used anywhere. Two
runs of the same props are byte-identical, and re-rendering after a palette
change keeps the geometry and changes only the colour.

## Everything shown is fictional

**All ticker codes, prices, percentages and code text in these images are
invented.** The three and four letter codes are drawn from a fixed list of
made-up strings and do not refer to any listed instrument; the numbers come
from a seeded random walk and are not quotes; the code block is generated
from invented function and field names and reproduces no real source or
licence header. Nothing in the output should be read as market data.

## How it is put together

```
src/
  Root.tsx          composition registration
  TradingMacro.tsx  builds the scene, owns the visible canvas
  compositions.ts   THE data structure — layer stacks, tilts, focus, flares
  palettes.ts       the only file with hex literals in it
  scene.ts          depth → blur bracket, layer buffers, placements
  LayerView.tsx     one depth plane: glow, temperature, placement
  batch.json        the twelve composition/palette pairs
  elements/         CandleSeries CurveLayer BinaryField NumericField
                    CodeBlock GridLayer DotMatrix LensFlare FocusPass
  lib/              seeded random, price series, canvas blur and keystone
scripts/
  render-batch.ts   twelve stills plus the contact sheet
```

Adding a seventh composition means adding an entry to `COMPOSITIONS`. The
renderer walks that structure; it needs no new code.

### The depth model

Each composition defines five to seven layers, each with a depth, its own
tilt and keystone, a scale derived from depth, an opacity, and an element
type. Layers composite with `lighter`, so overlaps brighten.

One narrow depth range is sharp. Layers are sorted into **five buffers by
signed distance from the focus band** — well behind, just behind, in focus,
just in front, well in front — so the buffers still composite in depth order
while each is blurred exactly once. Blur reaches roughly 70px at 4K at the
extremes. Each buffer is saturated and brightened *before* it is blurred, so
defocused highlights bloom into soft glowing marks rather than fading.

Every pixel measurement in `compositions.ts` is quoted against a 3840 × 2560
reference and scaled to the output size, which is how the contact sheet
renders the same specs at tile resolution.

## Fonts

`public/fonts/DejaVuSansMono.ttf` is bundled so text metrics do not depend on
what the rendering machine has installed. DejaVu fonts are distributed under
the Bitstream Vera / DejaVu licence.
