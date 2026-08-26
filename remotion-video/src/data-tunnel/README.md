# DataTunnel — 4K "data tunnel" corridor

A glowing field of data chips flowing through a curved perspective corridor.
Registered in `src/Root.tsx` as `DataTunnel`: 3840×2160, 450 frames @ 30fps
(15.0s), seamless loop.

## Files

| File | Role |
| --- | --- |
| `theme.ts` | **The only file with colour literals.** One `THEMES` entry per variant. |
| `config.ts` | Every number: geometry, timing, depth response, finish. |
| `geometry.ts` | Seeded path + chip generation and all perspective math. |
| `sprites.ts` | Offscreen sprite atlas — chips are rasterised once, then blitted. |
| `grain.ts` | Pre-baked film-grain tiles. |
| `DataTunnel.tsx` | The per-frame draw pass and the composited layer stack. |

## Depth direction

`CAMERA_DIRECTION` in `config.ts` is the single signed value that decides
which way the field flows:

```ts
export const CAMERA_DIRECTION = 1;  // camera retreats — chips flow toward the vanishing point
```

Every depth calculation multiplies by it (`chipDepthU`), and the motion-blur
trail vector is derived from the same term, so flipping it to `-1` makes the
chips rush the viewer with no other change anywhere in the codebase.

## Determinism

Motion is a pure function of `useCurrentFrame()`. No `Date.now()`, no
`requestAnimationFrame`, no CSS animations, no component state. Every seeded
value comes from Remotion's `random()` with a stable string seed, so frames
render identically in any order across any number of workers. (The grain
tiles fill a quarter-million pixels each, so they run a small PRNG whose seed
still comes from `random()` — see `grain.ts`.)

## The loop

Frame 450 is pixel-identical to frame 0. Everything periodic has a period
that divides 450:

- chips complete `FLOW_SPEED` (= 1) whole path traversals per loop;
- brightness pulses use periods from `PULSE_PERIODS`, all divisors of 450;
- white flashes are scheduled modulo 450;
- the ambient camera drift is a closed Lissajous figure;
- grain picks its tile and offset from `frame % 450`.

To re-verify after a change, temporarily register a second `<Composition>`
pointing at the same component with `durationInFrames={451}`, render stills at
frame 0 and frame 450, and compare them. The component itself always wraps
time with `DURATION_IN_FRAMES` (450), so the extra frame re-renders frame 0.

## Rendering

```bash
# 1080p preview
npx remotion render DataTunnel out/data-tunnel-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

# full 4K
npx remotion render DataTunnel out/data-tunnel.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

`--scale=0.5` keeps the canvas backing store at 3840×2160 and downsamples the
capture, so blur radii and glow sizes in the preview match the 4K master.
