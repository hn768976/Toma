# Glitter Ring — Remotion

Three seamless 20-second loops of a glitter ring orbiting an empty centre,
over a soft bokeh field: **gold**, **silver/platinum** and **rose gold**.

All three compositions are defined at **3840×2160, 30fps, 600 frames** and are
built to be rendered at 4K.

## The centre is intentionally empty

The dark hole in the middle of the ring is the point of the clip: it is where
a logo, title or product shot goes. Nothing animates through it — the
foreground blobs are pinned to the frame edges and the background bokeh is the
only thing that shows through the middle. Ring diameter is 0.55 × frame
height, which leaves a generous hole at any resolution.

## Install and preview

```bash
npm install
npx remotion studio
```

## Render at 4K

```bash
npx remotion render V1-GlitterRingGold     out/V1_GlitterRingGold.mp4     --scale=1 --crf=15
npx remotion render V2-GlitterRingSilver   out/V2_GlitterRingSilver.mp4   --scale=1 --crf=15
npx remotion render V3-GlitterRingRoseGold out/V3_GlitterRingRoseGold.mp4 --scale=1 --crf=15
```

`npm run render:gold` / `render:silver` / `render:rosegold` are the same
commands. For a 1080p preview, add `--scale=0.5` instead of `--scale=1`; the
composition still renders at 4K internally, so the two match exactly.

A still (any frame) is:

```bash
npx remotion still V1-GlitterRingGold out/V1_GlitterRingGold.png --frame=12 --scale=1
```

Codec settings (H.264, `yuv420p`, CRF 15) come from `remotion.config.ts`, so
the flags above only need `--scale`. There is no audio track in any
composition.

## How it is built

A single 2D canvas, drawn in `useLayoutEffect` keyed on `useCurrentFrame()` so
every frame is fully painted before Remotion captures it. Polar coordinates,
no camera and no 3D: depth is faked with size, blur and brightness.

- `src/glitter-ring/constants.ts` — composition, geometry and motion values.
  Geometry is expressed as a fraction of frame **height** and multiplied by the
  live height from `useVideoConfig()`, so particle sizes and blur radii scale
  with the render resolution instead of being baked in at 1080p.
- `src/glitter-ring/palettes.ts` — the three colour versions.
- `src/glitter-ring/random.ts` — mulberry32 PRNG.
- `src/glitter-ring/field.ts` — the seeded particle field, built once per seed
  and never mutated.
- `src/glitter-ring/sprites.ts` — the cached sprite atlas (soft disc, hard dot,
  four-point cross) plus the grain tiles.
- `src/glitter-ring/draw.ts` — the frame.

### Why it loops

Remotion renders frames out of order across threads, so no mutable particle
array is carried between frames: every particle's position is derived from its
seed plus the frame number. Every periodic term completes a whole number of
cycles over the 600-frame loop — particles orbit twice, the arc highlights
travel once, the ring's radius breathes once, bokeh drifts on closed paths, and
sparkle schedules are keyed on `frame % 600` — so frame 600 is frame 0.

### Rendering notes

- Particles are composited additively (`globalCompositeOperation = "lighter"`),
  so overlapping particles build brightness.
- Bloom is applied to the arc highlights and sparkles only. The background
  bokeh stays soft and dim: if the discs start glowing, the ring stops being
  the subject.
- Fine grain at ~1.5% is added as an additive dither. The smooth background
  gradient bands in H.264 without it, and banding shows up in the encoded file
  rather than in the studio preview — check the mp4.

### Tuning

Most of what a buyer might want changed is one line in `constants.ts`:
`RING_DIAMETER_FRACTION` (hole size), `RING_PARTICLE_COUNT`, `ORBIT_LAPS`
(orbit speed, must stay a whole number), `ARCS` (how many highlights and where
they start) and `SPARKLE_FRACTION`. Colours live in `palettes.ts`; the `seed`
prop on each composition reshuffles the particle arrangement.
