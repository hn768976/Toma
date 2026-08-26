# DataTunnel — 4K "data tunnel" corridor

A glowing field of data chips flowing through a curved perspective corridor.
Two compositions share one component, one chip set and one corridor geometry;
what separates them is which way the camera is travelling, and their palette.

| Composition | Variant | Palette | Flow |
| --- | --- | --- | --- |
| `DataTunnel` | `violet` | violet | Camera retreats — chips travel up and left along the rows, into the vanishing point. |
| `DataTunnelApproach` | `azureApproach` | azure (dark blue) | Camera advances — chips emerge from the vanishing point and rush down and right, out past the lens. |

Both use the same oblique plane: the vanishing point sits hard against the
**upper-left** edge (9% across, 28% down) and 16 paths fan out right and
down-right across ~131°, from rising-right down to just past vertical. The
wedge starts well above the top-right corner's own bearing from the
vanishing point (about -0.17 rad) so rows pass either side of that corner
instead of it falling outside the topmost row. A directional shadow across
the left of the frame buries the convergence, so the field brightens as it
comes forward instead of the vanishing point reading as a hot spot.

Both are 3840×2160, 450 frames @ 30fps (15.0s), seamless loops, registered in
`src/Root.tsx`.

## Files

| File | Role |
| --- | --- |
| `theme.ts` | **The only file with colour literals.** One `THEMES` entry per palette (`violet`, `azure`). |
| `variants.ts` | Per-variant geometry and depth response: vanishing point, path wedge, direction, easing, near plane, blur ceiling, motion-blur taps. |
| `config.ts` | Everything both variants share: geometry, timing, finish. |
| `geometry.ts` | Seeded path + chip generation and all perspective math. |
| `sprites.ts` | Offscreen sprite atlas — chips are rasterised once, then blitted. |
| `grain.ts` | Pre-baked film-grain tiles. |
| `DataTunnel.tsx` | The per-frame draw pass and the composited layer stack. |

## Depth direction

`cameraDirection` in a variant is the single signed value that decides which
way the field flows:

```ts
violet:        { cameraDirection:  1, ... }  // retreating
azureApproach: { cameraDirection: -1, ... }  // approaching
```

Every depth calculation multiplies by it (`chipDepthU`), and the motion-blur
trail vector is derived from the same term, so the flow, the recycling and
the smear direction all invert together. Nothing anywhere hardcodes a
direction.

## What actually differs between the two

A reversed flow is not a receding flow played backwards, and the rest of
`violetApproach` exists because of that:

- **`depthEase: 0.56`** (v1: `1`). Depth is `zNear · (Z_FAR/zNear)^(u^depthEase)`.
  Below 1, chips linger near the vanishing point and accelerate hard as they
  reach the camera. That does two jobs at once: it packs the far end — which
  an approach needs, since chips *emerge* there rather than accumulating —
  and it gives each chip a steep ease-in on size and speed across its life.
- **`zNear: 1.05`** (v1: `1.35`). Brings the closest chips nearer the lens, so
  the largest ones run past the frame edge.
- **`blurCeiling: 40`** (v1: `30`). They are passing the lens, not settling
  into it.
- **`sharpCenterU: 0.27`** (v1: `0.42`). Because `depthEase` changes how `u`
  maps to screen radius, the in-focus band has to move to stay at a
  comparable distance from the vanishing point. Without this the crisp part
  of the corridor collapses toward the far end.
- **`motionBlurTaps`: 5 passes over 1.25 frames** (v1: 3 over 1). Approaching
  motion strobes far worse at 30fps, because peak per-frame displacement
  lands exactly when the chip is biggest and brightest.
- **`theme: "azure"`** — a colder, deeper blue with teal and ice accents
  where violet has magenta and cyan.

Everything else is shared and identical: vanishing point, path wedge, curve
amount, path count, chip count and types, sparkle count and behaviour, pulse
and flash rates, loop closure, camera drift.

## Chip size and count are coupled

Chips are evenly spaced in log-radius, so the gap between neighbours on a
path is a fixed fraction of screen radius — `(Z_FAR/zNear)^(PATH_COUNT/CHIP_COUNT) - 1`
— just as chip width is (`CHIP_WIDTH_RATIO`). Raise `CHIP_COUNT` without
lowering `CHIP_WIDTH_RATIO` and the runs close up into continuous streaks
instead of reading as distinct chips. At the shipped values the gap is about
79% of a chip width.

The same coupling means `PATH_COUNT` and `CHIP_COUNT` move together: chips
per path is `CHIP_COUNT / PATH_COUNT`, so adding paths without adding chips
thins every run out. Adding two paths took `CHIP_COUNT` 840 → 960 to hold 60
chips per path.

## Determinism

Motion is a pure function of `useCurrentFrame()`. No `Date.now()`, no
`requestAnimationFrame`, no CSS animations, no component state. Every seeded
value comes from Remotion's `random()` with a stable string seed, so frames
render identically in any order across any number of workers. (The grain
tiles fill a quarter-million pixels each, so they run a small PRNG whose seed
still comes from `random()` — see `grain.ts`.)

## The loop

Frame 450 is pixel-identical to frame 0, in both variants. Everything
periodic has a period that divides 450:

- chips complete `FLOW_SPEED` (= 1) whole path traversals per loop;
- brightness pulses use periods from `PULSE_PERIODS`, all divisors of 450;
- white flashes are scheduled modulo 450;
- the ambient camera drift is a closed Lissajous figure;
- grain picks its tile and offset from `frame % 450`.

To re-verify after a change, temporarily register a second `<Composition>`
pointing at the same component with `durationInFrames={451}`, render stills at
frame 0 and frame 450, and compare them. The component itself always wraps
time with `DURATION_IN_FRAMES` (450), so the extra frame re-renders frame 0.

## Performance

Two things keep a 4K frame affordable, and both are easy to undo by accident:

1. **Chips are rasterised once** into a sprite atlas (`sprites.ts`) and blitted
   with transforms. Rounded rects, outlines, tick marks and glow are never
   re-stroked per chip per frame.
2. **Blur is batched by depth band.** Chips are bucketed into contiguous runs
   of `u` that share a quantised blur level, and each run is drawn into a
   scratch canvas, blurred once at a resolution matched to its blur radius,
   and composited back. Setting `ctx.filter` per chip instead costs roughly
   **ten times** the render time — Chrome allocates a canvas-sized filter
   layer for every filtered draw. The bloom passes are quarter-resolution for
   the same reason.

## Rendering

```bash
# 1080p previews
npx remotion render DataTunnel out/data-tunnel-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8 --muted
npx remotion render DataTunnelApproach out/data-tunnel-approach-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8 --muted

# full 4K
npx remotion render DataTunnel out/data-tunnel.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --muted
npx remotion render DataTunnelApproach out/data-tunnel-approach.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --muted
```

`--scale=0.5` keeps the canvas backing store at 3840×2160 and downsamples the
capture, so blur radii and glow sizes in the preview match the 4K master.
`--muted` keeps Remotion from attaching a silent audio track — these are
picture-only. Lower `--concurrency` to the number of available cores if the
renderer complains.
