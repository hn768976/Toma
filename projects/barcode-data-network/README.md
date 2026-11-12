# Barcode Data Network — Remotion project (4K UHD)

An endless sheet of printed data: bands of black barcodes, caption marks and
dot matrices stream across a light-grey plane. Plexus-style network fans keep
linking points between the bands. The sheet draws itself in from the
background, and the camera glides over it under a shallow depth of field.

| Composition | Description | Resolution | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `BarcodeDataNetwork-V1` | Matches the reference: high three-quarter view, slow truck along the data | 3840×2160 | 30 | 551 | 18.367 s |
| `BarcodeDataNetwork-V2` | Alternative **camera angle and movement**: a low, grazing dolly that orbits about 34° and banks while tracking along the strips, with the same palette and content | 3840×2160 | 30 | 551 | 18.367 s |

## Technology

* **Remotion 4** (CLI) hosts the composition. Each frame is a pure function of
  `frame / fps`.
* **Three.js (WebGL 2) with custom GLSL shaders**:
  * `engine/SegmentBatch.ts`: every bar, outline, dot and network line is an
    instanced, analytically anti-aliased segment on the ground plane, drawn in
    a single call. Sliding, line growth and fade-out run on the GPU.
  * `engine/PlaneDofPass.ts`: tilt-shift depth of field computed analytically
    from the ground plane.
  * `engine/GradePass.ts`: vignette, linear→sRGB conversion and dither.
* Resolution independent: the 4K and 1080p (`--scale=0.5`) renders match.
* No external assets: everything is procedural and seeded, so renders are
  deterministic.

## Commands

```bash
npm install            # or: npm ci  (package-lock.json is included)
npm run dev            # Remotion Studio preview

# Final delivery renders (1080p H.264 MP4, rendered from the 4K composition):
npm run render:v1:1080p   # -> out/v1-1080p.mp4
npm run render:v2:1080p   # -> out/v2-1080p.mp4

# Full 4K UHD renders:
npm run render:v1:4k      # -> out/v1-4k.mp4
npm run render:v2:4k      # -> out/v2-4k.mp4

# Single 4K still:
npx remotion still BarcodeDataNetwork-V1 out/still-4k.png --frame=270
```

`remotion.config.ts` sets H.264, yuv420p, CRF 16, PNG intermediate frames and
`--gl=swangle`: software WebGL that works on any machine, with or without a GPU.
On a GPU machine, add `--gl=angle` to the render command for faster renders.
If Remotion cannot download its Chrome Headless Shell (for example on an
offline machine), set `REMOTION_BROWSER_EXECUTABLE` to a local
chrome-headless-shell.

Requires Node.js 20.19+ or 22.13+.
