# Halftone Dots — motion background

A recreation of the supplied reference clip *"halftone dots motion background —
retro / vintage pattern animation"*: a static square lattice of dots on a flat
background, where only the **dot radii** animate, driven by a soft field of
drifting lights.

## Deliverable specs

| | |
| --- | --- |
| Master resolution | 3840 × 2160 (UHD 4K) |
| Delivery resolution | 1920 × 1080 |
| Frame rate | 30 fps |
| Duration | 450 frames = **15.000 s** (reference: 15.015 s) |
| Codec / container | H.264 / MP4, `yuv420p` |
| Loop | seamless — frame 449 hands back to frame 0 |

## Compositions

| Composition ID | Size | Look |
| --- | --- | --- |
| `HalftoneDots4K` | 3840 × 2160 | Variant A — white dots on black (matches the reference) |
| `HalftoneDotsBlue4K` | 3840 × 2160 | Variant B — dark blue |
| `HalftoneDots1080` | 1920 × 1080 | Variant A, delivery size |
| `HalftoneDotsBlue1080` | 1920 × 1080 | Variant B, delivery size |

The 4K and 1080p compositions render the **same picture**: the lattice pitch is
derived from the frame height (`height / 48`), so nothing is hard-coded in
pixels and the two sizes are exact scalings of each other.

## Rendering

```console
npm i

# 4K masters
npm run render:halftone-mono-4k
npm run render:halftone-blue-4k

# 1080p deliveries
npm run render:halftone-mono-1080
npm run render:halftone-blue-1080
```

Or interactively:

```console
npm run dev
```

## How it was matched to the reference

The reference clip was measured rather than eyeballed:

* **Lattice pitch** — a Fourier fit of the row/column brightness profile gives a
  period of 10.51 px on the 898 px-wide reference, i.e. exactly **48 rows** down
  the frame. Fitting the same period on frames across the clip shows the phase
  never moves: the lattice is completely static, only the radii change.
* **Dot size range** — per-cell ink coverage converts to a radius of
  `0.04 … 0.39 × pitch`; the largest dots reach ~0.78 × pitch across, so they
  nearly touch but never merge. That is the `RADIUS_MIN` / `RADIUS_MAX` range in
  `src/halftone/constants.ts`.
* **Field response** — the distribution of dot sizes over the whole clip was
  reduced to percentiles, and the logistic in `src/halftone/field.ts`
  (`RESPONSE_GAIN`, `RESPONSE_MIDPOINT`) was least-squares fitted to them. A
  logistic rather than a clamp is what keeps the bright areas from flattening
  into a solid slab of max-size dots, which is how the reference behaves.
* **Motion** — cross-correlating the extracted field across frames shows the
  reference loops with a period of ~12.17 s. Ours loops over the full 450-frame
  duration instead, so the delivered 15 s clip is itself a seamless loop.

## Source layout

```
src/halftone/
  constants.ts      grid, timing, dot-size range, the two palettes
  field.ts          the looping scalar field that drives the dot radii
  HalftoneDots.tsx  the composition component
```

### Re-skinning

Both palettes live in `src/halftone/constants.ts`:

```ts
export const PALETTE_MONO = { background: "#000000", dot: "#FFFFFF" };
export const PALETTE_BLUE = { background: "#04101F", dot: "#3D9BF5" };
```

Change those two lines to re-colour a variant — nothing else depends on them.

### Re-timing

`DURATION_IN_FRAMES` in `src/halftone/constants.ts` is the loop length as well
as the clip length. Because every time-varying term in `field.ts` uses a whole
number of turns per loop, any duration stays seamlessly loopable.
