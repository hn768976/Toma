# Cloud Icon — 4K Remotion animation

A cloud glyph built from ~2200 particles, held inside a broken segment ring,
over a right-angle circuit-trace backdrop.

| | |
| --- | --- |
| **Composition id** | `CloudIcon` |
| **Resolution** | **4K — 3840 × 2160** |
| **Duration** | 480 frames @ 30 fps = **16.0 s** |
| **Loops?** | **No.** One-shot. It assembles, then holds — frames 0 and 480 differ by design. |
| **Variant prop** | `variant: "blue"` |
| **Audio** | None |

## Render at 4K

```bash
npx remotion render CloudIcon out/cloud-icon.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

Lower `--concurrency` to your CPU core count if Remotion rejects the value.

### 1080p preview

```bash
npx remotion render CloudIcon out/cloud-icon-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--scale` changes the output resolution only. The canvas backing store is
fixed at 3840 × 2160 in every layer, so a preview shows exactly what the 4K
render will, at half the pixels.

## Getting started

```bash
npm install
npm run dev      # Remotion Studio
npm run render   # the 4K render command above
npm run lint     # tsc typecheck
```

## Timeline

| Frames | |
| --- | --- |
| 0 – 40 | Backdrop fades up. Circuit traces draw on, several at once, each stroking along its path. |
| 40 – 90 | Ring segments fade in one at a time, staggered 3 frames apart, going round. |
| 90 – 190 | The cloud assembles — particles converge from a wide scatter, easing out. Edge particles arrive first and interior last, so the silhouette resolves before it fills. |
| 190 – 480 | Idle. The cloud breathes (±1% on a 120-frame sine), particles twinkle on seeded sines, the ring rotates and pulses, circuit pads blink, a handful of particles drift free and return. |

## How it is built

```
src/
  Root.tsx              composition registration
  CloudIcon.tsx         layer stack + background wash
  config.ts             all counts, sizes and timings
  theme.ts              THEME — every colour in the piece
  cloudShape.ts         the silhouette, used only as a sampling mask
  components/
    CloudParticles.tsx  the cloud
    SegmentRing.tsx     the ring
    CircuitBackdrop.tsx binds the shared backdrop to this palette
    StarField.tsx       binds the shared star field to this palette
    PostFx.tsx          vignette + grain
  lib/                  vendored from the shared remotion-lib (see below)
scripts/
  sync-lib.mjs          re-vendors src/lib from the shared library
```

**Determinism.** Every layer is a `<canvas>` drawn once per React render from
`useCurrentFrame()` alone. There is no `requestAnimationFrame`, no
`Date.now()`, no CSS animation and no component state, and all randomness goes
through Remotion's `random()` with stable string seeds. Any frame can be
rendered on its own, out of order, and comes out identical — which is what
makes `npx remotion render` reproducible across workers.

**Colour.** Every colour lives in the `THEME` object in `src/theme.ts`, keyed
by `variant`. There is no hex literal anywhere else in `src/`.

**Sizing.** `GLYPH_SCALE` in `src/config.ts` is the single knob for how large
the cloud and ring are within the frame. Lobe geometry, ring radius and stroke
weight, particle size, the edge-falloff distance, bloom radii and drift
amplitude all derive from it, and the baseline is recomputed so the glyph stays
optically centred at any value. It deliberately does not touch the circuit
field or star field, which stay at frame scale — that is what makes a lower
value read as a smaller icon rather than as a zoomed-out image. `RING
.diameterFactor` sets the ring's size relative to the cloud independently.

**The cloud.** Three overlapping lobes of different radii sit at three
different heights on a shared baseline, joined by a slab and cut flat along the
bottom. That shape is filled to an offscreen canvas once, a chamfer distance
field is built over it, and particle positions are rejection-sampled with an
acceptance probability that falls off from the boundary inward — dense along
the edge, sparse through the middle. No particle is placed by hand. About 4%
sit just outside the silhouette, drifting free.

**Performance.** The particle set is sampled once in `useMemo`; resampling per
frame would make the cloud boil. The circuit field is rendered once to an
offscreen canvas and blitted thereafter, with only the blinking pads redrawn.
Bloom blurs a downscaled scratch buffer rather than the full 4K layer.

## Shared library

`src/lib/` is a machine-maintained mirror of the shared `remotion-lib`, not a
hand-edited copy — vendoring is what keeps this project standalone. Edit the
library, then:

```bash
node scripts/sync-lib.mjs          # library -> src/lib
node scripts/sync-lib.mjs --check  # fail if they have drifted apart
```

The library is looked for at `../remotion-lib/src`, then
`~/projects/remotion-lib/src`. If neither exists the sync script is simply
unavailable; `src/lib/` still contains everything this project needs, so the
build and render are unaffected.
