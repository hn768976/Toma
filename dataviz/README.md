# Data Visualisation — Remotion motion-graphics batch

Nine compositions across five looks: animated charts, dashboards and financial
graphics. **Everything here is 2D** — React, SVG and CSS. There is no
`@remotion/three`, no WebGL and no GPU scene anywhere in the project. All
perspective comes from CSS 3D transforms (`perspective` on a container,
`rotateX`/`rotateY`/`translateZ` on the layers); all depth of field is
per-layer `filter: blur()`; all neon is stacked SVG filters.

---

## Compositions

| Composition id | Output file | Frames | Duration | Loops? | Still frames |
|---|---|---|---|---|---|
| `GrowthLine-Navy` | `GrowthLine_Navy.mp4` | 300 | 10s | **no** | 210, 255, 299 |
| `GrowthLine-Black` | `GrowthLine_Black.mp4` | 300 | 10s | **no** | 200, 250, 299 |
| `BarChart-Cyan` | `BarChart_Cyan.mp4` | 600 | 20s | yes | 60, 240, 460 |
| `BarChart-Amber` | `BarChart_Amber.mp4` | 600 | 20s | yes | 120, 330, 520 |
| `DarkDashboard-Teal` | `DarkDashboard_Teal.mp4` | 600 | 20s | yes | 90, 300, 510 |
| `DarkDashboard-Blue` | `DarkDashboard_Blue.mp4` | 600 | 20s | yes | 150, 360, 540 |
| `LightDashboard-Warm` | `LightDashboard_Warm.mp4` | 600 | 20s | yes | 60, 172, 320 |
| `LightDashboard-Slate` | `LightDashboard_Slate.mp4` | 600 | 20s | yes | 30, 428, 540 |
| `FinancialMontage-Blue` | `FinancialMontage_Blue.mp4` | 600 | 20s | yes | 90, 300, 480 |

All compositions are defined at **3840×2160, 30fps, 16:9**.

> **Look 1 is not a loop, and must not be made into one.** The two
> `GrowthLine` compositions draw a line in over frames 0–180 and then hold to
> frame 299 with only the particles and the glow still moving. The growth is
> what the clip sells; looping it back to flat destroys that. Composition ids
> use hyphens because Remotion rejects underscores in ids; the delivered file
> names use underscores as specified.

---

## Rendering

### 4K (the real render)

```bash
npx remotion render <id> out/<name>.mp4 --scale=1 --crf=16
```

for example:

```bash
npx remotion render DarkDashboard-Teal out/DarkDashboard_Teal.mp4 --scale=1 --crf=16
```

`remotion.config.ts` already pins codec `h264`, pixel format `yuv420p`, CRF 16
and **PNG intermediate frames**. The PNG intermediate matters: these are large
smooth dark gradients under bright glow, and a JPEG intermediate would add its
own banding on top of whatever the H.264 encode does.

### 1080p previews

```bash
./render-previews.sh
```

which runs, per composition:

```bash
npx remotion render <id> out/video/<name>.mp4 \
  --scale=0.5 --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

`--scale=0.5` on a 3840×2160 composition gives exactly 1920×1080. Do not
render 4K for previews.

### Stills

```bash
./harvest-stills.sh
```

Three stills per composition at **6000×3375** (the composition at
`--scale=1.5625`) plus one 1920×1080 PNG each. Frames are listed in the table
above and in the script. A single still by hand:

```bash
npx remotion still <id> out/stills/<name>_f300.png --frame=300 --scale=1.5625 --image-format=png
```

Dashboard stills (looks 3 and 4) sell particularly well as mockup and
presentation assets. The look-4 still frames are deliberately chosen where no
tooltip is mid-fade.

---

## Measured render times

1080p previews (`--scale=0.5`), measured on the machine this batch was built
on. The 4K column scales by the 4x pixel count and is an estimate.

| Composition | s/frame @1080p | 20s clip @1080p | s/frame @4K (est.) | clip @4K (est.) |
|---|---|---|---|---|
| DarkDashboard-Teal | 0.16 | 1m 38s | ~0.65 | ~6.5 min |
| DarkDashboard-Blue | 0.16 | 1m 37s | ~0.65 | ~6.5 min |
| GrowthLine-Navy | 0.42 | 2m 05s (10s clip) | ~1.7 | ~8.5 min (10s clip) |
| FinancialMontage-Blue | 1.25 | 12m 28s | ~5.0 | ~50 min |
| GrowthLine-Black | 1.37 | 6m 50s (10s clip) | ~5.5 | ~27 min (10s clip) |
| LightDashboard-Slate | 1.48 | 14m 49s | ~5.9 | ~59 min |
| LightDashboard-Warm | 1.50 | 15m 02s | ~6.0 | ~60 min |
| BarChart-Amber | 1.54 | 15m 22s | ~6.1 | ~61 min |
| BarChart-Cyan | 1.65 | 16m 27s | ~6.6 | ~66 min |

All nine at 1080p: **86 minutes**.

### Why the spread is 10x, and what to do about it

The two dark dashboards are pure SVG with no blur anywhere and run at 0.16
s/frame — genuinely near encode speed. Everything slower is slower for one
reason: **full-frame `filter: blur()` layers, re-rasterised every frame.**

- BarChart: 5 depth-of-field bands + 1 lattice = 6 full-frame blurred layers
- LightDashboard: 4 full-frame copies of the dashboard, each blurred
- FinancialMontage: 4 full-frame blurred parallax layers
- GrowthLine-Black: 2 (the grid, the foreground curve)

The blur is in screen space on purpose: each depth band is a separate
perspective container, and blurring after the projection rather than inside it
is what keeps the bands in register. Blurring inside the 3D transform squashes
the blur along with the content and leaves visible seams where bands meet.

The fix, not implemented here, is to clip each blurred wrapper to the
screen-space rectangle its band actually occupies instead of to the whole
frame. That needs the projected bounds of each band computed in JS rather than
left to CSS. It should recover most of the gap, since the blur cost is
proportional to the area being filtered and most of each full-frame layer is
empty.

If you are rendering 4K and want it faster without touching the layer
structure, drop the DOF band count (`STRIPS` in `BarChart.tsx`, `BANDS` in
`LightDashboard.tsx`) from 5 and 4 to 3. That trades some smoothness in the
focus falloff for a roughly linear saving.

---

## Verification results

Every check below was run against this build. Scripts: `verify-loops.sh`
(steps 3 and 4), `verify-outputs.sh` (steps 1, 5, 6, 7), `analyze-banding.py`,
`check-looks.py`.

| Step | Result |
|---|---|
| 1 — ffprobe | **9/9 pass.** 1920x1080, 30/1, h264, yuv420p, exactly 10.000000s / 20.000000s, no audio stream |
| 3 — loop closure | **7/7 pass**, byte-identical frame 0 vs frame 600 at 601 frames. Look 1 exempt |
| 4 — determinism | Scene-level pass; see the reproducibility note above for what the rasteriser does |
| 5 — resolution scaling | Pass. 1080p vs 4K-downsampled differ on 0.134% (look 3) and 0.083% (look 4) of pixels above 40/255 — antialiasing, not reflow |
| 6 — banding | **9/9 pass**, sampled from frames extracted from the encoded mp4 |
| 7 — per-look | Pass; measurable criteria in `check-looks.py` |

The banding detector is validated against synthetic controls on every run: a
20-level ramp with no dither scores 1.40 and fails, the same ramp with noise
scores 0.01 and passes. Note that the two dark dashboards report "no shallow
ramp" rather than a positive pass — their background gradient was removed to
match the reference, so they are flat fills with nothing that can band.

Worst real reading in the batch is look 1A's glow halo at ratio 0.41 (against
a 0.5 threshold), which is the case the brief predicts: dark navy under a
bright glow.

---

## Determinism

Remotion renders frames out of order across multiple threads, so every value on
screen is a pure function of `useCurrentFrame()`.

- Seeded `mulberry32` at **module level**. Every data series, particle path,
  bokeh position, panel placement and grain tile is generated once, at load.
- **No** `Math.random()`, `Date.now()`, `requestAnimationFrame`, CSS
  `@keyframes` or CSS transitions anywhere. Every animated property is an
  inline style or attribute computed from the frame. CSS keyframes are
  wall-clock driven and would desync across threads — this is the single most
  likely determinism bug in a 2D project, so there are none in it.
- No mutable state between frames, no `useState` driving visuals, no refs
  updated per frame.

### Byte-level reproducibility: what actually holds

The React output is a pure function of the frame, and repeated single-frame
renders of the same frame are byte-identical across separate processes. That
is the property the rules above protect, and it holds for all nine
compositions.

What does **not** hold in a container is byte-identical output between two
separate *sequence* renders of the same frame. Chromium's rasterisation of
small SVG Gaussian-blur filters — the gauge arcs in look 3, the origin spark
in look 1, overlapping blurred panels in look 5 — varies by up to ~11/255 on a
few hundred pixels (roughly 0.05% of the frame). Measured: three cold stills
plus one sequence render of the same frame produced one identical hash, and a
second sequence render produced another. It persists at `--concurrency=1` and
under both the `angle` and `swiftshader` renderers, so it is a property of the
rasteriser rather than of thread scheduling or of this project. It is
invisible at 1/255–11/255 on isolated pixels and does not affect the encode.

If you need bit-exact reproducibility for an archival master, render to a PNG
sequence and keep the sequence, rather than re-rendering and expecting the
same bytes.

### The loop period is a constant, not `durationInFrames`

`src/lib/loop.ts` exports `LOOP_FRAMES = 600`. Every periodic quantity divides
by that constant rather than by `durationInFrames`. Two reasons: it makes the
loop-closure check meaningful (extending a composition to 601 frames to compare
frame 0 against frame 600 only proves something if the maths still uses 600 as
its period), and it means trimming or extending a composition cannot silently
re-phase everything in it.

### How the loops close

Every series is built from integer-frequency sines plus a seeded phase:

```
value(i) = base + SUM_k a_k * sin(2*PI*f_k*(i/N) + phi_k)
```

so `value(N) === value(0)`. Looks 2, 3 and 5 then scroll a window across that
series, advancing exactly `N` positions over the composition:

```
windowStart = N * (frame / LOOP_FRAMES)
```

Look 4's dashboard is static data — stat cards and a Gantt row do not stream —
so its loop comes from the cursor path, the tooltip cycle, one sheen pass and
two stat figures that count and return.

Every periodic quantity has an integer cycle count over the composition: the
glow pulses, the bokeh drift, the code-block scroll (an integer number of
lines), the cursor path, the light leak and the grain.

---

## Banding

The dark compositions are the bad case for 8-bit H.264. Countermeasures:

- A **grain overlay at ~2%** over the whole frame, from six 256×256 noise tiles
  generated at module level from a seeded PRNG and baked into data URIs. The
  tile cycles on `frame % 6`, which is periodic with period 6 — and 6 divides
  both 600 and 300, so it closes on every composition here. Texel size is 2
  composition px, so one noise texel lands on exactly one output pixel at
  `--scale=0.5`.
- A second, finer `soft-light` dither pass under the brightest halos.
- PNG intermediate frames (above).

**Verify on the encoded mp4, not the preview:**

```bash
ffmpeg -v error -ss 10 -i out/video/FinancialMontage_Blue.mp4 -frames:v 1 -y /tmp/f.png
# then sample a horizontal scanline through the smoothest background region
# and a second through the halo around a bright glowing element
```

Values must change smoothly. Stepped plateaus are a failure — raise the grain
toward 2.5%, then lower CRF toward 14. Check look 1A and look 5 first (dark
navy under bright glow), then look 4 — pale grey ramps band too.

---

## Resolution scaling

Everything is authored in "design px" against a 3840×2160 canvas. Charts and
backgrounds are SVG with `viewBox="0 0 3840 2160"`, so they scale exactly.
Anything that has to be a CSS pixel goes through `useScale()`
(`src/lib/layout.ts`), which returns `width / 3840`.

This is why a composition rendered at 1920 wide is a pure scale of the 4K one:
same layout, same *proportional* text size, same stroke weight. A 2 design-px
panel border is 2px at 4K and 1px at 1080p, which is what it should be. A
dashboard laid out in fixed pixels fails this, and dashboards fail it far more
often than abstract scenes do.

---

## Text

Every label is a neutral placeholder and every number is a plain figure:
`Example 1`, `Metric A`, `Series 1`, `Category A`–`Category D`, `Q1`–`Q4`,
`Week 18`–`Week 24`, `Jan`–`Dec`, `Item 1`–`Item 6`.

- **No currency symbols anywhere** — a `$` locks the clip to one market.
- No real company, product, person or brand names, no ticker symbols, no logos.
- No cloned interface. Look 4 is in the same *category* as a project tracker
  but its layout, spacing and colour are its own.

Labels are kept short so a buyer can replace them in After Effects without
reflowing anything.

### Fonts

Both families are **SIL Open Font License 1.1**, shipped in `public/fonts/` and
free to embed and redistribute. No system fonts are used, so the render is
identical on any machine, and nothing is fetched at render time.

| Family | Use | Licence |
|---|---|---|
| **Inter** (300/400/500/600/700) | UI labels | SIL OFL 1.1 — `public/fonts/Inter-OFL.txt` |
| **JetBrains Mono** (400/500/700) | numbers, code and log blocks, tabular figures | SIL OFL 1.1 — `public/fonts/JetBrainsMono-OFL.txt` |

`font-variant-numeric: tabular-nums` is set everywhere a number changes over
time, or the digits shift horizontally as they count.

---

## Changing the data and the labels

**Data.** Every series is declared in one place per look:

- Look 2 — `src/looks/BarChart.tsx`, the `BAR_SERIES` / `LINE_SERIES`
  constants at the top and `N` (the series length).
- Look 3 — `src/looks/dashboardData.ts`, which holds every series for both
  dark dashboards plus `N3`, the shared cycle length.
- Look 4 — `src/looks/LightDashboard.tsx`: `DONUT_VALS`, `GANTT`, `COLS`,
  `S_STAT_A/B`.
- Look 5 — the `buildLayer()` calls in `src/looks/FinancialMontage.tsx`.

`seededSeries(seed, n, freqs, amps)` takes **integer** frequencies. Change the
seed to reshuffle, change `freqs`/`amps` to change the character — more
high-frequency amplitude means spikier data. **If you add a non-integer
frequency the loop stops closing**, so keep them whole.

**Labels.** Look 3's strings are inline in `src/looks/DarkDashboard.tsx`
(`Example 1`, the `MONTHS3` array) with the log lines in
`CODE_ROWS` in `dashboardData.ts`. Look 4's are the `CATS` and `WEEKS` arrays
and the three stat-card captions at the top of `LightDashboard.tsx`. Look 2's
month row is the `MONTHS` array in `BarChart.tsx`.

**Colourways.** Each look exports its themes as plain objects —
`CYAN_THEME`/`AMBER_THEME`, `TEAL_THEME`/`BLUE_THEME`,
`WARM_THEME`/`SLATE_THEME`. Add a third colourway by adding an object and one
more `<Composition>` in `src/Root.tsx`.

---

## Project layout

```
src/
  Root.tsx                  all nine <Composition> registrations
  lib/
    random.ts               mulberry32 + seeded helpers
    series.ts               periodic series, scrolling window
    loop.ts                 LOOP_FRAMES / ONESHOT_FRAMES
    glow.tsx                stacked SVG neon filters
    grain.tsx               deterministic tiled grain + dither
    fonts.ts                OFL font loading, tabular-figure style
    layout.ts               design-px -> composition-px scale
    geom.ts                 polylines, arcs, closed splines, smooth paths
  looks/
    GrowthLineNavy.tsx  GrowthLineBlack.tsx  growthLineData.ts
    BarChart.tsx
    DarkDashboard.tsx   dashboardData.ts
    LightDashboard.tsx
    FinancialMontage.tsx
public/fonts/               Inter + JetBrains Mono woff2 and their licences
```

## Getting started

```bash
npm install
npx remotion studio
```
