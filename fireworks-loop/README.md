# Composition 1 — Fireworks Loop (Remotion, 4K)

A cluster of chrysanthemum fireworks (orange / gold / red / pink) bursting on
a black sky. Each launch position re-fires every 2 s, so the cluster stays full
and bright after a 2–3 s build-up. That matches the reference clip.

| Composition ID     | Version | Size        | FPS | Frames | Duration |
| ------------------ | ------- | ----------- | --- | ------ | -------- |
| `Fireworks-V1-4K`  | V1, matches the reference (warm palette)     | 3840 × 2160 | 30 | 300 | 10.000 s |
| `Fireworks-V2-4K`  | V2, alternative **"arctic" colour palette** (cyan, silver, violet, emerald, orchid). Same show, layout and timing. | 3840 × 2160 | 30 | 300 | 10.000 s |

**Technology:** Canvas 2D particle system (`src/fireworks`), drawn natively at
3840 × 2160 with additive (`lighter`) blending. A two-level downsample/blur
bloom pass adds the glow. The canvases are CPU-backed
(`willReadFrequently`), which is about 7× faster than GPU emulation on machines
without a GPU. All motion is a pure function of time and uses a
seeded PRNG, so every frame is deterministic and frames can render in parallel.

**Duration note:** the reference is 300 frames at 29.97 fps (10.010 s). At
exactly 30 fps, 10.010 s would be 300.3 frames, which isn't possible. The
composition keeps the reference's exact frame count (300 frames = 10.000 s).

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- Internet access on the first render, so Remotion can download its Chrome
  Headless Shell. Alternatively, point `REMOTION_BROWSER_EXECUTABLE` to a local
  Chrome Headless Shell (see `remotion.config.ts`).

## Commands

```console
npm ci                 # install exact dependency versions (or: npm i)
npm run dev            # open Remotion Studio to preview both 4K compositions

npm run render:v1      # -> out/Composition1_Version1_1080p.mp4 (4K comp rendered at --scale=0.5)
npm run render:v2      # -> out/Composition1_Version2_1080p.mp4
npm run render:all     # both 1080p deliverables

npm run render:v1:4k   # optional 4K master -> out/Composition1_Version1_4K.mp4
npm run render:v2:4k   # optional 4K master -> out/Composition1_Version2_4K.mp4
```

Output settings (`remotion.config.ts`): H.264, yuv420p, CRF 16, PNG intermediate frames.

## Files

- `src/Root.tsx`: registers the two 4K compositions
- `src/fireworks/show.ts`: choreography (launch positions, timing, shell sizes)
- `src/fireworks/draw.ts`: renderer (stars, trails, glitter, flash, bloom)
- `src/fireworks/palettes.ts`: `classic` (V1) and `arctic` (V2) palettes
- `src/fireworks/random.ts`: deterministic PRNG / hash
