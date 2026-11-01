# Emboss Circles — Remotion project (4K master)

A white-on-white paper-relief motion loop: lens shapes bloom into circles,
split into pairs that slide apart along diagonal grooves, settle inside rings,
and swell into fused discs whose concave-square gaps fade back to white.
The 3-second loop plays three times, like the reference.

* **Technology:** WebGL 2 fragment shader (signed-distance fields on a diamond
  lattice, soft chromatic drop shadows, hair-line edges), driven per frame by
  Remotion. No external assets.
* **Compositions (both 3840×2160, 30 fps, 270 frames = 9.000 s):**
  * `EmbossCircles-V1-Match` — matches the reference (paper white, navy ink).
  * `EmbossCircles-V2-MidnightCopper` — alternative colour palette
    (ink-blue paper, near-black shadows, copper rim light).

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* Chrome Headless Shell — Remotion downloads it automatically on first render.
  Offline machines can point to an existing one:
  `export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`

## Commands

```console
npm ci                      # install exact dependency versions
npm run dev                 # Remotion Studio preview

# 1080p deliverables (4K composition rendered at scale 0.5 → 1920×1080, H.264)
npx remotion render EmbossCircles-V1-Match out/EmbossCircles_V1_1080p.mp4 --scale=0.5
npx remotion render EmbossCircles-V2-MidnightCopper out/EmbossCircles_V2_1080p.mp4 --scale=0.5

# Full 4K UHD masters
npx remotion render EmbossCircles-V1-Match out/EmbossCircles_V1_4K.mp4
npx remotion render EmbossCircles-V2-MidnightCopper out/EmbossCircles_V2_4K.mp4
```

`remotion.config.ts` sets H.264 / yuv420p / CRF 16 and the `swangle`
(software) WebGL backend so renders work on servers without a GPU. On a
workstation with a GPU add `--gl=angle` for much faster renders.

## Source layout

| File | Purpose |
| --- | --- |
| `src/Root.tsx` | 4K composition definitions (size, fps, duration) |
| `src/emboss/EmbossCircles.tsx` | Canvas + WebGL2 setup, per-frame draw |
| `src/emboss/shader.ts` | GLSL: lattice, shapes, shadows, edges |
| `src/emboss/timeline.ts` | Key-framed 90-frame loop choreography |
| `src/emboss/keyframes.ts` | Monotone cubic key-frame interpolation |
| `src/emboss/palettes.ts` | V1 and V2 colour palettes |

## Note on duration

The reference is 270 frames at 29.97 fps (9.009 s). At exactly 30 fps the
same 270 frames last 9.000 s, which is the closest frame-accurate match:
every frame of the reference has a counterpart.
