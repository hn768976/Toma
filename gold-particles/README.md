# Gold Particle Wave

Two seamless-looping 4K particle-field backgrounds, built with Remotion.

| Composition ID | Look | Reads as |
| --- | --- | --- |
| `GoldParticleWave` | Warm gold glitter over an amber glow | Awards, celebration, luxury, festive |
| `SilverParticleWave` | The same field in cool white-grey | Platinum / cool luxury |

Both are **3840×2160, 30 fps, 600 frames (20s)** and loop perfectly: frame 600
is identical to frame 0, so the clip can be cut end-to-end with no visible seam.
There is no audio track, no text and no camera movement.

## Setup

```console
npm install
npx remotion studio
```

## Rendering

The compositions are authored at 4K. Render each one at full resolution with:

```console
npx remotion render GoldParticleWave out/V1_GoldParticleWave.mp4 --scale=1 --crf=15
npx remotion render SilverParticleWave out/V2_SilverParticleWave.mp4 --scale=1 --crf=15
```

For a 1920×1080 preview, pass `--scale=0.5` instead. Stills:

```console
npx remotion still GoldParticleWave out/V1_GoldParticleWave_still.png --frame=318 --scale=1
npx remotion still SilverParticleWave out/V2_SilverParticleWave_still.png --frame=318 --scale=1
```

Codec settings (H.264, `yuv420p`, bt709, no audio track) come from
`remotion.config.ts`, so they apply to every render.

## How it works

There is no 3D camera. It is a 2D canvas with a faked depth model: each
particle carries a depth value (0 = near, 1 = far) that drives its size, blur,
brightness and rise speed. The speed difference is the only depth cue there is —
that parallax is what gives the flat field its sense of space.

- `src/constants.ts` — every tunable: counts, depth curves, travel speeds,
  turbulence, sparkle scheduling, glow layers. Spatial values are fractions of
  frame **height**, multiplied up from `useVideoConfig()`, so sizes and blur
  radii scale identically at 4K and at any preview resolution.
- `src/particles.ts` — the field. Built once at module level from a seeded
  mulberry32 PRNG and never mutated; `sampleParticle(particle, frame, …)` is a
  pure function of the frame number. Remotion renders frames out of order
  across threads, so a mutable particle array would both flicker and fail to
  loop.
- `src/sprites.ts` — cached sprites (soft disc, hard pinpoint, four-point
  sparkle cross, bloom halo, grain tiles), scaled per particle at draw time
  rather than filtered per element.
- `src/background.ts` — the glow (three offset elliptical gradients that drift
  and breathe) and the ~1.5% grain, which doubles as dithering for the glow
  gradient.
- `src/ParticleWave.tsx` — draws each frame in `useLayoutEffect` keyed on
  `useCurrentFrame()`, additively, batched by depth bucket and then by colour
  bucket.

### Keeping the loop

Every periodic quantity divides evenly into the 600-frame loop:

- each particle traverses the frame over a cycle of 200, 300 or 600 frames,
  entering and leaving off-frame, with a per-particle phase offset so resets are
  staggered and invisible in aggregate;
- the turbulence field is sampled on a circle in time, using integer harmonics
  of the loop, so the field itself repeats;
- sparkle periods (40/50/60/75 frames) and the 12 grain tiles divide 600 too.

If you change a period, keep it a divisor of `DURATION_IN_FRAMES`.

### Things worth not breaking

- **Bloom is only on the sharp mid-depth band and the sparkle flashes.** If the
  large near orbs start glowing, the depth reads inverted.
- **No streaks.** Every particle is a point or a soft disc; motion streaks turn
  this into a fire-ember clip.
- **No vignette.** The glow's own falloff already darkens the corners.
