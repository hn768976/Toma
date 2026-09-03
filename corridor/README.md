# Perspective Corridor — 4K background loops

Three 4K background animations built on **one** shared perspective engine.
2D canvas only: no 3D, no Three.js, no WebGL.

| Composition      | Look                                   | Horizon | Open band                                   |
| ---------------- | -------------------------------------- | ------- | ------------------------------------------- |
| `CorridorFibre`  | light strands rising into a wall       | 40%     | 10% of frame height, centred on the horizon |
| `CorridorSlab`   | flat panel corridor, wide open middle  | 50%     | 26% of frame height, centred on the horizon |
| `CorridorBlock`  | glowing block city, binary columns     | 58%     | 12% of frame height, just above the horizon |

All three: **3840 × 2160**, **375 frames @ 30 fps (12.5 s)**, seamless loop,
silent, no text beyond the illegible fragments a variant specifies.

## Render

```bash
npm install
npx remotion studio                       # preview

npx remotion render CorridorFibre out/corridor-fibre.mp4 --codec=h264 --crf=12 --concurrency=8
npx remotion render CorridorSlab  out/corridor-slab.mp4  --codec=h264 --crf=12 --concurrency=8
npx remotion render CorridorBlock out/corridor-block.mp4 --codec=h264 --crf=12 --concurrency=8
```

Add `--scale=0.5` for a 1080p preview. `--concurrency` must not exceed the
machine's CPU core count.

## How it is built

`src/variants.ts` is the single source of colour and configuration — **every
hex literal in the project lives in that file**. It holds, per variant, the
palette, the element type, the element density, the horizon height and the
open-band setting.

`<PerspectiveCorridor>` is the shared engine. It is a *faked* corridor: no
camera, no projection matrix. A horizon line sits at the variant's height with
a vanishing point on it; elements live on a floor plane and a ceiling plane and
carry a depth `d` in (0, 1], where d→0 is the horizon and d→1 is the camera.
Everything else derives from `d`:

- **y** interpolates from the horizon to the plane edge on a *squared* curve.
  That square is what produces perspective compression — elements bunch near
  the horizon and spread near the camera. A linear ramp reads as a flat ramp.
- **x** spreads outward from the vanishing point in proportion to `d`, so lanes
  diverge as they approach.
- **scale** is proportional to `d`; **speed** falls out of the y curve
  (dy/dd = 2d), so near elements travel much faster.
- **opacity** fades in off the horizon and back to zero at the near edge, so the
  recycle from d=1 to d=0 is invisible.
- **blur** is sharp in a mid band and blurred at both extremes, via three
  offscreen buffers bucketed by depth and blurred once each. Max blur is 26px
  at 4K on the nearest elements. Per-element blurring is unusably slow at 4K.

**The engine takes the element renderer as a parameter.** Each variant supplies
different children — `<FibreStrand>`, `<SlabPanel>` + `<CorridorEdgeLines>`,
`<BlockCluster>` + `<BinaryColumn>` — and the engine never knows what it is
drawing. That is the whole reason there are three videos here and not three
projects.

`<HorizonGlow>`, `<BokehLayer>` and `<FinishPass>` (bloom → 22% vignette → 4%
grain) are shared by all three unchanged.

## Determinism

Every frame is a pure function of the frame number. No `Date.now()`, no
`requestAnimationFrame`, no CSS animation, no component state. All randomness
goes through Remotion's `random()` with stable string seeds, never
`Math.random()`, so the element layout is identical on every render and
`npx remotion render` is deterministic across out-of-order parallel workers.

The element set is generated once (`useMemo`, seeded) with each element's lane,
depth phase and seed; per frame only the depth and its derivatives are
computed. Drawing happens once per React render into a single canvas whose
backing store is 3840 × 2160.

Every traversal completes a whole number of cycles in 375 frames, and every
pulse and drift period closes. Verified: **frame 0 and frame 375 are pixel
identical** for all three compositions.

## Shared library

`src/lib/` and five of the components in `src/components/` are vendored copies
of `~/projects/remotion-lib`, so this project is standalone. See
`src/lib/VENDORED.md` for exactly which files, and the library's `CATALOG.md`
for what each one does.
