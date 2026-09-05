# Circular HUD Assembly

A 2D circular tech interface that builds from an empty frame into a dense ring
of segments, blocks, arcs and tick marks, then holds while the rings turn.
Everything is SVG, generated programmatically from counts and radii, and
animated from `useCurrentFrame()`.

Two versions ship as separate compositions:

| Composition id     | Version | Look                                          |
| ------------------ | ------- | --------------------------------------------- |
| `V1-HUDRingCyan`   | V1      | White blocks, cyan detail, orange arcs        |
| `V2-HUDRingAlert`  | V2      | Pale amber blocks, deep red arcs, amber detail |

Both are **3840x2160, 30 fps, 300 frames (10s)**. They are not loops — the
assembly builds once and holds.

## Setup

```bash
npm install
npx remotion studio
```

## Render at 4K

Compositions are authored at 3840x2160, so a full-resolution render is just
`--scale=1`:

```bash
npx remotion render V1-HUDRingCyan out/V1_HUDRingCyan.mp4 --scale=1 --crf=16
npx remotion render V2-HUDRingAlert out/V2_HUDRingAlert.mp4 --scale=1 --crf=16
```

Stills (frame 280 is the poster frame, with the assembly complete):

```bash
npx remotion still V1-HUDRingCyan out/V1_HUDRingCyan.png --frame=280 --scale=1
npx remotion still V2-HUDRingAlert out/V2_HUDRingAlert.png --frame=280 --scale=1
```

### 1080p preview

```bash
npx remotion render V1-HUDRingCyan out/V1_HUDRingCyan.mp4 --scale=0.5 --crf=16
```

Codec (h264), pixel format (`yuv420p`) and CRF come from `remotion.config.ts`;
the explicit `--crf=16` above just makes the intent obvious on the command line.
CRF is kept low because the near-black field bands easily once encoded — the
animated grain dithers it, but a high CRF will undo that.

If Chrome is not found on the render machine, either run
`npx remotion browser ensure` or pass `--browser-executable=/path/to/chrome`.

## Structure

```
src/
  Root.tsx                  compositions (V1 and V2)
  hud/
    constants.ts            fps/size/duration, beat table, per-layer spin rates
    palette.ts              the two colour sets
    layout.ts               the whole scene generated from a seed
    geometry.ts             SVG path helpers (arcs, radials, rects)
    timing.ts               stagger / spin / flicker / draw-on helpers
    random.ts               seeded PRNG
    HudRing.tsx             assembles the layers, bloom filter, overlays
    layers/                 one file per group of concentric layers
```

Every dimension in `layout.ts` is a **fraction of the frame height** and is
multiplied by the real height from `useVideoConfig()` at render time, so the
same source is correct at 1080p, 4K, or any other size.

## Props

Each composition takes three props, editable in the Remotion studio sidebar:

- `palette` — `"cyan"` or `"alert"`.
- `seed` — reshuffles the scattered data blocks and corner marks. The
  concentric rings are fixed; only the scatter is seeded.
- `grain` — grain opacity, default `0.02`.

## Build sequence

| Frames  | Beat                                                     |
| ------- | -------------------------------------------------------- |
| 0–20    | Innermost dashed circle sweeps on                         |
| 20–70   | Segment ring arrives element by element                   |
| 60–130  | White blocks light up in sequence around the ring         |
| 100–170 | Orange arcs draw on, each sweeping end to end             |
| 140–210 | Tick ring and scattered data blocks arrive, staggered     |
| 190–250 | Outer broken circle, radial lines and corner marks draw on |
| 250–300 | Complete. Rings turn at their own rates, blocks flicker    |

Timings live in `BEATS` in `src/hud/constants.ts`.
