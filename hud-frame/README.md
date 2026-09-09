# HUD Video Frame — Remotion

A futuristic HUD border: chamfered corners, hatched blocks, tick runs, plus
markers, rings and circuit traces around a **completely empty centre**. Three
colour versions, all 3840×2160, 30 fps, 600 frames (20 s).

| Composition id            | Delivered as                     | Use                                                  |
| ------------------------- | -------------------------------- | ---------------------------------------------------- |
| `V1-HUDFrameBlue`         | `V1_HUDFrameBlue.mp4`            | **Standalone background** — dark blue field inside    |
| `V2-HUDFrameOverlayCyan`  | `V2_HUDFrameOverlayCyan.mp4`     | **Screen-blend overlay** — pure black ground          |
| `V3-HUDFrameOverlayAmber` | `V3_HUDFrameOverlayAmber.mp4`    | **Screen-blend overlay** — amber / tactical register  |

**V2 and V3 are overlays.** Drop them on a track above your footage and set the
blend mode to **Screen** (or Add). Their ground is exactly `0,0,0`, verified in
the encoded file, so everything but the HUD disappears — mp4 has no alpha
channel, but bright lines on true black key perfectly this way. Neither has a
vignette, so they will not darken the edges of your frame.

**V1 is standalone.** It carries its own dark blue field, lifting slightly
toward the border, and a gentle vignette. Composite your own footage *under* it
only if you want that field tinting the picture; otherwise use V2.

## Rendering

```bash
npm install
npx remotion studio          # preview at http://localhost:3000
```

Full 4K renders, one per composition:

```bash
npx remotion render V1-HUDFrameBlue         out/V1_HUDFrameBlue.mp4         --scale=1 --crf=15 --muted
npx remotion render V2-HUDFrameOverlayCyan  out/V2_HUDFrameOverlayCyan.mp4  --scale=1 --crf=15 --muted
npx remotion render V3-HUDFrameOverlayAmber out/V3_HUDFrameOverlayAmber.mp4 --scale=1 --crf=15 --muted
```

`--muted` keeps the file free of the silent audio track Remotion would
otherwise attach; `ffprobe` on the result should show a single video stream.
Drop `--scale=1` to `--scale=0.5` for a 1920×1080 preview — every size in the
project is a fraction of `useVideoConfig()`, so the two are identical up to
resolution. Stills:

```bash
npx remotion still V1-HUDFrameBlue out/V1_HUDFrameBlue.png --frame=420 --scale=0.5
```

## Motion

Everything is derived from `useCurrentFrame()` — no state, no timers, nothing
that depends on call order, because Remotion renders frames out of order across
threads.

- **Frames 0–60:** the border draws around its own path, easing in and out.
- **Frames 60–150:** furniture appears in six staggered groups.
- **Frames 150–600:** hold. The clip draws on once and then holds, rather than
  reversing back to empty — restarting the draw-on at the loop point would read
  as a glitch.

Every cyclic animation completes a whole number of passes in 600 frames, so the
held state is continuous across the loop: the travelling pulses along the tick
runs (2–5 passes), the hatch stripes drifting by one pitch every 150 or 200
frames, the rings turning 1–2 times, the glow breathing on a 120-frame cycle,
and the grain seed, which is keyed on `frame % 600`. Flicker — a furniture
element dimming for a frame or two — comes from a seeded PRNG schedule built
once at module scope, so it is identical on every render thread and repeats
exactly each loop.

## Grain

- **V1** uses a normal-blend dither. The dark blue field bands without it. The
  base tones in `palette.ts` are pre-darkened by ~6/255 to absorb the dither's
  mean lift.
- **V2 / V3** use an *overlay*-blend grain. Overlay leaves `0,0,0` at exactly
  `0,0,0`, so the grain modulates the lit border without surviving the screen
  blend as noise over your footage.

## Layout

`src/hud/layout.ts` generates every piece of furniture from fractions of the
composition size, and `src/hud/palette.ts` holds the three colour sets. A new
variant is a palette entry plus a `<Composition>` — no geometry to touch.

```
src/hud/geometry.ts   border polygon, chamfers, inward polygon offset
src/hud/layout.ts     furniture config
src/hud/Furniture.tsx element renderers
src/hud/HudFrame.tsx  composition: field, bloom passes, crisp pass, grain
src/hud/flicker.ts    seeded flicker schedule
```

No text, watermark or logo anywhere, and nothing animates across the middle.
