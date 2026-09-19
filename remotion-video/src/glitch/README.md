# Digital glitch plates — Remotion + PixiJS v8 + custom WebGL shaders

Three abstract glitch / data-noise backgrounds, one per supplied reference.
Each is authored as a 4K master composition with a matching 1080p delivery
composition; both run the same code at the same design scale.

| Composition | Reference | Size | Length | Frames |
|---|---|---|---|---|
| `Glitch-DataStorm-4K` / `-1080p` | istock 1413416855 | 3840×2160 / 1920×1080 | 8 s | 240 |
| `Glitch-SignalDust-4K` / `-1080p` | istock 1413416777 | 3840×2160 / 1920×1080 | 8 s | 240 |
| `Glitch-ScanlineStatic-4K` / `-1080p` | istock 925779278 | 3840×2160 / 1920×1080 | 15 s | 450 |

All compositions are 30 fps and loop seamlessly.

## Rendering

```console
# 1080p delivery (what ships)
npx remotion render Glitch-DataStorm-1080p out/Glitch-DataStorm-1080p.mp4 \
  --codec=h264 --crf=18 --x264-preset=slow --muted --gl=swangle

# 4K master
npx remotion render Glitch-DataStorm-4K out/Glitch-DataStorm-4K.mp4 \
  --codec=h264 --crf=18 --x264-preset=slow --muted --gl=swangle
```

`--gl=swangle` selects SwiftShader, needed on machines with no GPU; drop it
(or use `--gl=angle`) where one is available and rendering gets much faster.

These plates are per-pixel coloured noise, which is the worst case for 4:2:0
chroma subsampling — measurably more of the delivered error comes from
`yuv420p` than from the CRF. `--pixel-format=yuv444p` keeps the chroma intact
if the destination can take High 4:4:4 Predictive; `yuv420p` is the default
because it plays everywhere.

## Architecture

`GlitchEngine.ts` owns a five-stage render graph, driven directly off
`renderer.renderTarget` / `renderer.encoder` rather than through Pixi's scene
graph — a full-screen quad has no use for the `globalUniforms` /
`localUniforms` blocks the mesh pipeline injects, and going direct keeps one
orientation convention across render textures and the canvas.

| Stage | Scale | Job |
|---|---|---|
| `field.frag` | 1/8 | low-frequency control field (density, hue, energy, warp) |
| `cells.frag` | 1/1 | the pixel-cell mosaic |
| `post.frag` bright | 1/2 | soft-knee bright pass, box-downsampled |
| `post.frag` blur | 1/4, 1/8 | separable, anisotropic — wide across, tight down |
| `post.frag` composite | 1/1 | bloom mix, aberration, scanlines, grain, vignette, tone |

The fBm is by far the most expensive maths and everything it produces is
low-frequency, so it is generated at 1/8 scale and sampled bilinearly by the
full-resolution pass.

Nothing carries over between frames: every pass is a pure function of the loop
phase, so Remotion can render frames in any order across workers.

### Design pixels

Shaders work in *design pixels* — `renderSize / resolutionScale`, against a
1920×1080 reference. The 4K composition therefore renders the same picture at
twice the sampling rate rather than a different one: cells keep their relative
size and only gain edge precision.

### How the loop closes

Every time-driven term is periodic with period 1 in loop phase.

- **Noise** uses a value-noise lattice that wraps every `period` units on each
  axis (`tileFbm`). Drift is a whole number of periods per loop, so the field
  at phase 1 is the field at phase 0. Octaves double both frequency and period,
  so they wrap on the same boundary. This is exact — unlike a cross-fade loop,
  it costs no contrast.
- **Scroll** is quantised to whole screen-widths per loop, and cell identity is
  hashed off the column index folded into that repeat (`colW`). A row's content
  must repeat over exactly the distance it travels in one loop, and that repeat
  must be at least a screen wide or the repetition itself shows — both hold
  only under this quantisation, which is why per-row speed comes in tiers
  (`speedSteps`) rather than being freely random.
- **Twinkle, shear, tears and grain** advance a whole number of cycles or slots
  per loop.

Verified by measurement, not by eye: the frame-to-frame delta across the wrap
matches interior frame deltas to within 0.2 dB PSNR on all three clips.

Anything named `*Cycles`, `*Slots`, `speedSteps`, `period` or `driftPeriods`
must stay a whole number, or the clip will pop on the cut back to frame 0.

## Tuning

`variants.ts` holds every look parameter; the shaders are shared. Lengths are
design pixels on the 1920×1080 reference.
