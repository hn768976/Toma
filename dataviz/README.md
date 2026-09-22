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
