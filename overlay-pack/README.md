# Hearts, Spinner, Waveform, Idea Bulb, Daisies: overlay pack

Eight 2D overlay loops in one Remotion project. Everything is drawn in code on Canvas 2D. The bulb also uses
perfect-freehand and Rough.js (both MIT). All compositions are 3840×2160 at 30 fps.

| Composition ID         | Output file                | Background | Length |
|------------------------|----------------------------|------------|--------|
| `FloatingHearts-Black` | `FloatingHearts_Black.mp4` | black      | 20 s   |
| `FloatingHearts-Green` | `FloatingHearts_Green.mp4` | `#00FF00`  | 20 s   |
| `Spinner-Segments`     | `Spinner_Segments.mp4`     | `#00FF00`  | 10 s   |
| `Spinner-Dots`         | `Spinner_Dots.mp4`         | `#00FF00`  | 10 s   |
| `Waveform-Bars`        | `Waveform_Bars.mp4`        | `#00FF00`  | 20 s   |
| `Waveform-Line`        | `Waveform_Line.mp4`        | `#00FF00`  | 20 s   |
| `IdeaBulb-Chalk`       | `IdeaBulb_Chalk.mp4`       | `#00FF00`  | 10 s   |
| `FallingDaisies`       | `FallingDaisies.mp4`       | `#00FF00`  | 20 s   |

Remotion composition IDs can't contain `_`, so the IDs use `-`. The render commands below write files with the
`_` names.

## Setup

```bash
npm ci          # Node 18+; versions are pinned in package.json / package-lock.json
npm run dev     # Remotion Studio
```

## Render at 4K

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG frames and no audio.

```bash
npx remotion render FloatingHearts-Black out/FloatingHearts_Black.mp4
npx remotion render FloatingHearts-Green out/FloatingHearts_Green.mp4
npx remotion render Spinner-Segments     out/Spinner_Segments.mp4
npx remotion render Spinner-Dots         out/Spinner_Dots.mp4
npx remotion render Waveform-Bars        out/Waveform_Bars.mp4
npx remotion render Waveform-Line        out/Waveform_Line.mp4
npx remotion render IdeaBulb-Chalk       out/IdeaBulb_Chalk.mp4
npx remotion render FallingDaisies       out/FallingDaisies.mp4
```

For a 720p preview, add `--scale=0.3333333333333333` (gives 1280×720). The canvas allocates its backing store at
the output size, so a scaled render draws directly at 720p rather than shrinking a 4K image.

## Keying

- **Green clips:** the background is exactly `#00FF00`, with no grain, vignette or shadow. Key it with any chroma
  keyer (Ultra Key, Keylight, `chromakey=0x00FF00`). Nothing in the elements is green: daisies have no stems or
  leaves, and the hearts are pink and red.
- **Black clip (hearts):** the background is exactly `(0,0,0)`. Set the layer's blend mode to **Screen** (or Add);
  no key is needed.
- **Edges:** a key-safe compositing pass (`src/lib/CanvasStage.tsx`) tightens soft edges, glows and blur to about
  1 px before they meet the green, so nothing tints the background. Dimmed parts (spinner trail, resting dots) are
  drawn as opaque greys instead of translucent white, and green hearts shrink out instead of fading. A translucent
  element on green is a green mix, which a tight key either removes or leaves tinted.
- **Spill:** H.264 `yuv420p` stores colour at half resolution, so a hard edge picks up about 1 px of green chroma
  however clean the source is. With ffmpeg, follow the key with `despill`:
  `chromakey=0x00FF00:0.12:0.05,despill=type=green`. In an NLE, turn on spill suppression.

## Customising: `src/config.ts`

Each look has one data row. Sizes are fractions of frame height (H) or width (W), so they hold at any resolution.

| Row               | What to change                                                                              |
|-------------------|---------------------------------------------------------------------------------------------|
| `HEARTS`          | `colors`, `density` (hearts on screen at once), `sizeMin`/`sizeMax` (of H)                  |
| `SPINNER_SEGMENTS`| `color`, `bars`, `radius` (ring size, of H), `barLength`, `barWidth`, `stepFrames`          |
| `SPINNER_DOTS`    | `color`, `dots`, `radius` (ring size, of H), `dotRadius`, `revolutions` per 10 s            |
| `WAVEFORM_BARS`   | `color`, `bars`, `span` (of W), `maxHeight` (of H), `barFill` (bar width / pitch)           |
| `WAVEFORM_LINE`   | `color`, `span` (of W), `amplitude` (of H), `lineWidth`, `glow` (px at 4K)                  |
| `IDEA_BULB`       | `color` (chalk), `height` (bulb glass + base, of H)                                         |
| `DAISIES`         | `petal`, `shade`, `centre` colours, daisies per depth layer (`far`, `mid`, `near`)          |

Loop rule: the spinner loops when `300 / stepFrames` is a multiple of `bars` (12 bars → `stepFrames` 1, 5 or 25).

## How it loops and stays deterministic

- Every value is computed from `useCurrentFrame()`. There is no `Math.random()`, `Date.now()` or state: all
  randomness is seeded `mulberry32`.
- **Hearts:** each heart slot repeats on a period that divides 600 (100/120/150/200 frames), with seeded phases.
  Four bursts of 5–8 hearts repeat every 600 frames.
- **Spinners:** whole revolutions in 300 frames (segments: one bar every 5 frames, 5 revolutions; dots: 10).
- **Waveforms:** the speech envelope is layered simplex noise sampled on a circle in time, so frame 600 equals
  frame 0. The line's 3 sines travel a whole number of cycles per loop.
- **Bulb:** 4 boil drawings, each held 3 frames. Every 15 frames, 1–2 seeded rays shorten.
- **Daisies:** every daisy falls through the frame 1–4 whole times per 600 frames. Sway, spin and 3D tilt use
  whole cycles per loop.

## Timings (this machine: 4 vCPU, headless Chromium, software canvas)

720p previews (`--scale=1/3`, concurrency 4). Wall time per frame includes bundling and browser start-up:

| Clip | Wall time (incl. bundle + browser start) | Per frame |
|---|---|---|
| `FloatingHearts_Black` | 23.8 s | 39.6 ms |
| `Spinner_Segments` | 11.8 s | 39.2 ms |
| `Waveform_Bars` | 20.1 s | 33.4 ms |
| `IdeaBulb_Chalk` | 12.3 s | 41.0 ms |
| `FallingDaisies` | 27.3 s | 45.5 ms |
| `FloatingHearts_Green` | 23.4 s | 38.9 ms |
| `Spinner_Dots` | 11.3 s | 37.7 ms |
| `Waveform_Line` | 21.3 s | 35.5 ms |

4K, one frame (`remotion still`, frame 300, including about 2.3 s of browser start-up), plus steady state from a
30-frame sequence at concurrency 1:

| Clip | One 4K still, wall | Steady state per 4K frame (marginal, 30-frame run) |
|---|---|---|
| `FloatingHearts-Green` | 2.26 s | ~280 ms |
| `FallingDaisies` | 2.54 s | ~337 ms |
