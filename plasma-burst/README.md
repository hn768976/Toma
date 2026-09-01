# Plasma Burst

A single four-second plasma discharge, rendered to a 2D canvas with Remotion.
It opens on black, strikes, writhes, decays to glow, and ends on black.

## The composition

| | |
|---|---|
| Composition id | `PlasmaBurst` |
| Resolution | **4K — 3840 × 2160** |
| Duration | 120 frames |
| Frame rate | 30 fps |
| Length | 4.0 seconds |
| Loops? | **No.** This is a one-shot event. Frames 0 and 120 are both black, but the piece does not loop — playing it end-to-end repeatedly will read as a repeated strike, not a cycle. |

## Rendering

Render at full 4K:

```bash
npx remotion render PlasmaBurst out/plasma-burst.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

A 1080p preview (half scale, so the 4K canvas is supersampled down):

```bash
npx remotion render PlasmaBurst out/plasma-burst-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

> `--concurrency` must not exceed your CPU core count; lower it if Remotion
> refuses to start.

Open the studio to scrub:

```bash
npm install
npm run dev
```

## How it is put together

Every pixel is a pure function of `useCurrentFrame()`. There is no
`Date.now()`, no `requestAnimationFrame`, no CSS animation and no component
state, and all randomness goes through Remotion's `random()` with stable
seeds — so `npx remotion render` is deterministic no matter how frames are
distributed across workers.

Each layer owns a hidden `<canvas>` and draws itself once per React render in a
layout effect. React runs child layout effects before the parent's, so by the
time the composition composites, all four layers are already drawn for the
current frame.

```
src/plasma/
  config.ts       every tunable number: discharge count, recursion depth,
                  bloom strength, cloud density, and the intensity curve
  theme.ts        THEME — every colour in the piece; nothing else has a hex
  intensity.ts    the intensity curve and everything derived from it
  geometry.ts     the recursive filament web, memoised by seed index
  bloom.ts        bright-pass and two-radius bloom
  grain.ts        tiled film grain
  layers/
    PlasmaCloud.tsx     the soft volumetric cloud
    DischargeLayer.tsx  the filament web, four composited passes
    CoreFlash.tsx       the blown-out white centre
    SparkLayer.tsx      the ejected sparks
  PlasmaBurst.tsx composites the layers, applies bloom and grain
```

### The filaments

Recursive midpoint displacement — the lightning algorithm, tuned to a different
character. Displacement is low and the displaced polyline is drawn as chained
quadratics, so filaments curl rather than zigzag; branch probability is high, so
the result is a tangled web rather than a channel with a few forks; some
filaments run along a curled spine and loop back on themselves; and only some
start at the core, the rest starting partway out on other filaments, so the web
has no single obvious source.

Each filament is drawn in four passes composited with `lighter`: a wide
atmospheric glow, an outer glow, a mid channel, and a thin near-white core. The
thin core inside a wide soft glow is the whole effect.

### The intensity curve

One 0–1 value drives filament count, brightness, cloud density and bloom
together.

| Frames | |
|---|---|
| 0–8 | Black. The emptiness is what makes the strike land. |
| 8–14 | Ignition. 0 → 1 in six frames on a hard ease-out; over half the rise is in the first frame. |
| 14–30 | Peak. Holds near 1 but flickers between 0.75 and 1.0, and the filament geometry re-seeds every 2–3 frames, so the web writhes. |
| 30–70 | Decay. 1 → 0.25 on a long ease-out. Filaments thin faster than the cloud, so the frame becomes glow without structure. |
| 70–110 | Afterglow. 0.25 → 0.02, cloud only, with a few isolated filaments flickering back for 2–3 frames at a time. |
| 110–120 | Black. |

### Performance

The re-seeding at peak is the expensive part, so each re-seeded web is generated
once when it fires, memoised by seed index, and reused for its whole 2–3 frame
life. Filament paths are built as `Path2D` objects so the four passes re-stroke
one object rather than rebuilding geometry.

The cloud is computed at 1/8 resolution, the wide filament glows at 1/2 and 1/4,
and bloom at 1/4, each blurred in that reduced space before being upscaled with
`imageSmoothingQuality: 'high'`. These are all pure low-frequency gradient, so
nothing is lost, and it is a large fraction of what makes a 4K render
affordable.

### Variants

There is one: `blue`. The `variant` prop selects a palette from `THEME`, and
adding another is a matter of adding a key there — but this piece is a single
four-second event with no internal structure to vary, so it ships as one.
