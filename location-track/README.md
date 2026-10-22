# Location Track (Remotion, 4K)

Tactical satellite-tracking HUD. A wide map pulls back over an airfield, then the
feed hard-switches to a defocused close-up of the target compound. The close-up
resolves while the HUD locks on: the hex frame flashes red, "RAU-94" and its
coordinates type in, then target markers and the loading bar appear.

| Composition        | Size      | FPS | Frames | Duration |
| ------------------ | --------- | --- | ------ | -------- |
| `LocationTrack-V1` | 3840x2160 | 30  | 301    | 10.033 s |
| `LocationTrack-V2` | 3840x2160 | 30  | 301    | 10.033 s |

- **V1** matches the reference: cold steel-blue grade, cyan HUD, yellow/red/blue
  target markers, with the same layout and timing.
- **V2** is the alternative colour palette, "thermal amber": warm sodium-vapour map
  tones and an amber HUD, with cyan target rings and white markers for contrast.
  Animation, camera and timing are identical to V1.

The reference is 10.043 s at 29.97 fps. At exactly 30 fps the closest whole-frame
length is 301 frames (10.033 s, -10 ms).

## How it is built

- `src/track/maps.ts` – Canvas 2D procedural "satellite" maps, painted once per page
  at 5120x3048: forest canopy (noise and crown sprites), clearings, town, roads,
  runway, and the compound with its two hubs. A separate GIS line-work layer is drawn
  alongside. The maps are grayscale and graded in the shader.
- `src/track/renderer.ts` – WebGL2 compositor. It handles zoom/pan, defocus through
  explicit mip LOD, the palette ramp, line glow, the cut flash, vignette and grain.
- `src/track/Hud.tsx` – the SVG HUD in the reference's 1192x672 layout space, scaled
  to 4K so it stays crisp. Markers are anchored to the map transform.
- `src/track/timeline.ts` – the shot timing measured from the reference.
- `src/track/palette.ts` – the V1 and V2 palettes.
- `public/fonts` – bundled OFL fonts (Rajdhani, Share Tech Mono).

The renders are deterministic: there is no `Math.random`, and all randomness is seeded.

## Commands

Requires Node 20.19+ / 22.13+ / 24+.

```bash
npm ci
npm run dev                 # Remotion Studio preview

npm run render:v1           # 4K master -> out/LocationTrack-V1_4K.mp4 (H.264)
npm run render:v2
npm run render:v1:1080p     # 1080p     -> out/LocationTrack-V1_1080p.mp4 (--scale=0.5)
npm run render:v2:1080p
```

The delivered 1080p files were made by rendering the 4K master, then downscaling
with Lanczos:

```bash
ffmpeg -i out/LocationTrack-V1_4K.mp4 -vf scale=1920:1080:flags=lanczos \
  -c:v libx264 -profile:v high -preset slow -crf 16 -pix_fmt yuv420p -r 30 \
  -movflags +faststart LocationTrack-V1_1080p.mp4
```

### GPU / headless notes

`remotion.config.ts` selects the `angle` GL backend. That uses the GPU when there is
one and falls back to software rendering otherwise. Add `--gl=swangle` to force
software GL. If Remotion cannot download its Chrome Headless Shell, the config reuses
a Playwright headless shell at `/opt/pw-browsers/chromium_headless_shell-1194` when
that path exists.
