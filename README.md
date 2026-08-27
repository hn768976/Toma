# Halftone AI Dashboard

A 4K one-shot build-and-hold animation in Remotion, in three versions driven by
a single `variant` prop on a single composition.

Everything is drawn to offscreen canvases from `useCurrentFrame()` and composited
by hand. Two of the three versions then resample that composite through a **dot
screen** — a regular grid of circular dots whose radius is driven by the
underlying cell's luminance, so the frame is *rebuilt out of dots* rather than
having a dot pattern laid over a finished picture. The third version switches the
dot screen off and shows the composite directly.

---

## Compositions

| Composition id       | Variant | Resolution  | Duration            | FPS | Panels                    | Dot screen |
| -------------------- | ------- | ----------- | ------------------- | --- | ------------------------- | ---------- |
| `HalftoneDashBlue`   | `blue`  | 3840 × 2160 | 570 frames / 19.0 s | 30  | charts                    | yes        |
| `HalftoneDashGreen`  | `green` | 3840 × 2160 | 570 frames / 19.0 s | 30  | code / logs               | yes        |
| `HalftoneDashAmber`  | `amber` | 3840 × 2160 | 570 frames / 19.0 s | 30  | radial gauge assembly     | **no**     |

All three render independently. No audio, no watermark.

### blue — charts, halftone

Deep navy and cyan. A dot-matrix world map, a bar chart with a value readout,
two ring gauges, a table and a line graph, arranged in six overlapping panels at
varied depths. Panels arrive **nearest first**. Centre glyph is `AI` in a
geometric sans.

### green — code panels, phosphor terminal

Near-black and hot green, deeper and higher-contrast than blue. Two code windows
scrolling at different speeds over fictional source, two log panels pushing
timestamped lines up from the bottom with occasional amber warnings and red
errors, a process list and a CPU/memory waveform strip. Panels arrive
**furthest first**, so the frame fills from the outside in. Faint scanlines land
before the dot screen so the halftone breaks them up. Centre glyph is `AI LOG` in
a monospace with a blinking underscore cursor on a 30-frame cycle.

### amber — gauges, clean vector

Warm bronze and amber. The rectangular cluster is replaced by a single radial
assembly: a large arc gauge with a needle and tick scale, two ring gauges
flanking it, a semicircular level meter beneath, each with its own numeric
readout. Needles spring to new targets every 78 frames, the rings fill and drain,
the meter oscillates. `halftone: false` — the composite goes straight to the
canvas, so everything is crisp vector with smooth gradients, and the
depth-of-field ceiling rises from 24 px to 34 px to carry the depth on its own.
Centre glyph is `AI CORE` over two lines in the geometric sans.

---

## Rendering

Install once:

```bash
npm install
```

### 1080p previews

```bash
npx remotion render HalftoneDashBlue  out/halftone-blue-preview.mp4  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render HalftoneDashGreen out/halftone-green-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render HalftoneDashAmber out/halftone-amber-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--scale=0.5` renders the 3840 × 2160 composition out at 1920 × 1080. Lower
`--concurrency` to the number of CPU cores available if Remotion rejects the
value (it refuses a concurrency higher than the core count).

### Full 4K masters

```bash
npx remotion render HalftoneDashBlue  out/halftone-blue.mp4  --codec=h264 --crf=12
npx remotion render HalftoneDashGreen out/halftone-green.mp4 --codec=h264 --crf=12
npx remotion render HalftoneDashAmber out/halftone-amber.mp4 --codec=h264 --crf=12
```

### Studio

```bash
npx remotion studio
```

---

## How it is put together

```
src/
  variants.ts            every palette, glyph, panel kind and post-processing flag
  HalftoneDash.tsx       the composition; owns the buffers, provides the context
  Root.tsx               the three <Composition> registrations
  components/
    BokehField.tsx       drifting out-of-focus discs
    NetworkWeb.tsx       drifting nodes with links recomputed every frame
    CentreOrb.tsx        assembly dots, rim, pulse, centre glyph
    SidePanel.tsx        one panel; a single switch picks the body renderer
    HalftoneLayer.tsx    composite, bloom, scanlines, vignette, dot screen, grain
  panels/
    chrome.ts            shared panel frame, header and border
    charts.ts            blue bodies
    code.ts              green bodies
    gauges.ts            amber bodies
    source.ts            the fictional source text and log lines
  lib/
    scene.ts             the offscreen buffer set
    layout.ts            panel boxes, web nodes, bokeh, orb dots
    motion.ts            frame-derived easing, stepping and springs
    canvas.ts            colour and path helpers
    worldmap.ts          coarse lon/lat landmass polygons, rasterised once
    grain.ts             pre-rendered noise tiles
    fonts.ts             font loading gated behind delayRender
```

### One composition, three versions

`VARIANTS` in `src/variants.ts` is the only place a colour, a glyph or a
post-processing flag is written down. Nothing else in the project contains a hex
literal or a glyph string; every component reads what it needs from the variant
it is handed. `<SidePanel>` is one component with one switch on the variant's
panel kind.

### Drawing

Every child paints into a shared set of offscreen buffers from its own layout
effect. React flushes layout effects in tree order, so the order the children
appear in `HalftoneDash` *is* the paint order, with `<HalftoneLayer>` last. Each
child calls `resetScene`, which is frame-guarded, so the buffers are wiped exactly
once per frame no matter which child runs first.

All motion derives from `useCurrentFrame()`. There is no `Date.now()`, no
`requestAnimationFrame`, no CSS animation and no component state. Randomness comes
from Remotion's seeded `random()` with stable string seeds — never `Math.random()`
— so any frame can be rendered in isolation and comes out identical.

Periods are chosen to divide 570: the orb's rim pulse (95), the web node drift
(570 / 285 / 190), the bokeh sway and the amber rings (190 / 114). The camera
drift is a Lissajous path whose components both close on the last frame.

### Depth of field

Three offscreen buffers — sharp, mid, far — with elements bucketed by depth and
each buffer blurred exactly once on the way into the composite. Blurring per
element is unusable at 4K. `mid` and `far` are stored at half resolution: they are
about to be blurred by 9–34 px anyway, so the detail is discarded regardless and
the fill cost drops by 4×. Each buffer carries a base transform, so all drawing
code works in 4K composition coordinates and never has to know its own scale.

### The dot screen

`HalftoneLayer` flattens the buffers, then:

1. box-averages the composite down to one sample per dot cell (two steps, via a
   half-resolution intermediate — a single 4K → cell-grid downscale aliases badly),
2. fills the display canvas with near-black,
3. draws one circle per cell whose **radius** tracks that cell's luminance.

Two details carry the look:

- **Radius goes as the square root of luminance.** A dot's contribution to its
  cell is its *area*, which goes as radius squared. Any other exponent shifts the
  whole tone curve — 0.64, for instance, applies a hidden 1.28 gamma that crushes
  the shadows and erases the background web entirely.
- **The backdrop falls away steeply.** A broad, evenly-lit background resolves
  into an even field of mid-sized dots — the "screen door over a normal image"
  failure. The mid tone is kept as a tight glow behind the orb and drops below the
  deep tone at the frame edges, which is what leaves the dark regions nearly empty
  while highlights grow into dots large enough to touch and overlap.

Bloom, scanlines and the vignette all land on the composite **before** the dot
screen, so blurred and glowing regions turn into large soft dots. Grain lands
**after**, so it is not quantised away by the dot grid.

The pitch is set by `DOT_PITCH` in `src/variants.ts` and is currently 9 px at
4K. Because the screen resamples at that pitch, anything with a feature size near
it is destroyed by it. Panel borders, web lines and map cells are all
drawn heavier than they would need to be in a normal render — that is deliberate,
and it is why the world map's land cells are near-solid rather than a sparse dot
grid of their own.

### Switching it off

`amber` sets `halftone: false`. That is a branch on the flag inside
`HalftoneLayer`, not a second render path: the same components draw into the same
buffers and the same composite is assembled; the dot screen step is simply
skipped and the composite is drawn straight to the canvas.

---

## Fonts

Two fonts are bundled under `public/fonts/` and loaded behind `delayRender` so
canvas text never draws with a fallback face:

- **Poppins SemiBold** — the geometric sans (blue's `AI`, amber's `AI CORE`, panel
  numerals). SIL Open Font License 1.1.
- **JetBrains Mono Medium** — the terminal monospace (green's `AI LOG` cursor
  prompt, code and log panels). SIL Open Font License 1.1.

## Content

All source code, log lines, process names, subsystem names and readings shown in
the panels are invented for this piece. Nothing is reproduced from real library
source or from any real product's diagnostics. The world map is a coarse
hand-drawn polygon approximation, adequate to read as a world map at panel size
and nowhere near accurate enough to be used as data.
