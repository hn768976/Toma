# Twisted Ribbon Loop

A single wide flat band swept along a closed 3D saddle curve, twisting as it goes
so it appears to weave over itself. Framed close — the band is cropped by all
four edges — and rotating slowly. Two versions, **light** and **dark**, sharing
one geometry, one camera and one motion.

Remotion + `@remotion/three` + react-three-fiber, WebGL. 30fps, 16:9,
compositions defined at 3840×2160, 300 frames (10s).

- `TwistedRibbonLight`
- `TwistedRibbonDark`

## Quick start

```bash
npm install
npx remotion studio
```

## Rendering

**4K, full quality** (per composition):

```bash
npx remotion render TwistedRibbonLight out/TwistedRibbon_Light.mp4 --scale=1 --crf=16
npx remotion render TwistedRibbonDark  out/TwistedRibbon_Dark.mp4  --scale=1 --crf=16
```

**1080p preview** — same compositions, half scale:

```bash
npx remotion render TwistedRibbonLight out/TwistedRibbon_Light.mp4 --scale=0.5 --crf=16
npx remotion render TwistedRibbonDark  out/TwistedRibbon_Dark.mp4  --scale=0.5 --crf=16
```

Codec, pixel format, CRF and image format are pinned in `remotion.config.ts`
(h264 / yuv420p / CRF 16 / png frames) and the project is muted with
`setEnforceAudioTrack(false)`, so the output carries no audio stream.

### Stills

```bash
# 6000x3375 print-scale stills
npx remotion still TwistedRibbonLight out/still_light_f165.png --frame=165 --scale=1.5625
npx remotion still TwistedRibbonDark  out/still_dark_f165.png  --frame=165 --scale=1.5625

# 1080p stills
npx remotion still TwistedRibbonLight out/still_light_1080.png --frame=165 --scale=0.5
npx remotion still TwistedRibbonDark  out/still_dark_1080.png  --frame=165 --scale=0.5
```

`--scale=1.5625` is 6000 / 3840. Harvested frames are listed in
"Chosen still frames" below.

On slow hardware add `--timeout=180000`: a 6000×3375 frame can take longer than
Remotion's 30 s default to mount, and the still fails with
"Timeout exceeded rendering the component initially" rather than producing a
bad image.

### Chromium / GL

Headless Chromium needs an explicit GL renderer:

```bash
npx remotion render TwistedRibbonLight out/x.mp4 --scale=0.5 --gl=angle
```

`angle` is the default in `remotion.config.ts`. On a machine with no GPU, ANGLE
falls back to software and recent Chromium refuses that fallback without an opt
in — use `--gl=swiftshader` there instead, which is what the measured timings
below were produced with.

If Remotion cannot download its own Chrome Headless Shell (restricted egress),
point it at an existing Chromium:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/headless_shell npx remotion render ...
```

`remotion.config.ts` reads that variable only when it is set, so a normal
install is unaffected.

## Measured render time

Measured on a 4-core cloud container with **no GPU** (`--gl=swiftshader`,
`--concurrency=3`), software rasterisation throughout:

| | per frame (wall) | 300 frames |
|---|---|---|
| 1080p (`--scale=0.5`), `TwistedRibbonLight` | **5.02 s** | 25 min 07 s |
| 1080p (`--scale=0.5`), `TwistedRibbonDark` | **5.38 s** | 26 min 54 s |
| 6000×3375 single still | 32–37 s | — |
| 4K (`--scale=1`) — **estimate** | ~20 s | ~1 h 40 m |

The 4K figure is an estimate scaled by pixel count (4×), not a measurement. The
cost is dominated by fill rate — 8× MSAA into a half-float target, a full-
resolution depth-of-field pass, and PCSS sampling a 4096² shadow map — not by
the geometry, which is only 14,400 triangles. On a machine with a real GPU
expect this to drop by more than an order of magnitude; these numbers are a
software rasteriser's worst case, not a representative render time.

## Verification

```bash
npm run verify:geometry   # closure, two-fold symmetry, creases, winding, tessellation
npm run verify:framing    # band cropped by all four edges at every rotation
npm run lint              # tsc --noEmit
```

`verify:geometry` checks the things that fail silently and only show up as a
visible crease, or as a loop that does not close, twenty minutes into a render:

- the parallel-transport closure residual is distributed so the frame closes;
- the last ring of vertices is **bit-identical** to the first (no seam);
- the whole surface is **bit-exactly invariant under Ry(π)**, which is what
  makes frame 300 a pixel-identical copy of frame 0;
- no normal discontinuity (a Frenet frame would put a 180° crease at every
  inflection point — this rig uses a rotation-minimising frame instead);
- triangle winding agrees with the authored face normals;
- max silhouette turn per segment, which is what faceting looks like as a number.

`verify:framing` rasterises the ribbon's silhouette through the real camera and
reports per-edge coverage at every rotation. It is done geometrically rather
than by thresholding a render because the band's shadowed underside is *darker*
than the backdrop, so no brightness threshold can tell band from background.

### Banding check

A near-white smooth gradient across a 4K frame is the worst case for 8-bit
H.264, so verify it **on the encoded mp4**, not in the preview:

```bash
npx remotion ffmpeg -y -ss 3 -i out/TwistedRibbon_Light.mp4 -frames:v 1 frame.png
```

Then read a horizontal and a vertical scanline across the background gradient
and confirm the values change smoothly with no stepped plateaus. The rig
defends against banding in three places:

1. a 16-bit float intermediate buffer (`frameBufferType={HalfFloatType}`), so
   nothing quantises until the single final 8-bit write;
2. a **relative** dither on the backdrop gradient, applied before tone mapping;
3. a final ordered-dither + film-grain pass.

Both dithers are scale-aware on purpose. The backdrop shader writes *linear*
values, so a fixed ±1/255 there would be invisible on the light version and a
~30% swing on the dark version's near-black backdrop — it is applied
multiplicatively instead. The final pass converts to sRGB, perturbs, and
converts back, so "2% grain" and "one 8-bit step" mean what they say in the
encoded file rather than in linear light.

If bands survive: raise `post.grain` toward 0.025 in `src/ribbon/versions.ts`,
then lower CRF toward 14. Do not flatten the gradient to hide it.

### Loop closure

A 300-frame seamless loop means **frame 300 equals frame 0**, not frame 299.
The rotation is exactly π over the composition and, with `k = 2`, the form has
two-fold rotational symmetry about Y — so the loop is exact by construction
rather than by tuning.

To check it, temporarily raise `durationInFrames` on the composition in
`src/Root.tsx` to 301 and render frames 0 and 300 as PNGs; they must be
pixel-identical. The loop *period* is the `DURATION_IN_FRAMES` constant in
`src/ribbon/params.ts` and is deliberately **not** read from
`useVideoConfig().durationInFrames` — if it were, extending the composition to
301 frames would change the rotation per frame and the check could never pass.

## Determinism

Remotion renders frames out of order across multiple threads, so every value on
screen is a pure function of `useCurrentFrame()`:

- no `useFrame` clock, no `Date.now()`, no delta accumulation;
- no `Math.random()` at render time — the grain is a hash of
  `(pixel, frame % period)`, which also makes it periodic over the loop;
- no mutable state carried between frames;
- no physics or spring integration;
- no temporal effects in the post chain: no TAA, no temporal motion blur, no
  temporally-denoised SSAO. Depth of field and bloom are pure spatial shaders.
  `AccumulativeShadows` is deliberately **not** used — it accumulates across
  frames and would differ per render thread. Shadows are PCSS (`<SoftShadows>`).

One consequence worth knowing about: `@react-three/postprocessing` publishes its
composer through React state, so on the commit where the composer is created its
`useFrame` closure still sees `null` and draws nothing. `@remotion/three` calls
`advance()` from a passive effect on that same commit, so without intervention
the first frame each render thread handles comes out black.
`src/ribbon/ComposerSync.tsx` holds a `delayRender()` across two animation
frames and re-advances, which puts the draw after React has committed.

## Making variations

All of the rig's shape parameters are in `src/ribbon/params.ts`, and changing
one is a one-line edit. Run `npm run verify:geometry && npm run verify:framing`
afterwards — the first tells you whether the band still closes, the second
whether it is still cropped on all four edges.

| Constant | What it does |
|---|---|
| `K` | Half-turns of the cross-section around the loop. **Must be an integer** or the band will not close. Even keeps the surface orientable (both faces stay distinct); odd makes it a Möbius band, which closes geometrically but flips normals through the join. `K = 2` is one full turn. |
| `A_RATIO` | Saddle amplitude as a fraction of `R`. This is what makes the loop read as a saddle rather than a flat hoop, and what makes the band appear to cross itself. Too small → plain ring; too large → pretzel. |
| `WIDTH_RATIO` | Band width as a fraction of `R`. The strongest proportion cue in the image. |
| `THICKNESS_RATIO` | Band thickness as a fraction of the **width**. Non-zero on purpose: the thin edge face is what catches the bright line along the silhouette. Keep `shadow.normalBias` in `versions.ts` well under the resulting thickness or self-shadowing disappears. |
| `TWIST_PHASE_DEG` | A constant roll of the cross-section. Pure framing control — it chooses which part of the loop presents its wide face to the camera without moving the camera or changing the silhouette. Cannot break closure or the Y symmetry. |
| `ROTATION_PHASE_DEG` | A constant offset added to the rotation. Chooses which composition lands on frame 0 without touching the 180° sweep that closes the loop. |
| `H3_RATIO` | Small odd-harmonic perturbation on the X/Z terms, to stop the curve looking too regular. Must stay an odd integer harmonic to preserve the two-fold Y symmetry. |
| `SEGMENTS` | Segments along the curve. **Must be even** — the exact symmetry construction mirrors ring `i` onto ring `i + SEGMENTS/2`. Raise it if the outer silhouette reads as straight segments. |

Camera (`CAMERA` in `src/ribbon/versions.ts`) is shared by both versions, as is
the motion. The per-version look — background gradient, material, lights,
shadow softness, tone mapping, depth of field, bloom, grain — lives in the
`LIGHT` and `DARK` objects in the same file.

### Changing the duration

`DURATION_IN_FRAMES` in `src/ribbon/params.ts`. If 18°/s reads too fast, raise
it to 400 or 450 — **do not reduce the rotation angle.** The 180° is what closes
the loop; changing the duration does not.

## Notes on the build

- **Geometry is built, not approximated.** A flat rectangular cross-section is
  swept along `p(u) = (R·cos u, A·sin 2u, R·sin u)` on a parallel-transported
  (rotation-minimising) frame, twisted by `K` half-turns, with the transport
  residual distributed evenly so the frame closes on itself.
- **Normals come from the frame, never averaged** from neighbouring geometry.
  Averaging rounds the corners off and loses the crisp edge highlight. The wide
  faces take the thickness axis; the thin edge faces take the width axis.
- **The second half of the loop is mirrored, not recomputed.** The curve
  satisfies `p(u + π) = Ry(π)·p(u)`, and with an even `K` the whole swept
  surface inherits that symmetry. Building the second half from that identity
  rather than re-evaluating the trig makes the symmetry exact in floating point,
  which is what turns "almost identical" into "pixel-identical" at frame 300.
- **Depth of field is normalised against resolution.** postprocessing measures
  the bokeh kernel in texels, so a fixed `bokehScale` blurs twice as hard at
  1080p as at 4K; the rig scales it by the drawing-buffer width so the 1080p
  preview is an honest preview of the 4K render.
- **The backdrop is two coincident planes** — an unlit, dithered, shader-authored
  gradient evaluated in screen space, plus a transparent shadow catcher in front
  of it — so the cast shadow multiplies over the gradient instead of the
  lighting model fighting the high-key value range. Both are parented to the
  camera's frustum so the backdrop can never run out of frame.
- **The environment map is procedural.** A small equirect gradient with a few
  soft blobs, PMREM-filtered locally. An HDRI download would be a
  non-deterministic dependency in a headless render.

## Chosen still frames

Rotation is 180° over 300 frames, so every frame is a distinct composition and
frames 0 and 300 are identical. Frames around 125–210 fill the frame most; 0–75
and 250–299 are the sparser, more negative-space compositions.

| composition | frames harvested |
|---|---|
| `TwistedRibbonLight` | 130, 165, 205 |
| `TwistedRibbonDark` | 130, 165, 205 |

```bash
npx remotion still TwistedRibbonLight out/still_light_f130.png --frame=130 --scale=1.5625
npx remotion still TwistedRibbonLight out/still_light_f165.png --frame=165 --scale=1.5625
npx remotion still TwistedRibbonLight out/still_light_f205.png --frame=205 --scale=1.5625
npx remotion still TwistedRibbonDark  out/still_dark_f130.png  --frame=130 --scale=1.5625
npx remotion still TwistedRibbonDark  out/still_dark_f165.png  --frame=165 --scale=1.5625
npx remotion still TwistedRibbonDark  out/still_dark_f205.png  --frame=205 --scale=1.5625
```
