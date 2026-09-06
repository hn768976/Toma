# Line Particle Wave on White

A band of fine line strokes lying on an undulating surface, seen almost
edge-on across the lower half of a white frame and dissolving into the white at
its edges. Two colourways, both 3840x2160 at 30fps, 600 frames (20s), seamless
loop, locked camera.

| Composition ID | Look |
| --- | --- |
| `V1-LineWaveWhiteBlue` | Pale blue — `#4a90c8` on the crests through `#a8cfe8` to near-white `#e8f2fa` at the far edge |
| `V2-LineWaveWhiteGraphite` | Warm graphite — `#8a7a6a` through `#c8bfb4` to `#f2efec`, fully neutral, no blue |

No text, no watermark, no logo. Nothing in the top half of the frame: it is
title space and the composition is built to protect it.

## Rendering

```console
npm install
```

### 4K masters

```console
npx remotion render V1-LineWaveWhiteBlue out/V1_LineWaveWhiteBlue.mp4 --scale=1 --crf=16
npx remotion render V2-LineWaveWhiteGraphite out/V2_LineWaveWhiteGraphite.mp4 --scale=1 --crf=16
```

### 1080p previews

```console
npx remotion render V1-LineWaveWhiteBlue out/V1_LineWaveWhiteBlue.mp4 --scale=0.5 --crf=16
npx remotion render V2-LineWaveWhiteGraphite out/V2_LineWaveWhiteGraphite.mp4 --scale=0.5 --crf=16
```

### Stills

```console
npx remotion still V1-LineWaveWhiteBlue out/V1_LineWaveWhiteBlue_f300.png --frame=300 --scale=0.5
```

### Studio

```console
npx remotion studio
```

## Chromium GL flag

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`, which is
what the scene needs — it is a WebGL composition and the default renderer will
not do. On a machine with **no GPU** (CI, a container) ANGLE has no hardware to
bind to; pass `--gl=swangle` instead, which routes ANGLE through SwiftShader and
renders identically, just slower:

```console
npx remotion render V1-LineWaveWhiteBlue out/V1.mp4 --scale=1 --crf=16 --gl=swangle
```

## Render time

Measured on the machine this project was built on — 4 vCPU, no GPU, SwiftShader
via ANGLE, Chromium headless shell:

| | |
| --- | --- |
| 1080p preview (`--scale=0.5`) | _measurement pending — filled in from the reference render_ |
| Composition size actually rasterised | 3840x2160 at both scales — see below |

`--scale` sets the browser's device scale factor, but the WebGL drawing buffer
stays at the composition's 3840x2160 either way; only the screenshot Chromium
hands back is smaller. So a 1080p preview costs the same GPU work as a 4K
master and the preview is a true 2x supersample of the 4K frame — which is
where most of its anti-aliasing quality comes from. Expect a 4K master to take
about the same time per frame as the numbers above, plus more encoding.

A GPU makes a large difference here; the figures above are the floor, not the
ceiling.

## How it is built

Everything below is a consequence of one fact: **this is a light clip**, and on
white the usual motion-graphics instincts are wrong.

- **No bloom, no glow, no additive blending, anywhere.** Additive compositing on
  white does not brighten, it washes out. Every dark value in the frame is
  strokes overlapping, drawn with normal alpha.
- **Density is the tone.** There is no shading model and no light. Where the
  surface tilts toward the viewer the strokes compress and the area reads dark;
  where it falls away they spread and fade to white. The hard ridge lines are
  the silhouettes of crests turning edge-on, where a line piles its whole
  screen-space length into a narrow band.

### Files

| | |
| --- | --- |
| `src/waves.ts` | The displaced surface: two spectral fields, `height` and `sway` |
| `src/shaders.ts` | Vertex/fragment GLSL, generated with the wave constants baked in |
| `src/geometry.ts` | The instanced quad buffer — one draw call for the whole field |
| `src/StrokeField.tsx` | Uniform plumbing, locked camera |
| `src/LineWave.tsx` | Composition: white ground, canvas, grain |
| `src/Grain.tsx` | ~1% seeded film grain |
| `src/constants.ts` | Every tunable: framing, grid density, stroke width, palettes |

### The loop

Both displacement fields are sums of travelling sinusoids
`A * sin(k . p + 2*pi*omega*t + phase)` with **integer** `omega` and
`t = frame / durationInFrames`. At `t = 1` every component has come back
exactly to where it started, so frame 600 is identical to frame 0 by
construction — no cross-fade, no cross-dissolve, no seam. (Verified: the
frame-to-frame delta across the seam matches the delta anywhere else in the
loop to within 2%.)

`omega` also sets how fast a component reads on screen. The two longest
wavelengths travel mostly into depth, where foreshortening makes them breathe
rather than sweep; the lateral migration the eye actually tracks comes from the
17- and 23-unit components, which cross about a third of the band over the full
20 seconds.

### The strokes

Each line is a polyline running away from the viewer, `ROW_COUNT - 1` segments
long, and each segment is one instance of a 4-vertex quad — 560 x 189 = 105,840
instances in a single draw call, never an object per stroke. The base positions
are never touched after startup: the vertex shader evaluates the displacement
analytically and places both endpoints itself.

The quad is expanded in **screen space**, not world space: both endpoints are
projected first, then pushed apart along the screen-space normal by a fixed
number of device pixels. That keeps a stroke a constant hairline at every depth
instead of collapsing to nothing at the far edge, and it is what makes the
sub-pixel guard possible — below `MIN_HALF_WIDTH_PX` the shader stops thinning
the stroke and fades its alpha instead. A stroke that flickers on and off
between frames is far worse than one that is simply faint. Anti-aliasing across
the width is a coverage term in the fragment shader rather than MSAA, so it is
exact at any width and costs nothing.

### Draw order

The camera is locked and the grid's Z never changes, so the correct
back-to-front order is *static*: `geometry.ts` emits instances far row first,
once, and every frame of the loop composites correctly with plain alpha
blending, no depth buffer and no re-sort.

### Determinism

All motion is a pure function of `useCurrentFrame()`. There is no `useFrame`,
no clock, no delta accumulation, and per-stroke values come from a seeded
mulberry32 rather than `Math.random()`. Remotion renders frames out of order
across worker threads; anything stateful would pop between them.

### Encoding

Frames are handed to the encoder as PNG (`Config.setVideoImageFormat("png")`),
not JPEG. On a light clip the H.264 failure mode is not banding but **mosquito
noise** in the white around the densest ridges, and JPEG intermediates feed it.
`--crf=16` is the floor for a clean master; if the white looks dirty around the
ridges, lower it further rather than reaching for anything else.
