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

`--scale=1.5625` takes the 3840-wide composition to 6000x3375. The four
shipped stills are frames **129, 241, 352 and 463**.

Those frames are not arbitrary. The icon highlight is a smooth pulse — three
passes over the nine icons across the loop — so most frames catch one icon
part-way through a fade, which looks like a rendering error in a still. These
four are the well-separated frames at which exactly one icon is at full
brightness and every other is fully off. To find them for a different cycle
count:

```js
const frac = (x) => x - Math.floor(x);
const pulse = (f, cycles, shift, width) => {
  const p = frac(frac((f * cycles) / 600) - shift);
  return p > width ? 0 : 0.5 - 0.5 * Math.cos((p / width) * 2 * Math.PI);
};
// a frame is clean when no icon sits mid-fade
const clean = (f) =>
  Math.max(...[...Array(9).keys()].map((i) => {
    const v = pulse(f, 3, i / 9, 0.2);
    return Math.min(v, 1 - v);
  })) < 0.03;
```

A 1080p still is the same command with `--scale=0.5`.

---

## Render time

Measured on this machine: 4 cores, `--concurrency=4`, Chromium headless.

| Target | Per frame | 600 frames |
| --- | --- | --- |
| 1080p (`--scale=0.5`), end to end | 3.0 s | 1808 s (~30 min) — measured |
| 1080p, frames only (PNG sequence, no encode) | 2.0 s | 1209 s — measured |
| 4K (native) | ~12 s (est.) | ~2 h (est.) |

The 4K figure is scaled by pixel count from the 1080p measurement, not a
measured full run.

**This is slower than a piece with no GPU work ought to be, and the cause was
measured rather than guessed: it is the CSS 3D rotation.** Every element
carrying one becomes its own composited surface that Chrome re-rasterises at
a raised scale so the tilted result stays sharp, and the cost climbs with the
tilt angle:

| Plane tilt | Per frame at 1080p |
| --- | --- |
| rotations zeroed | 0.93 s |
| rotateX 19.5 deg | 1.57 s |
| rotateX 31 deg (shipped) | 3.0 s |

The steep tilt is what makes the piece read as a receding plane rather than a
flat layout, so that cost is deliberate. If a buyer wants a faster render more
than they want the perspective, `PLANE_ROT_X` in `constants.ts` is the dial.

Three optimisations were tried. Two are in the code:

- **Glow filter regions.** A filter surface costs the square of its extent.
  Every region in `Defs.tsx` is sized to just over 3x its largest
  `stdDeviation` instead of the generous default.
- **Bokeh blur per disc, not per layer.** Blurring the two bokeh fields with a
  CSS blur on the whole layer cost ~0.3 s/frame; thirty small SVG filter
  surfaces cost a fraction of that and look the same.

One was tried and **reverted**: collapsing the six depth layers onto two
rotated surfaces, with the far and near instrument slabs blurred by an SVG
filter inside the interface plane. That made things much worse — 3.8 s/frame
against 1.6 at the time — because an SVG filter over a near-frame-sized group
inside an already 3D-transformed surface is evaluated at that surface's raised
raster scale. The finding is recorded in the comment block in
`src/ai-hud/Plane.tsx` so nobody repeats it.

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
  bgCentre: "#042A6B",  // navy immediately around the core
  bgMid:    "#02143A",
  bgEdge:   "#030F26",  // corners — deliberately not black
  cyan:     "#28CBF6",  // traces, panel furniture, gauges
  cyanDim:  "#1E7FAE",
  cyanDeep: "#11557F",  // filled panel bodies
  coreFill: "#12C6F4",  // the disc
  coreHot:  "#A8EFFF",  // hot centre of the disc, and the trace pulses
  coreInk:  "#03243F",  // the AI lettering
  line:     "#63B4DE",  // panel strokes
  text:     "#9FD2F2",
  textDim:  "#5E9CC8",
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
export const TRACE_COUNT = 30;        // long runs, 1.95-3.15x the core radius
export const SHORT_TRACE_COUNT = 18;  // short runs, 1.42-1.92x
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

### Measured

**Renders are reproducible.** Two independent multi-threaded renders covering
different frame ranges (frames 0-599 and frames 240-359, four workers, so
frame 300 was handled by a different worker at a different point in each run)
produced a **byte-identical** frame 300. Forcing `--gl=swiftshader` produced
the same hash again. There is no thread- or order-dependence.

**One caveat, stated rather than hidden.** Frame 300 rendered *alone* by
`npx remotion still` is **not** byte-identical to frame 300 from a full
sequential render: 1194 of 2,073,600 pixels differ, by 1 level for 1075 of
them and by at most 5, all inside the glow around the core.

It is not this composition. The same split appears with the scene unchanged:

| How frame 300 was produced | Result |
| --- | --- |
| `remotion still`, cold start (twice) | hash A |
| `remotion render --sequence`, 5 frames | hash A |
| `remotion render --sequence`, 90 frames | hash B |
| `remotion render --sequence`, 120 frames | hash B |
| `remotion render --sequence`, 600 frames | hash B |

Each pipeline is perfectly repeatable; they differ from each other. The split
tracks how many frames a page has already drawn, so it is a Chrome raster
warm-up effect in the SVG filter path, not a property of the scene. Every
frame of an actual video render comes from the warm path, so the output is
internally consistent and re-rendering reproduces it exactly.

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

### Measured

Checked on the **encoded mp4**, not the studio preview.

A high-pass of the blue channel (blue minus a 9px Gaussian, sampled only in
smooth areas) measures how much dither survives the encode:

| | dither energy in smooth areas (std) |
| --- | --- |
| source PNG | 8.29 levels |
| encoded mp4, CRF 16 | 7.64 levels |
| encoded mp4, CRF 12 | 7.94 levels |

**No banding contours.** The encoder keeps ~92% of the dither energy, and a
contrast-stretched high-pass of the halo shows noise texture throughout with
no arc-shaped steps.

One measurement is worth not misreading: sampling a single one-pixel-wide ray
out of the halo gives runs of 9-33 identical values at CRF 16 against 4-9 in
the source PNG, which looks alarming. It is an artifact of sampling a 1px ray
through 2D noise — the dither is there, just not along that particular line.
The high-pass figures above are the metric to trust.

CRF 16 does leave faint 16x16 macroblock texture in the flat darks. It is not
banding, but if a buyer wants it gone, CRF 12 removes most of it at roughly
double the file size.

### Re-running the check

```console
ffmpeg -v error -y -i out/AIInterfaceHUD.mp4 -vf "select=eq(n\,150)" -vframes 1 /tmp/band.png
python3 - <<'PY'
from PIL import Image, ImageFilter
import numpy as np
im = Image.open("/tmp/band.png").convert("RGB").split()[2]
hp = np.asarray(im).astype(float) - np.asarray(im.filter(ImageFilter.GaussianBlur(9))).astype(float)
smooth = np.asarray(Image.open("/tmp/band.png").convert("L").filter(ImageFilter.FIND_EDGES)) < 6
print("dither energy in smooth areas:", hp[smooth].std())
PY
```

Below about 4 levels the dither is being crushed: raise the grain opacities in
`Grain.tsx` toward 2.5%, then lower CRF toward 14.

---

## Completion checklist

- [x] 1920x1080, exactly 30/1 fps, exactly 20.000000s, h264, `yuv420p`, no audio stream
- [x] Seamless loop: frame 600 byte-identical to frame 0 (verified by
      temporarily extending the composition to 601 frames)
- [~] Deterministic: two independent multi-threaded renders give a
      byte-identical frame 300. A frame rendered *alone* differs from one in a
      full render by <=5/255 on 0.06% of pixels — a Chrome raster warm-up
      effect, not the scene. See Determinism above.
- [x] Resolution independent: identical layout at 1080p and 4K, traces visible
      at both, text the same proportion of the frame
- [x] Core is the brightest element by a clear margin (peak 250 vs 218 for the brightest trace pixel)
- [x] Traces stay crisp lines; only the core is blown out
- [x] Trace pulses at different positions each frame, running at 1-4x speeds
- [x] Rings rotate, two of them in opposite directions
- [x] Counters change and return to their frame-0 values
- [x] Icon highlights advance through the grid; the four stills are at frames where none is mid-fade
- [x] Depth layers distinguishable by blur (local detail 3.09 sharp / 0.86 far / 0.75 near)
- [x] Interface cropped by both side edges
- [x] Plane tilted on two axes — no panel edge or trace run parallel to a
      frame edge
- [x] Numbers use tabular figures and do not jitter
- [x] Warm bokeh discs present among the blue (4 orange blobs in frame 150)
- [x] OFL fonts shipped and credited; icons original; no brand marks, no
      currency symbols, no real product names
