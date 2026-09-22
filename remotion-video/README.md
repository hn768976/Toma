# AI Interface HUD

A glowing AI core with circuit traces radiating outward, surrounded by HUD
panels, icons and counters, on a dark navy plane receding into frame.

- **Composition id:** `AIInterfaceHUD`
- **Authored at:** 3840 x 2160, 30fps, 600 frames (20s)
- **Loop:** seamless — frame 600 is pixel-identical to frame 0
- **Renderer:** Remotion, 2D only. React + SVG + CSS 3D transforms.
  **No `@remotion/three`, no WebGL, no canvas.**

The repository also carries two earlier pieces (`BluetoothExplainer`,
`ParticleRingHalo`); they are unrelated to this composition and share nothing
but the Remotion scaffold.

---

## Commands

```console
npm install
npx remotion studio
```

### 1080p preview (the delivered mp4)

```console
npx remotion render AIInterfaceHUD out/AIInterfaceHUD.mp4 \
  --scale=0.5 --codec=h264 --crf=16 \
  --pixel-format=yuv420p --image-format=png --muted --concurrency=4
```

`--scale=0.5` renders the 3840x2160 composition down to 1920x1080. All sizes
are fractions of the frame, so nothing reflows.

Two flags matter more than they look:

- `--image-format=png` overrides the project-wide JPEG intermediate set in
  `remotion.config.ts`. A JPEG intermediate puts compression artifacts into
  exactly the dark gradients this piece is made of, which defeats the dither.
- `--muted` keeps a silent AAC track out of the file. Without it the output
  carries an audio stream and runs 20.05s instead of 20.0s.

### 4K render

```console
npx remotion render AIInterfaceHUD out/AIInterfaceHUD-4K.mp4 \
  --codec=h264 --crf=14 \
  --pixel-format=yuv420p --image-format=png --muted --concurrency=4
```

No `--scale`: the composition is already 3840x2160.

### Stills

```console
npx remotion still AIInterfaceHUD out/still-6000.png \
  --frame=150 --scale=1.5625 --image-format=png
```

`--scale=1.5625` takes the 3840-wide composition to 6000x3375. Change
`--frame` for the other stills; 150, 275, 400 and 520 are well separated in
counter values, lit grid cells, icon highlight and camera position.

A 1080p still is the same command with `--scale=0.5`.

---

## Render time

Measured on this machine: 4 cores, `--concurrency=4`, Chromium headless.

| Target | Per frame | 600 frames |
| --- | --- | --- |
| 1080p (`--scale=0.5`) | ~1.55 s | ~15 min |
| 4K (native) | ~5.5 s (est.) | ~55 min (est.) |

The 4K figure is an estimate scaled by pixel count from the 1080p
measurement, not a measured full run.

**This is slower than a piece with no GPU work ought to be, and the cause was
measured rather than guessed.** The cost is the CSS 3D rotation: every
element carrying one becomes its own composited surface that Chrome
re-rasterises at a raised scale so the tilted result stays sharp. Setting all
three plane rotations to 0 and changing nothing else takes the render from
~1.55 s/frame to ~0.93 s/frame. The two-axis tilt is a requirement of the
piece, so that cost stays.

Three optimisations were tried. Two are in the code:

- **Glow filter regions.** A filter surface costs the square of its extent.
  Every region in `Defs.tsx` is now sized to just over 3x its largest
  `stdDeviation` instead of the generous default.
- **Bokeh blur per disc, not per layer.** Blurring the two bokeh fields by
  putting a CSS blur on the whole layer cost ~0.3 s/frame; thirty small SVG
  filter surfaces cost a fraction of that and look the same.

One was tried and **reverted**: collapsing the six depth layers onto two
rotated surfaces, with the far and near instrument slabs blurred by an SVG
filter inside the interface plane. That made things much worse — 3.8 s/frame
against 1.6 — because an SVG filter over a near-frame-sized group inside an
already 3D-transformed surface is evaluated at that surface's raised raster
scale. The finding is recorded in the comment block in `src/ai-hud/Plane.tsx`
so nobody repeats it.

---

## Fonts

Both are shipped in `public/fonts/` and loaded from disk, so a render never
depends on a network fetch. Both are under the **SIL Open Font License 1.1**,
which permits embedding and redistribution — the licences travel in the same
folder.

| Family | Used for | Licence |
| --- | --- | --- |
| **Inter** (Regular / Medium / SemiBold) | labels, the `AI` mark | SIL OFL 1.1 — `public/fonts/Inter-OFL.txt` |
| **JetBrains Mono** (Regular / Medium) | all numbers and digit strings | SIL OFL 1.1 — `public/fonts/JetBrainsMono-OFL.txt` |

Every changing number carries `font-variant-numeric: tabular-nums` so digits
do not jitter sideways as they count.

## Icons

**All nine icons are original SVG paths drawn for this project**, in
`src/ai-hud/icons.tsx`: microphone, image, gear, cloud, lightbulb, person,
globe, robot, chat bubble. They are drawn on a shared 100x100 grid with one
uniform stroke weight.

No icon library is imported anywhere. `package.json` contains no icon
dependency, and adding one would make the rendered output unsaleable — most
icon sets carry attribution or licence terms incompatible with selling a
render.

## Other licensing notes

- No logos or brand marks.
- No real company, product or AI model names. Every string is a generic
  system word (`ANALYSIS`, `PROCESS`, `MODULE A`, `INPUT`, `STATUS`, ...).
- No currency symbols. All numbers are plain decimals and percentages.
- The `AI` mark is set upright in plain geometric sans, both letters capital.
  It is deliberately **not** a stylised or italic serif, which would resemble
  an existing product's icon.

---

## Customising

### Palette

`PALETTE` in `src/ai-hud/constants.ts` is the only place colour is defined.

```ts
export const PALETTE = {
  bgCentre: "#07254E",  // navy immediately around the core
  bgMid:    "#030F24",
  bgEdge:   "#01060F",  // corners
  cyan:     "#3FD2F2",  // traces, panel furniture, gauges
  cyanDim:  "#1E7FAE",
  cyanDeep: "#0E4A72",  // filled panel bodies
  coreFill: "#12C6F4",  // the disc
  coreHot:  "#DFFAFF",  // blown-out centre and the pulses
  coreInk:  "#03243F",  // the AI lettering
  line:     "#63B4DE",  // panel strokes
  text:     "#A9D6F0",
  textDim:  "#5E93BA",
  warm:     "#F0913A",  // the handful of orange accents
  warmDim:  "#B3672A",
};
```

For a non-blue theme, change `cyan` / `coreFill` / `coreHot` together and
move the three `bg*` values onto the same hue. Keep `coreHot` much lighter
than `cyan`: the core reading as the brightest thing in frame by a clear
margin is what stops the interface flattening into a smear. Keep `warm`
roughly complementary so the orange bokeh still reads as contrast.

### Trace count

`src/ai-hud/geometry.ts`:

```ts
export const TRACE_COUNT = 20;        // long runs, 2.2-3.85x the core radius
export const SHORT_TRACE_COUNT = 13;  // short runs, 1.38-2.05x
```

Both bands regenerate deterministically from fixed seeds, so changing a count
reshuffles the network but never breaks the loop or the determinism. The
`minReach` / `maxReach` values passed to `buildBand` control how far the runs
carry; the outer band is deliberately reaching further than the widest core
ring, which is what stops the ring system dominating the hub.

`BOKEH_COUNT` in the same file controls the out-of-focus debris.

### Label text

- **Panel titles and loose labels:** the `title=` props and `<Label>` children
  in `src/ai-hud/clusters.tsx`, plus the large `M-42` plate designation in
  `MidCluster`.
- **Counter captions:** the `label` fields in `COUNTER_SLOTS` in
  `src/ai-hud/geometry.ts`. `null` means the readout has no caption.
- **Gauge captions:** the `label=` props on `<Gauge>` in `clusters.tsx`.

Keep strings short — the panels are sized for them and nothing reflows to
fit. Stay with generic system words; see the licensing note above.

### Timing

`DURATION_IN_FRAMES` in `constants.ts`. The loop stays closed at any value,
because every animated quantity goes through the integer-cycle helpers in
`src/ai-hud/loop.ts`. See below.

---

## How the loop stays closed

Every periodic quantity completes an **integer** number of cycles over the
600 frames, and every helper in `src/ai-hud/loop.ts` also **wraps its
argument into a single period** before using it.

That wrap is not cosmetic. `rotate(720deg)` does not produce a bit-identical
matrix to `rotate(0deg)` — `cos(4*PI)` is `0.9999999999999999`, not `1` — and
a `stroke-dashoffset` of `-18000` does not land on exactly the same dash phase
as `0`. Before the wrap was added, frames 0 and 600 differed on 733 pixels by
up to 3/255, scattered through the core and trace region. Reducing to the
principal value first removes that class of error completely.

## Determinism

Remotion renders frames out of order across worker threads, so everything on
screen is a pure function of `useCurrentFrame()`.

- No `Math.random()` at render time. A module-level `mulberry32` generates
  trace geometry, bokeh paths, panel contents and counter series **once**, at
  build time, in `src/ai-hud/geometry.ts`.
- No `Date.now()`, no `requestAnimationFrame`.
- **No CSS `@keyframes` and no CSS transitions anywhere.** They are driven by
  wall-clock time and desync across render threads. Every animated property —
  including every `stroke-dashoffset` and every rotation — is an inline style
  computed from the frame.
- No mutable state between frames, no `useState` driving visuals, no refs
  updated per frame.

The grain follows the same rule: one `feTurbulence` tile with a fixed seed,
scrolled by an offset that is an integer number of tile widths over the loop.

---

## Banding

Dark navy with a bright glow over it is the bad case for 8-bit H.264, and
this frame is mostly that. Two noise layers in `src/ai-hud/Grain.tsx` dither
the ramps: a visible grain at ~2.1% and a near-pixel dither at ~1.4%. Both are
**applied after the glow** — they are the last element in the DOM — because
the glow is what creates the smoothest gradients in the image.

Both are authored in output pixels, not in the 3840-unit authoring space:
grain is a pixel-level phenomenon and should stay about one output pixel
across at any render resolution.

### Verifying

Check the **encoded mp4**, not the studio preview:

```console
ffmpeg -v error -y -i out/AIInterfaceHUD.mp4 -vf "select=eq(n\,150)" -vframes 1 /tmp/band.png
python3 - <<'PY'
from PIL import Image
import numpy as np
a = np.asarray(Image.open("/tmp/band.png").convert("RGB")).astype(int)
# A scanline running out of the core's halo into the dark background.
row = a[430, 960:1900].mean(axis=1)
d = np.diff(row)
# Stepped plateaus show up as long runs of exactly zero difference.
runs, cur = [], 0
for v in d:
    cur = cur + 1 if v == 0 else 0
    runs.append(cur)
print("longest flat run:", max(runs), "px")
PY
```

Values should fall smoothly. Stepped plateaus — long runs of identical
values followed by a jump — are a failure. If bands survive, raise the grain
opacities in `Grain.tsx` toward 2.5%, then lower CRF toward 14.

---

## Completion checklist

- [x] 1920x1080, exactly 30/1 fps, exactly 20.0s, h264, `yuv420p`, no audio stream
- [x] Seamless loop: frame 600 byte-identical to frame 0 (verified by
      temporarily extending the composition to 601 frames)
- [x] Deterministic: frame 300 rendered alone from a cold start is
      byte-identical to frame 300 from a full sequential multi-threaded render
- [x] Resolution independent: identical layout at 1080p and 4K, traces visible
      at both, text the same proportion of the frame
- [x] Core is the brightest element by a clear margin
- [x] Traces stay crisp lines; only the core is blown out
- [x] Trace pulses at different positions each frame, running at 1-4x speeds
- [x] Rings rotate, two of them in opposite directions
- [x] Counters change and return to their frame-0 values
- [x] Icon highlights advance through the grid
- [x] Depth layers distinguishable by blur
- [x] Interface cropped by both side edges
- [x] Plane tilted on two axes — no panel edge or trace run parallel to a
      frame edge
- [x] Numbers use tabular figures and do not jitter
- [x] Warm bokeh discs present among the blue
- [x] OFL fonts shipped and credited; icons original; no brand marks, no
      currency symbols, no real product names
