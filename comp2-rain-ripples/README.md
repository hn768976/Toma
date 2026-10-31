# Composition 2 — Rain Ripples on Water (Remotion, WebGL 2 shaders)

Rain drops striking a blue water surface: expanding multi-ring ripples with
impact craters riding on glittering wind chop, lit by a silvery sky in the
upper-left and deep blue water toward the right — rebuilt procedurally from
the ~30 s reference clip.

| | |
|---|---|
| Composition size | **3840 × 2160 (4K UHD)** |
| Frame rate | 30 fps |
| Duration | 901 frames = **30.033 s** (reference: 900 frames @ 29.97 fps = 30.030 s; 30.030 s is 900.9 frames at 30 fps, so 901 is the nearest frame-exact length, +3.3 ms) |
| Technology | WebGL 2 fragment shaders (two passes, float render target) |
| Audio | silent stereo 48 kHz AAC track, like the reference (its audio track is digital silence) |

## Compositions

| ID | Version | Description |
|---|---|---|
| `RainRipples-V1-Reference` | V1 | Static, steep high-angle view of the surface, matching the reference framing, colours and motion. |
| `RainRipples-V2-LowAngleDolly` | V2 | **Alternative camera angle + movement**: low grazing camera (31°→26° pitch) gliding slowly forward across the water with gentle lateral drift and yaw; perspective-foreshortened ripples and far-field sky sheen. Same palette and rain simulation. |

## How it works

* **Pass 1 (height field, RGBA32F):** each pixel is ray-cast onto the water
  plane. Height = 24 dispersive wave trains in three bands — broad isotropic
  swell, medium chop fanned symmetrically about the view direction (soft,
  horizontally elongated glints) and fine fast capillaries (glitter) —
  domain-warped and band-limited by the pixel footprint to prevent
  aliasing; plus rain-drop ripples spawned deterministically on a
  world-space grid. Each drop: a dark impact crater with a bright splash
  rim for ~0.15 s, then a perfectly round packet of 1–3 thin crests that
  launches at ~0.19 W/s, decelerates, grows to ~0.15 W and fades over 1.6 s.
* **Pass 2 (shading):** slope toward the sky light is normalised to an
  ≈uniform value (plus a narrow specular lobe for sharp sun glints) and mapped through `src/rain/colorField.json` — a
  luminance-quantile colour field measured from the reference (7 quantiles ×
  24×14 regions; the stock watermark area was replaced with a smooth fit).
  This reproduces the reference's regional colours and contrast.
* Everything is a pure function of the frame number → deterministic,
  parallel-safe rendering.
* The shader evaluates at the pixel density actually rendered: native 4K
  for `--scale=1`, 1080p for the `--scale=0.5` deliverables.

## Commands

```bash
npm install            # install dependencies (Node 20.19+/22.13+/24)
npm run dev            # Remotion Studio preview (needs WebGL 2)

# Final deliverables: 4K composition rendered to 1080p H.264 MP4 (+ silent AAC)
npm run render:v1      # → out/RainRipples-V1-Reference-1080p.mp4
npm run render:v2      # → out/RainRipples-V2-LowAngleDolly-1080p.mp4

# Optional native 4K masters
npm run render:v1:4k
npm run render:v2:4k
```

Each `render:*` script renders the video with Remotion, then uses
Remotion's bundled ffmpeg (`remotion ffmpeg`) to losslessly remux it with a
silent stereo 48 kHz AAC track trimmed to exactly 901/30 s, so video, audio
and container durations are all 30.033 s (AAC frame padding would otherwise
stretch the container to 30.037 s).

Rendering note: on machines without a GPU, Chrome falls back to software
WebGL (SwiftShader). Expect ~1.5 s/frame at 1080p on 4 CPU cores
(~25 min per version), much faster with a GPU (`--gl=angle`). The config
raises the per-frame timeout to 300 s for that case.

## Files

```
src/index.ts               registerRoot
src/Root.tsx               the two 4K compositions
src/rain/RainRipples.tsx   WebGL 2 setup + per-frame rendering
src/rain/shaders.ts        GLSL ES 3.00 height + shading passes
src/rain/waves.ts          seeded wave-train parameters
src/rain/camera.ts         V1 static camera, V2 low-angle dolly
src/rain/colorField.json   colour field measured from the reference
remotion.config.ts         render settings
```
