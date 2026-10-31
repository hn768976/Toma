# Composition 1 — Plasma Orb (Remotion · Three.js · WebGL 2 shaders)

A glowing cyan plasma orb churning on a black field with faint drifting dust.
Rebuilt procedurally from the 8.000 s reference clip.

| Composition ID        | Resolution  | FPS | Frames | Duration | Description |
|-----------------------|-------------|-----|--------|----------|-------------|
| `PlasmaOrb-V1-Match`  | 3840 × 2160 | 30  | 240    | 8.000 s  | Version 1: locked-off frontal shot that matches the reference. |
| `PlasmaOrb-V2-Orbit`  | 3840 × 2160 | 30  | 240    | 8.000 s  | Version 2: alternative **camera movement**. The camera orbits about 115° around the orb, rises, and pushes in from a wide shot to a close-up. Dust parallax shows the orb's 3D volume. |

## Requirements

* Node.js 20.19+ or 22.13+ (tested with 22.23)
* npm
* No GPU needed. WebGL 2 runs through SwiftShader (`--gl=swangle`, set in
  `remotion.config.ts`). On a machine with a GPU you can pass `--gl=angle` for
  much faster renders.

## Commands

```bash
npm ci                     # install exact dependency versions
npm run dev                # Remotion Studio preview
npm run render:v1:4k       # -> out/PlasmaOrb-V1-Match_4K.mp4   (3840x2160 H.264)
npm run render:v2:4k       # -> out/PlasmaOrb-V2-Orbit_4K.mp4
npm run render:v1:1080p    # 4K master -> out/PlasmaOrb-V1-Match_1080p.mp4 (Lanczos downscale)
npm run render:v2:1080p    # 4K master -> out/PlasmaOrb-V2-Orbit_1080p.mp4
npm run render:all         # all of the above in order
```

The `:1080p` scripts use Remotion's bundled ffmpeg to make the delivery files:
H.264 High profile, `yuv420p`, BT.709 limited range with correct colour tags,
30 fps, `+faststart`. They convert the full-range BT.601 4K master through an
RGB intermediate, so the colours match the rendered frames exactly.

You can also render 1080p directly from the 4K composition, without a 4K
master: `npx remotion render PlasmaOrb-V1-Match out/v1_1080p.mp4 --scale=0.5`.

On the first render, Remotion downloads its Chrome Headless Shell. In
sandboxes that can't download it, set `REMOTION_BROWSER_EXECUTABLE` to a local
Chromium headless shell (see `remotion.config.ts`).

## How it works (`src/orb/`)

* `PlasmaOrb.tsx`: owns a Three.js `WebGLRenderer` and renders each frame
  as a pure function of `frame / fps`. Frames are deterministic and can render
  in parallel.
  1. **Volume pass** (`VOLUME_FRAG`): ray-marches domain-warped 3D simplex
     noise inside a sphere at half resolution. The gas is emissive, with ridged
     noise for bright filaments and an analytic halo.
  2. **Particle pass** (`POINTS_VERT/FRAG`): four GPU-animated point layers:
     swirling motes, plasma filament strands, escaping sparks and background
     dust.
  3. **Composite pass**: sums the intensities, applies a filmic curve, and maps
     the result through a colour ramp sampled from the reference footage
     (`palette.ts`).
* **Breathing and loop:** a slow brightness pulse, periodic over the clip, matches
  the reference's breathing. Like the reference, V1 is a **seamless loop**: over
  the last 36 frames it crossfades to the scene state exactly one loop earlier,
  so frame 239 flows into frame 0.
* `camera.ts`: static camera (V1) and eased orbit + dolly path (V2).
* `particles.ts` / `random.ts`: seeded particle attributes (mulberry32 PRNG).
