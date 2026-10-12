# Green-Screen Phone Mockups (Remotion + three.js)

Seven compositions built from four motions, all using one generic phone that is
built entirely in code. Every phone screen is flat chroma green **`#00FF00`**, so
editors can key it and drop in their own app, site or ad.

| Composition id | Output file | Motion | Background | Length |
|---|---|---|---|---|
| `PhoneDropIn-GreenScreen` | `PhoneDropIn_GreenScreen.mp4` | Drop In | Green Screen | 10 s / 300 f |
| `PhoneDropIn-PastelGradient` | `PhoneDropIn_PastelGradient.mp4` | Drop In | Pastel Gradient | 10 s / 300 f |
| `PhoneSway-GreenScreen` | `PhoneSway_GreenScreen.mp4` | Sway (loop) | Green Screen | 20 s / 600 f |
| `PhoneSway-PastelPink` | `PhoneSway_PastelPink.mp4` | Sway (loop) | Pastel Pink | 20 s / 600 f |
| `PhoneTumbleLand-GreenScreen` | `PhoneTumbleLand_GreenScreen.mp4` | Tumble Land | Green Screen | 10 s / 300 f |
| `PhoneTumbleLand-WhiteStudio` | `PhoneTumbleLand_WhiteStudio.mp4` | Tumble Land | White Studio | 10 s / 300 f |
| `PhoneGrid-White` | `PhoneGrid_White.mp4` | Phone Grid (loop) | White | 20 s / 600 f |

Remotion composition ids may not contain underscores, so the ids use `-`. The
output file names use `_`, as in the table.

All compositions are defined at **3840×2160, 30 fps**. `PhoneModelCheck` is a small
utility composition with 4 frames (front, back, ¾ front, ¾ back on grey). It was
used for the model review.

## Setup

```bash
npm install
npx remotion studio          # preview
```

Versions are pinned in `package.json`: Remotion 4.0.515, three 0.180.0 and
@react-three/fiber 9.3.0.

## Rendering

**GPU / GL flag:** render with WebGL2 through ANGLE (`--gl=angle`).
`remotion.config.ts` already sets this (`Config.setChromiumOpenGlRenderer("angle")`),
along with PNG frame capture, H.264, yuv420p and CRF 16. WebGPU is not used.

### 4K render (per composition)

```bash
npx remotion render src/index.ts PhoneDropIn-GreenScreen      out/PhoneDropIn_GreenScreen.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts PhoneDropIn-PastelGradient   out/PhoneDropIn_PastelGradient.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts PhoneSway-GreenScreen        out/PhoneSway_GreenScreen.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts PhoneSway-PastelPink         out/PhoneSway_PastelPink.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts PhoneTumbleLand-GreenScreen  out/PhoneTumbleLand_GreenScreen.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts PhoneTumbleLand-WhiteStudio  out/PhoneTumbleLand_WhiteStudio.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts PhoneGrid-White              out/PhoneGrid_White.mp4              --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
```

- `--muted` stops Remotion from adding a silent audio track.
- `--image-format=png` keeps JPEG artefacts off the green.
- For a mastering codec, use `--codec=prores --prores-profile=4444` instead.

### 720p previews

```bash
tools/render-previews.sh     # all 7 + a PNG of frame 150 each, into renders/
```

This uses `--scale=0.3333333333333333` and gives exactly 1280×720.

### 6K still (6000×3375)

The scale is 6000 / 3840 = 1.5625:

```bash
npx remotion still src/index.ts PhoneDropIn-PastelGradient out/PhoneDropIn_PastelGradient_6K.png --frame=150 --scale=1.5625 --gl=angle --image-format=png
```

Use any composition id and frame. The canvas renders at the output resolution
because `dpr` follows `--scale`, so a 6K still is a native 6K render, not an upscale.

## Green screen: `#00FF00`, excluded from post

The screens, and the whole background on the Green Screen versions, are written as
pure `#00FF00` in the final pass, **after** tone mapping, vignette, dither and grain:

1. The **beauty pass** renders the phone (and its floor shadow) to a HalfFloat
   MSAA target on transparent black. The screen is drawn black here.
2. The **mask pass** re-renders the same geometry: screens white, everything
   else black. The punch-hole camera stays black on top of the screen.
3. The **post pass** (`src/scene/post.ts`):
   - tone-maps the phone (Khronos PBR Neutral);
   - composites it over the procedural background;
   - applies vignette, ±1/255 dither and 1 % grain;
   - mixes in `#00FF00` last, through the mask. On the green versions it also
     mixes green in through the inverse phone alpha.

There is no bloom. The green versions have **no floor and no shadow**. The phone's
frame and back stay normally lit.

## Determinism

Every value on screen comes from `useCurrentFrame()`:

- `src/motions/motions.ts` is pure functions of the frame number.
- Loops wrap the frame (`f % 600`), so frame 600 *is* frame 0. That includes the
  grain seed.
- There is no `Math.random()` anywhere, and nothing in the scene is random at
  all, so no seeded generator is needed.
- Shadow textures are computed with plain math, not drawn on a canvas.
- R3F's own render is replaced by a `useFrame(…, 1)` callback that ignores R3F's
  clock and renders the frame Remotion asked for.
- The environment is built once through PMREM, as is the geometry. A
  `delayRender` handle is held until the first frame has been drawn with them.
- No TAA, no accumulation, no `useState` driving visuals.

## Adding a background or a frame colour

- **Background:** add an entry to `BACKGROUNDS` in `src/data.ts`. Available types:
  - `diagonal`: 3-stop top-left → bottom-right blend, with an optional floor glow;
  - `studio`: cyclorama with a horizon falloff;
  - `flat`;
  - `green`.

  Then add a row to `VERSIONS` that uses it. Set `shadow: true` only if the
  background has a floor.
- **Frame colour:** add `frameColor: "#RRGGBB"` to a row in `VERSIONS`. The back
  glass, camera ring and chamfer tints derive from it. The default is graphite
  `#3A3E46`.
- **New version:** one row in `VERSIONS` = one composition.

## Project layout

```
src/data.ts                 backgrounds + one row per version
src/Root.tsx                compositions from the rows
src/PhoneComposition.tsx    ThreeCanvas + frame-driven render callback
src/phone/buildPhone.ts     the generic phone (frame, glass, screen, buttons, back, camera strip)
src/phone/geometry.ts       rounded-rect sweeps, caps, raised plates
src/scene/world.ts          scene, lights, grid instancing, shadows, 3-pass render
src/scene/environment.ts    procedural soft-box studio → PMREM
src/scene/post.ts           tone map, backgrounds, vignette, dither, grain, green composite
src/scene/shadows.ts        math-generated shadow textures
src/motions/motions.ts      all motion curves
tools/render-previews.sh    720p previews + PNG of frame 150 + timings -> renders/
tools/full-sequences.sh     full PNG-sequence renders (601-frame loops) -> out/seq/
tools/verify-all.sh         runs verify steps 1-4 on the above
tools/checks.py             green / banding / key / identical-frame checks
tools/smoothness.py         tracks the phone silhouette frame by frame (step 6)
tools/sheet.sh              quick contact sheet of chosen frames
```

## Measured render times

All times were measured in this build environment: 4 CPU cores, **no GPU**. WebGL
runs on SwiftShader through ANGLE. Previews were rendered with
`tools/render-previews.sh` (720p, `--concurrency=4`, PNG frames, H.264 encode
included). Times are wall-clock per output frame.

| Composition | Frames | 720p total | 720p per frame | 4K estimate per frame | 4K estimate total |
|---|---|---|---|---|---|
| PhoneDropIn-GreenScreen | 300 | 98 s | 326 ms | ~2.4 s | ~12 min |
| PhoneDropIn-PastelGradient | 300 | 112 s | 372 ms | ~2.5 s | ~13 min |
| PhoneSway-GreenScreen | 600 | 206 s | 343 ms | ~2.4 s | ~24 min |
| PhoneSway-PastelPink | 600 | 229 s | 381 ms | ~2.5 s | ~25 min |
| PhoneTumbleLand-GreenScreen | 300 | 92 s | 307 ms | ~2.4 s | ~12 min |
| PhoneTumbleLand-WhiteStudio | 300 | 107 s | 357 ms | ~2.5 s | ~13 min |
| PhoneGrid-White | 600 | 419 s | 698 ms | ~3.1 s | ~31 min |

**How the 4K estimates were made.** On the same machine, single 4K stills took
~8.6 s (1B) and ~9.7 s (grid) longer than single 720p stills. The shader work is
CPU-bound here, and 4K is 9× the pixels. That puts 4K at roughly **6–7× the 720p
time per frame** (~2.5 s per frame) on this machine; the grid, which is already
heavier at 720p, comes out at ~4.5× (~3.1 s). On a machine with a real GPU through
ANGLE, expect it to be far faster: the scene is light, and most of the cost here is
software rasterisation and PNG capture. Those numbers were **not** measured.

## Verification (run on the 720p previews)

Run `tools/verify-all.sh` after `tools/render-previews.sh` and `tools/full-sequences.sh`.
**All checks pass.**

1. **Files:** all 7 are 1280×720, 30/1, h264, yuv420p, with no audio stream
   (rendered with `--muted`). Durations are 10.000 s and 20.000 s.
2. **Loops:** the 2A, 2B and 4 compositions were rendered at 601 frames
   (`REMOTION_LOOP_CHECK=1`). Frame 600 is **byte-identical** to frame 0. The loop
   phase, including the grain seed, wraps with `frame % 600`.
3. **Determinism:** frame 150 rendered alone from a cold start is
   **byte-identical** to frame 150 of a full 4-thread render, for all 7 compositions.
4. **Green check** (`tools/checks.py green`), sampled in the encoded mp4 at 5
   evenly spaced frames per composition:
   - The screen, and the background on the green versions, is a single flat value
     within ±1. It decodes as (0, 254–255, 0).
   - Samples are taken 16 px clear of the phone. Within ~16 px of the black bezel,
     H.264 ringing (CRF 16, 4:2:0) moves values by up to ~15 levels. That is codec
     ringing, not the render: the rendered PNG frames are exactly `#00FF00` right
     up to the edge.

   **Banding** (`tools/checks.py band`): read across the pastel gradients and the
   studio falloff in the encoded mp4. The largest step between smoothed neighbouring
   values is ≤ 0.33 levels, and the longest constant run is ≤ 25 px, so there are no
   steps.

   **Key test** (ffmpeg `chromakey` + `despill`, frame 150 of 1A, 2A and 3A): there
   are 0 holes in the phone body and 0 opaque green-fringe pixels. The composites
   over magenta are clean.
5. **Contact sheets** (5 evenly spaced frames per composition):
   - each shows the generic phone, a flat green screen and the right motion and
     background;
   - there is no shadow on the green versions.
6. **Smoothness:**
   - The phone's silhouette was tracked frame by frame on the full sequences. The
     landings ease in, overshoot by a few pixels and settle, with no pop: maximum
     acceleration is 8.8 px/frame² on 3A and 5.5 px/frame² on the sway.
   - Stepping through enlarged crops showed stable rims and highlights, with no edge
     shimmer.

## Completion checklist

- [x] 4 motions → 7 compositions, one project, 3840×2160 @ 30 fps; 300 / 600 frames
- [x] one phone model built in code; grid instanced; WebGL2 (ANGLE), no WebGPU, no PixiJS
- [x] generic design: round punch-hole, flat sides, power right / volume left,
      plain back with a two-lens vertical strip, no logos or text
- [x] screen and green backgrounds `#00FF00`, composited after post via a mask
- [x] no shadow on green; soft contact shadows on Pastel Gradient, White Studio and Grid
- [x] dither ±1/255 and 1 % grain from pixel position + frame; none on green
- [x] no `Math.random()`, no clocks, no `useState` visuals, no TAA or accumulation
- [x] loop checks, determinism checks, green / banding / key checks pass
- [x] model check by independent sub-agents (2 rounds, no brand match after round 2)
- [x] reference comparison by independent sub-agents (3 rounds per motion)

