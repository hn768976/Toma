# Lab Monitoring Dashboard

A 4K, locked-off "lab monitoring dashboard" animation built in Remotion. Two
versions live in this one project, driven by a single `variant` prop.

| Composition     | Variant  | Look                    | Loops |
| --------------- | -------- | ----------------------- | ----- |
| `LabDashGreen`  | `steady` | Green, normal operation | Yes   |
| `LabDashAlert`  | `alert`  | Amber, destabilising    | No    |

Both are **3840 × 2160**, **600 frames @ 30 fps** (20.0 s).

## Rendering

1080p previews:

```
npx remotion render LabDashGreen out/labdash-steady-preview.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render LabDashAlert out/labdash-alert-preview.mp4  --codec=h264 --crf=18 --scale=0.5
```

Full 4K:

```
npx remotion render LabDashGreen out/labdash-steady.mp4 --codec=h264 --crf=12 --concurrency=8
npx remotion render LabDashAlert out/labdash-alert.mp4  --codec=h264 --crf=12 --concurrency=8
```

## How it is put together

- `src/variants.ts` is the only file holding a colour or a piece of display
  copy. Palette, waveform character, readout behaviour and event schedule all
  hang off one exported `VARIANTS` object keyed by `"steady" | "alert"`.
- `src/LabDashboard.tsx` composes the frame on one offscreen 3840 × 2160
  canvas and blits it to the single visible canvas. Each component draws into
  that shared context in JSX order, so the tree reads bottom-of-stack first.
- Static panel chrome — background, fills, borders, corner ticks, grids and
  fixed labels — is rasterised once in a `useMemo` and copied in with a single
  `drawImage` per frame. Only traces, changing values and blinking elements
  are redrawn.
- The three centre signals are generated once, seeded, each as exactly one
  period. Each translates by exactly one of its own periods across the 600
  frames, so the loop closes and no panel repeats itself on the way there.
  Panel 2's period is three times panel 1's, which is where the speed
  difference comes from.
- Every value is a pure function of `useCurrentFrame()`. No clock, no rAF, no
  CSS animation, and all randomness goes through Remotion's `random()` with
  stable string seeds.

`npx remotion studio` opens both compositions for scrubbing.
