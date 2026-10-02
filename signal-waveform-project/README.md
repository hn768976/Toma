# Signal & Waveform Screens (Remotion, 2D)

Three flat screen graphics built around glowing waveforms. Everything is
React + SVG, so there's no WebGL and no `@remotion/three`. Every composition is defined at
**3840×2160, 30 fps**.

| Composition ID       | Look                 | Frames | Length | Loops? |
|----------------------|----------------------|--------|--------|--------|
| `SignalReadout`      | Signal Readout       | 600    | 20 s   | **yes**, seamless |
| `BreakingNewsOpener` | Breaking News Opener | 450    | 15 s   | **NO** |
| `AudioEditor`        | Audio Editor         | 600    | 20 s   | **yes**, seamless |

> **Look 2 (`BreakingNewsOpener`) does NOT loop.** It is a one-way opener: the
> title is revealed in frames 20–70 and then holds until frame 450. The long
> hold is deliberate, so trim it to fit. Don't list or keyword it as a loop.

## Quick start

```bash
npm install
npx remotion studio          # opens the Studio with all three compositions
```

Node 18+ is required. Versions are pinned in `package.json` and `package-lock.json`.

## Render at 4K

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16 and lossless PNG
intermediate frames. `--muted` skips the (empty) audio track.

```bash
npx remotion render src/index.ts SignalReadout      out/SignalReadout-4K.mp4      --muted
npx remotion render src/index.ts BreakingNewsOpener out/BreakingNewsOpener-4K.mp4 --muted
npx remotion render src/index.ts AudioEditor        out/AudioEditor-4K.mp4        --muted
```

1080p preview, as delivered: add `--scale=0.5`.

## Stills (6000×3375)

3840 × 1.5625 = 6000, so the still command uses `--scale=1.5625`:

```bash
npx remotion still src/index.ts SignalReadout out/stills/SignalReadout-f0090.png --frame=90 --scale=1.5625
```

The delivered stills were taken at these frames:

| Composition | Frames |
|---|---|
| SignalReadout | 90, 290, 490 |
| BreakingNewsOpener | 120, 270, 420 (all after the title is fully revealed, no streak) |
| AudioEditor | 60, 260, 460 |

Grain stays in the stills.

## Render time

Measured on a 4-core cloud Linux container (Chromium headless shell, software
GL, 15 GB RAM), default concurrency. Per-frame cost = (90-frame render − 1-frame
render) ÷ 89, so Remotion's ~6 s start-up and bundling are excluded.

| Composition | 1080p (`--scale=0.5`) | 4K | Full 4K render (estimate) |
|---|---|---|---|
| SignalReadout | 0.95 s/frame | 4.0 s/frame | ≈ 40 min (600 frames) |
| BreakingNewsOpener | 0.72 s/frame | 2.7 s/frame | ≈ 20 min (450 frames) |
| AudioEditor | 0.79 s/frame | 2.9 s/frame | ≈ 30 min (600 frames) |

The full 1080p preview renders took 534 s, 345 s and 507 s including encoding.
4K costs about 3.8–4.3× the 1080p time, in line with 4× the pixels. The stacked
glow filters are the main per-frame cost (about 60% of it in SignalReadout). A
desktop with more cores scales roughly linearly: try `--concurrency=8` on an
8-core machine.

## Changing the title text and the colours

### Look 2: title and colours are composition props

In Remotion Studio, select `BreakingNewsOpener` and edit the props panel on the
right. On the command line, pass `--props`:

```bash
npx remotion render src/index.ts BreakingNewsOpener out/opener.mp4 --muted \
  --props='{"titleTop":"SPECIAL","titleBottom":"REPORT","accentColor":"#1e7bff","streakColor":"#22aaff"}'
```

| Prop | What it colours |
|---|---|
| `titleTop`, `titleBottom` | The two title words (upper word is centred, lower word sits right of the chevrons) |
| `titleColor` | Face of the title lettering |
| `accentColor` | Red rule, chevrons, digit-bar tint, one gauge arc |
| `streakColor` | Light streak (its centre always blows out to white) |
| `gridColor` | Fine grid and horizontal light lines |
| `waveColorA`, `waveColorB` | The two dense waveform traces |
| `gaugeColor`, `gaugeAccent` | Gauges |
| `levelColor` | Stacked level bars |
| `digitColor` | Rolling digits in the top bar |

To change the defaults permanently, edit `src/breaking-news/theme.ts`. Long
words: the title size is set by `TITLE.size` in
`src/breaking-news/BreakingNewsOpener.tsx`.

### Looks 1 and 3: colour palettes

- Look 1: `src/signal-readout/theme.ts` (`SIGNAL_COLORS`)
- Look 3: `src/audio-editor/theme.ts` (`AUDIO_COLORS`)
- Look 3 labels (`WAV_01`, `LEVEL_L_R`, `EQ_SET` …) are placeholders in
  `src/audio-editor/AudioEditor.tsx`.

## How it's built

- **One design space.** Each look draws into an SVG whose `viewBox` is
  1920×1080 and whose pixel size comes from `useVideoConfig()`. Every position, font size,
  blur radius and **line width** is therefore a fixed fraction of the frame.
  A 1-unit line is 1 px at 1080p and 2 px at 4K.
- **Waveforms are generated, not drawn by hand** (`src/lib/waveform.ts`), once at module load
  from a seeded `mulberry32`: base jitter + swells + burst packets + spikes.
  For the loops, each trace is a closed ring of `N` samples. The sines have whole
  cycles in `N`, and bursts and spikes are placed by circular distance so they wrap.
  Each trace scrolls by exactly `N` samples over 600 frames.
- **Glow** (`src/lib/Glow.tsx`): three Gaussian blurs at 1 : 4 : 12, each fainter,
  merged under the untouched source so cores stay thin and crisp.
- **Grain** (`src/lib/Grain.tsx`): `feTurbulence` with an integer seed from the
  frame (`frame % 600` on the loops). It's drawn last, after every glow, at about ±2 %.
- **Determinism.** No `Math.random()`, `Date.now()`, CSS animations/transitions,
  `requestAnimationFrame` or state. Every schedule (digits, rolls, LEDs, EQ
  bounces, bokeh, gauge blips) is built at module level from seeded RNGs and
  looked up by frame number.
- **Icons, dials and buttons** are SVG paths written in this project. No icon library is used.

## QA switches (verification only)

`--props='{"loopCheck":true}'` makes the two loops 601 frames long, so frame
600 can be rendered and compared with frame 0.
`--props='{"qaOff":["grain","glow"]}'` turns off groups for isolation and
profiling. Groups: `grain`, `glow`, `waveforms`, `digits`, `haze` (look 3:
bokeh), `faders`, `indicators`, `leds`; look 2 also has `top`, `zone`, `wave`,
`title`, `gauges`, `levels`.

## Verification (completion checklist)

All checks were run on the delivered build. ✅ = passed.

- ✅ **Files:** all three previews are 1920×1080, `30/1`, h264, `yuv420p`, no audio
  stream. Durations: 20.000 s, 15.000 s, 20.000 s.
- ✅ **Text and asset audit (read at 4K):** the title reads exactly `BREAKING NEWS`. The only
  other text is placeholder labels (`LEVEL_L_R`, `DOTS_INF`, `EQ_SET`, `MIX_BUS`,
  `CTRL_SET`, `WAV_01`–`WAV_04`) and random digits. There are no names or logos. All icons, dials and
  buttons are SVG paths in `src/`, and `package.json` has no icon library.
- ✅ **Loops:** with `loopCheck` on, frame 600 is **byte-identical** to frame 0 for
  `SignalReadout` and `AudioEditor`. `BreakingNewsOpener` is deliberately *not* a loop.
- ✅ **Determinism:**
  - Frame 300 rendered alone from a cold start is **byte-identical** to frame 300 of a
    full multi-threaded PNG-sequence render, for all three compositions. Also checked
    on frames 13, 35 and 60 of the opener.
  - Stress test: the same 60 frames rendered twice *at the same time* (CPU contention, out-of-order
    scheduling) gave 0/60 differing frames for each composition.
  - No `Math.random`, `Date.now`, CSS `@keyframes`, transitions,
    `requestAnimationFrame` or React state anywhere in `src/`.
- ✅ **1080p vs 4K:** frame 300 rendered at 4K and scaled to 1080p matches the 1080p
  render (mean difference ≈ 2/255, mostly grain; bright-core overlap 0.94–0.97; lit area
  ratio 1.00–1.08). Lines keep their relative thickness, and digits and labels take the
  same share of the frame. The layout is identical.
- ✅ **Banding:** frame 300 was pulled from the *encoded* SignalReadout mp4 and read along
  a vertical line (x=1500) through the haze, between grid lines. Blue falls smoothly
  from about 65 to 38 with no plateaus; the longest run of identical values is 4 px
  (grain-level). The only jumps are the deliberate rule lines at y≈530/550.
- ✅ **Content (5 frames each):**
  - Look 1: two bands with four overlapping traces each, noise and swells, digits
    changing with dim groups, traces moving.
  - Look 2: no title at frame 0; the streak crosses the title zone in frames 20–50 and is
    gone from frame 50; full title, rule and three chevrons after frame 70; the radar
    rotates; top digits mid-roll in some frames and settled in others.
  - Look 3: four different labelled waveforms with burst packets; faders, EQ indicators and
    LEDs change between frames.

### Determinism notes (for anyone editing the code)

Chrome can rasterise some things slightly differently from render to render,
depending on scheduling. To keep frames byte-identical, this project:

- draws circles and ellipses as polygon paths (`src/lib/shapes.tsx`) and
  regenerates static curved shapes every frame (the `phase` prop and a tiny radius nudge).
  Chrome otherwise re-uses cached rasters of unchanged native circles and arcs,
  which shifted their anti-aliasing by up to 40 levels between renders.
- avoids `mix-blend-mode` and filters sized to their own bounding box on
  moving content, and clips the light streak to the frame.
- draws bokeh as gradient discs instead of passing it through a blur filter.

Keep to these rules when adding new elements.

## Fonts and licences

All three fonts are in `public/fonts/` and are loaded locally. Nothing is fetched at
render time.

| Font | File | Used for | Licence |
|---|---|---|---|
| **DSEG7 Classic** Bold, © 2017 keshikan | `DSEG7Classic-Bold.woff2` | Seven-segment readouts (look 1) | SIL Open Font License 1.1, `public/fonts/OFL-DSEG.txt` |
| **Cinzel** Bold, © 2020 The Cinzel Project Authors | `Cinzel-Bold.woff2` | `BREAKING NEWS` title and rolling digits (look 2) | SIL Open Font License 1.1, `public/fonts/OFL-Cinzel.txt` |
| **Inter** Medium, © 2016 The Inter Project Authors | `Inter-Medium.woff2` | Small interface labels (look 3) | SIL Open Font License 1.1, `public/fonts/OFL-Inter.txt` |

The OFL lets you bundle, embed and redistribute the fonts with this project. They can't
be sold on their own, and the licence files have to travel with them.

## Content notes

- No real network, channel, product or software names, and no logos. All labels
  are placeholders.
- `BREAKING NEWS` is a generic phrase. The opener does not copy any real channel's
  colours or graphics package.
- Left out on purpose: the reference opener's white flash with 3D letters flying
  past the camera (a separate 3D transition).
