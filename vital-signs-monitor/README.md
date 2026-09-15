# Vital Signs Monitor — Remotion

A recreation of a hospital vital-signs monitor macro shot, built as a Remotion
project. Authored at **4K**, with matching 1080p compositions.

Two colour variants:

| Composition | Size | ECG trace | HR number | Secondary readout |
|---|---|---|---|---|
| `VitalSigns-Teal-4K` | 3840×2160 | teal | teal | teal |
| `VitalSigns-Red-4K` | 3840×2160 | **red** | **red** | teal |
| `VitalSigns-Teal-1080` | 1920×1080 | teal | teal | teal |
| `VitalSigns-Red-1080` | 1920×1080 | **red** | **red** | teal |

All four are **30 fps, 510 frames — exactly 17.000 s**, matching the reference clip.

## Quick start

```bash
npm install
npm run dev          # opens Remotion Studio
```

## Rendering

```bash
npm run render:teal:4k     # out/vital-signs-teal-4k.mp4
npm run render:red:4k      # out/vital-signs-red-4k.mp4
npm run render:teal:1080   # out/vital-signs-teal-1080p.mp4
npm run render:red:1080    # out/vital-signs-red-1080p.mp4
```

Or directly:

```bash
npx remotion render VitalSigns-Red-4K out/red-4k.mp4
```

Output is H.264 / MP4 / yuv420p at CRF 16 (see `remotion.config.ts`). For a
near-lossless 4K master, add `--crf 12`; for a ProRes intermediate use
`--codec prores --prores-profile 4444`.

> **Note on Chromium.** Remotion downloads its own headless Chromium on first
> render. If your environment blocks that download, point it at a local build:
> `--browser-executable=/path/to/chrome`.

## How it is built

Everything is authored in a single **1920×1080 "design space"** (`src/constants.ts`)
and scaled by `width / DESIGN_W` at render time, so the 4K and 1080p
compositions are identical apart from resolution — no duplicated layout, and
blur radii, stroke widths and the scanline pitch all scale with the frame.

| File | Role |
|---|---|
| `src/constants.ts` | All geometry, timing and blur values, measured off the reference |
| `src/theme.ts` | The two palettes (`TEAL`, `RED`) |
| `src/ecg.ts` | PQRST waveform maths and the SVG path sampler |
| `src/readings.ts` | Frame-driven HR and secondary-value schedules |
| `src/components/EcgTrace.tsx` | The sweeping trace, eraser gap and depth-of-field banding |
| `src/components/Readouts.tsx` | Digits, grey block and marker squares |
| `src/components/ScreenFx.tsx` | LCD scanlines, subpixel comb, vignette |
| `src/Monitor.tsx` | Camera drift, perspective, bloom, composition assembly |

### The sweep

The trace is **not** scrolling. A cursor moves left→right across the band,
drawing new signal behind it and pushing a blank eraser gap ahead of it,
wrapping every **181 frames** — the cycle measured from the reference, whose
gap wraps on frames 96 / 277 / 458. The waveform is a function of *position*,
not time, so spikes stay anchored to the same pixels as the cursor passes.

Trace opacity ramps with age, so the stretch about to be wiped sits slightly
dimmer than the freshly drawn head.

### Depth of field

The reference is a shallow-focus macro shot. `EcgTrace` renders the trace into
five vertical bands with cross-fading soft-edged masks, each at a blur radius
sampled from a focal plane at `FOCUS_X`. The readouts carry their own fixed
blur values. A defocused copy of the whole panel is screen-blended back over
the original for bloom.

### Tuning

Common adjustments, all in `src/constants.ts`:

- `BEAT_PX` — distance between R spikes (larger = slower-looking rhythm)
- `R_AMPLITUDE` — spike height
- `SWEEP_FRAMES` / `ERASER_PX` — sweep cycle length and eraser gap width
- `BLUR.*`, `FOCUS_X`, `FOCUS_K` — depth of field
- `SCANLINE_PITCH`, `SUBPIXEL_PITCH` — LCD texture

Colours live in `src/theme.ts`; the on-screen numbers in `src/readings.ts`.

## Credits

`public/fonts/BarlowCondensed-Bold.woff2` — Barlow Condensed, SIL Open Font License 1.1.
