# Horizon Light Streaks · Defocused Server Rack · Glass Block Gradient

One Remotion project with five 20-second seamless loops: 30 fps, 600 frames, 16:9. Compositions are defined at 3840×2160.
Everything is built in code with three.js on WebGL2, inside `@remotion/three`'s `<ThreeCanvas>`. There are no MCP servers, no image assets, no logos and no readable text.

| Composition id | Delivered file | Look | Engine |
|---|---|---|---|
| `HorizonStreaks` | `HorizonStreaks.mp4` | Horizon Light Streaks, blue | three.js 3D: instanced ribbons, head sprites, bokeh, bloom |
| `ServerBokeh-BlueLime` | `ServerBokeh_BlueLime.mp4` | Defocused Server Rack, blue and lime | three.js 3D: procedural racks, CoC gather DoF, soft round bokeh sprites |
| `ServerBokeh-BlueAmber` | `ServerBokeh_BlueAmber.mp4` | Defocused Server Rack, blue and amber | same |
| `GlassBlock-TealViolet` | `GlassBlock_TealViolet.mp4` | Glass Block Gradient, teal and violet | full-screen fragment shader |
| `GlassBlock-CoralPink` | `GlassBlock_CoralPink.mp4` | Glass Block Gradient, coral and pink | same |

Remotion composition ids may not contain `_`, so the ids use `-`. Rename the files to the `_` names when you render them.

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18 or later. All dependency versions are pinned in `package.json`.

### Chromium GL flag

WebGL2 in headless Chromium needs ANGLE. `remotion.config.ts` sets it with `Config.setChromiumOpenGlRenderer("angle")`, so the CLI commands below already use it. To pass it explicitly, add `--gl=angle`. On a machine without a GPU, ANGLE falls back to SwiftShader, which is slow but correct. With the Node render APIs, pass `chromiumOptions: { gl: "angle" }`.

## Render at 4K (3840×2160)

```bash
npx remotion render HorizonStreaks         out/HorizonStreaks.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render ServerBokeh-BlueLime   out/ServerBokeh_BlueLime.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render ServerBokeh-BlueAmber  out/ServerBokeh_BlueAmber.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render GlassBlock-TealViolet  out/GlassBlock_TealViolet.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render GlassBlock-CoralPink   out/GlassBlock_CoralPink.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

### 720p previews (as delivered)

```bash
npx remotion render <id> out/<file>.mp4 --gl=angle --scale=0.3333333333333333 --codec=h264 --pixel-format=yuv420p --crf=16
```

This produces exactly 1280×720. ffprobe confirmed it, so no ffmpeg downscale was needed.

## Stills at 6000×3375

```bash
npx remotion still <id> out/<id>-6k.png --frame=300 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. The renderer draws at the full output resolution because the canvas uses the real device pixel ratio, so a 6K still is rendered at 6K, not upscaled. All pixel-sized parameters (line widths, CoC, bokeh, grain) are defined at 720p and scale with resolution.

## Render time

Measured on the build machine: a cloud container with 4 CPU cores, **no GPU** (ANGLE fell back to SwiftShader, so all WebGL ran on the CPU), and `--concurrency=2`. Times are full 600-frame 720p renders (wall clock including browser start, divided by 600).

| Look | 720p measured (s/frame) | 4K estimate, same CPU-only machine | 4K estimate, any desktop GPU |
|---|---|---|---|
| Glass Block (both) | 0.22 | ~1.8 s/frame (~18 min/loop) | ~0.3 s/frame |
| Horizon Streaks | 0.96 | ~6 s/frame (~1 h/loop) | ~0.4 s/frame |
| Server Bokeh (each) | 2.2 | ~18 s/frame (~3 h/loop) | ~0.6 s/frame |

How the 4K estimates were made: 4K has 9× the pixels of 720p. On SwiftShader the fragment work scales almost linearly with pixel count, while vertex work (3,000 ribbons, 9,000 LED sprites) and browser overhead do not. Most of the cost is per-pixel: the procedural rack shader, the 64-tap DoF gather and the per-pixel glass shader. With a real GPU the shaders are cheap, and the remaining cost is mostly screenshot, PNG and encode overhead in Remotion. The GPU column is an estimate and was not measured here.

## How it works

### Determinism

Every value on screen comes from `useCurrentFrame()`, and nothing else:

- `src/common/GLLoop.tsx` writes the frame number during the React render. When `<ThreeCanvas>` calls `advance()` for that frame, a `useFrame(…, 1)` hook draws every pass imperatively. R3F's clock and delta are ignored. Each look is a `LoopRenderer.render(gl, frame, w, h)` that sets every uniform and transform from `frame` alone. Nothing is carried between frames: there is no TAA, no temporal anything, and no `useState` driving visuals.
- All randomness comes from `mulberry32` streams seeded at module level (`src/common/rng.ts`). `Math.random()` and `Date.now()` are never used.
- Grain and dither are a fixed integer hash (pcg3d) of pixel position and `frame % 600`.

### Seamless loops

- **Horizon Streaks.** Dashes slide by `speed × period × phase`, and `speed` is a whole number (2–5), so the pattern moves a whole number of repeats per loop. Head points use per-line windows that are a whole number of periods long. Bokeh follow sin and cos paths with whole-number frequencies. The camera sway uses whole-number cycles.
- **Server Bokeh.** The rack pattern (3 cabinets at 3 depths) repeats with spacing S = 1.8 m. The camera drifts exactly 1·S per loop. Every LED blink period divides 600 (4, 5, 6, … 300, 600). Focus breathing and micro-sway are one sine cycle each.
- **Glass Block.** Blob paths are noise sampled around a circle in time, `n(c + R·(cos 2πt, sin 2πt))`. The fbm offset and grid ripple also travel on closed circles.

`--props='{"loopTest":true}'` makes every composition 601 frames long so you can render frame 600 and compare it with frame 0.

### Look notes

- **Horizon Streaks** (`src/horizon`)
  - 3,000 instanced ribbons, each with 72 segments. They are expanded in screen space in the vertex shader. Ribbon width = physical width + a depth-dependent circle of confusion, and intensity is energy-conserving, so near streaks are very soft and far ones are hairline.
  - Moving dashes are computed in the shader.
  - Several hundred head sprites, 6 large soft bokeh discs, a sky/horizon shader, mip-chain bloom, and a hue-preserving tone curve.
- **Server Bokeh** (`src/server`)
  - Procedural rack fronts: rails, screw heads, made-up tick marks, switches with LED sockets and SFP cages, drive bays, and lit fibre bundles. There are two rows across an aisle.
  - The scene renders rgb plus CoC. A half-res mip-mapped copy feeds a 64-tap golden-angle gather DoF.
  - About 36,000 LEDs (18 racks × 2 rows) are drawn as sprites. Near focus they are round hot dots at full res. Out of focus they become **soft round** bokeh discs sized by CoC (the edge softens and a gaussian core blends in as blur grows, so big discs melt together), with alpha falling as size grows, drawn at quarter res for speed. (The original brief asked for hexagonal bokeh; it was changed to soft circles on a follow-up request.)
  - Bloom, vignette and grain finish the image.
- **Glass Block** (`src/glass`)
  - Six drifting blobs plus looping fbm feed a colour ramp.
  - A grid of 70 bevelled square blocks sits on top. Each block shows an inverted, magnified, facet-refracted lookup of the gradient, with top-left lighting (bright corner, dark opposite corner), a specular glint on the bevel, and a soft glow.

## Banding check

- All looks render into half-float targets. Every look ends with a ±1/255 triangular dither applied after tonemapping and sRGB encoding, plus about 2% monochrome grain. The grain is an integer hash of pixel position and `frame % 600`.
- The check ran on the **encoded mp4s**, not the preview. For each preview, frame 300 was decoded with ffmpeg. 1D profiles were read across the blue sky (Horizon), the blurred left racks and the near-right blur (Server, both colourways) and the blobs (Glass, both). Contrast-stretched crops of the same regions were also inspected.
- Results:
  - Sky: blue rises 187 → 228 over 150 rows, with a mean step of 0.49 code values.
  - Server blurs: mean step 0.33–0.8.
  - No plateau-and-jump staircase was visible in any stretched crop.
  - Glass profiles step only at the glass-block edges, which is the intended pattern.
- The stretched crops looked smooth, with no contour lines.

## Adding a colourway

1. Add a row to the right array in `src/colorways.ts`: `HORIZON_COLORWAYS`, `SERVER_COLORWAYS` or `GLASS_COLORWAYS`. The `id` is the composition id: letters, digits and `-` only.
2. That's it. `Root.tsx` registers a `<Composition>` for every row. Render it with the commands above.

For example, a green server room:

```ts
{ id: "ServerBokeh-BlueGreen", light: "#2A6AD8", led: "#40FF90", ledAlt: "#E8FFF0" },
```

## Completion checklist

- [x] Five compositions in one Remotion project, 30 fps, 600 frames, 3840×2160.
- [x] Built entirely in code. No MCP servers, no assets, no logos or brand marks, no readable text (rack marks are tiny bars and dots).
- [x] Remotion with `@remotion/three` on WebGL2 (not WebGPU), and `--gl=angle` set in the config.
- [x] One data row per colourway (`src/colorways.ts`).
- [x] Deterministic. All randomness is seeded `mulberry32` at module level; no `Math.random()`, `Date.now()`, R3F clock or `useState` visuals; no TAA, temporal AO or accumulation.
- [x] **Step 1** (ffprobe): all 5 previews are 1280×720, 30/1, 20.000 s, h264, yuv420p, 600 frames, no audio.
  - Did not pass first time. Remotion had muxed a silent AAC track, which also made the duration 20.053 s.
  - Fixed by remuxing the video stream with `-c:v copy -an`, so the video was not re-encoded, and adding `Config.setMuted(true)` for future renders.
- [x] **Step 2** (loop): with `--props='{"loopTest":true}'`, frame 600 is pixel-identical to frame 0 for all 5. Wrap smoothness was also checked on PNGs: Glass 599→0 differs by 0.98, against 0.97 for 0→1 and 300→301. In the mp4 the wrap shows a small bump from the keyframe only.
- [x] **Step 3** (determinism): for all 5, frame 300 rendered alone from a cold start is **byte-identical** to frame 300 from a 3-thread sequence render, and to the still from the preview run.
- [x] **Step 4** (banding): measured on frames from the encoded mp4s; see above.
- [x] **Step 5** (content): 5 evenly spaced frames per preview were inspected.
- [x] **Steps 6 and 7**: self-comparison, then three rounds of fresh-sub-agent comparison against the references (see the delivery notes).
- [x] 720p previews and PNG stills of all 5.
- [x] Project zip without `node_modules`, `.git`, `refs/` or render output. `npm install && npx remotion studio` was tested from a clean copy.

## Project layout

```
remotion.config.ts        GL=angle, png intermediates, h264/yuv420p/CRF16
src/index.ts, Root.tsx    composition registration (one per colourway row)
src/colorways.ts          one data row per version
src/Looks.tsx             composition components
src/common/               GLLoop (ThreeCanvas driver), FullscreenPass, Bloom, rng, noise, GLSL chunks
src/horizon/              Horizon Light Streaks
src/server/               Defocused Server Rack (layout.ts = racks, LEDs, blink tables)
src/glass/                Glass Block Gradient
```
