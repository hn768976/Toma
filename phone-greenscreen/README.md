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
tools/render-previews.sh    720p previews + timings
tools/checks.py             green / banding / key / identical-frame checks
```

<!-- RESULTS -->
