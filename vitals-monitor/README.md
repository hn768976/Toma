# Vitals Monitor (Remotion, 4K)

Close-up of an ICU patient monitor shot on a long lens with shallow depth of field.
The readouts crash to red zeros and the alarm latches while the traces keep sweeping.

| Composition        | Size      | FPS | Frames | Duration |
| ------------------ | --------- | --- | ------ | -------- |
| `VitalsMonitor-V1` | 3840x2160 | 30  | 602    | 20.067 s |
| `VitalsMonitor-V2` | 3840x2160 | 30  | 602    | 20.067 s |

- **V1** matches the reference: oblique long-lens view across the waveforms with the
  numeric column in focus at frame right, plus a slow linear push and drift. The camera
  pose was solved from point matches against the reference's first and last frames.
- **V2** is the alternative camera. It opens near-frontal on the numbers as they hit
  zero, then cranes out and orbits to the opposite side (mirroring V1's angle). It ends
  on a long lens looking back along the traces while focus racks from the numbers onto
  them.

The reference is 20.053 s at 29.97 fps. At exactly 30 fps the closest whole-frame
length is 602 frames (20.067 s, +13 ms).

## How it is built

- `src/monitor/drawScreen.ts` – Canvas 2D painter for the monitor UI (sweeping
  waveforms, readouts, labels, grid), at 5120x2880.
- `src/monitor/renderer.ts` – WebGL2 shaders. Each output pixel is ray-cast onto the
  screen plane. Pass 1 runs at half resolution: a depth-of-field gather (circle of
  confusion from distance to the focus plane) plus mip bloom. Pass 2 runs at full 4K:
  the sharp sample is blended with the blurred one by circle of confusion, then the
  grade, vignette and grain are applied.
- `src/monitor/camera.ts` – camera paths for V1 and V2.
- `src/monitor/timeline.ts` – readout values over time, keyed to the reference.
- `public/fonts` – bundled OFL fonts (Barlow Condensed, Share Tech Mono), so nothing
  is fetched at render time.

Everything is deterministic: there is no `Math.random`, and all noise comes from
hashes of time.

## Commands

Requires Node 20.19+ / 22.13+ / 24+.

```bash
npm ci                      # install exact dependency versions
npm run dev                 # Remotion Studio preview

npm run render:v1           # 4K master  -> out/VitalsMonitor-V1_4K.mp4 (H.264)
npm run render:v2           # 4K master  -> out/VitalsMonitor-V2_4K.mp4
npm run render:v1:1080p     # 1080p      -> out/VitalsMonitor-V1_1080p.mp4 (--scale=0.5)
npm run render:v2:1080p
```

The delivered 1080p files were made by rendering the 4K master, then downscaling
with Lanczos:

```bash
ffmpeg -i out/VitalsMonitor-V1_4K.mp4 -vf scale=1920:1080:flags=lanczos \
  -c:v libx264 -profile:v high -preset slow -crf 16 -pix_fmt yuv420p -r 30 \
  -movflags +faststart VitalsMonitor-V1_1080p.mp4
```

### GPU / headless notes

The scene uses WebGL2. `remotion.config.ts` selects the `angle` GL backend. That uses
the GPU when there is one and falls back to software rendering otherwise. To force
software GL (for example on a CI machine with no GPU), add `--gl=swangle`. Software
rendering takes roughly 5 s per 4K frame on 4 CPU cores.

If Remotion cannot download its Chrome Headless Shell (offline sandboxes), the
config reuses a Playwright headless shell at
`/opt/pw-browsers/chromium_headless_shell-1194` when that path exists. Otherwise point
`Config.setBrowserExecutable()` at any Chromium.
