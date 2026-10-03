# Horizon Light Streaks · Defocused Server Rack · Glass Block Gradient

One Remotion project with five 20-second seamless loops: 30 fps, 600 frames, 16:9. Compositions are defined at 3840×2160.
Everything is built in code with three.js on WebGL2, inside `@remotion/three`'s `<ThreeCanvas>`. There are no MCP servers, no image assets, no logos and no readable text.

| Composition id | Delivered file | Look | Engine |
|---|---|---|---|
| `HorizonStreaks` | `HorizonStreaks.mp4` | Horizon Light Streaks, blue | three.js 3D: instanced ribbons, head sprites, bokeh, bloom |
| `ServerBokeh-BlueLime` | `ServerBokeh_BlueLime.mp4` | Defocused Server Rack, blue and lime | three.js 3D: procedural racks, CoC gather DoF, hexagonal bokeh sprites |
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

RENDER_TIME_TABLE

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
  - About 1,400 head sprites, 26 bokeh discs, a sky/horizon shader, mip-chain bloom, and a hue-preserving tone curve.
- **Server Bokeh** (`src/server`)
  - Procedural rack fronts: rails, screw heads, made-up tick marks, switches with LED sockets and SFP cages, drive bays, and lit fibre bundles. There are two rows across an aisle.
  - The scene renders rgb plus CoC. A half-res mip-mapped copy feeds a 64-tap golden-angle gather DoF.
  - About 9,000 LEDs are drawn as sprites. Near focus they are round hot dots at full res. Out of focus they become **hexagonal** bokeh sized by CoC, with alpha falling as size grows, drawn at quarter res for speed.
  - Bloom, vignette and grain finish the image.
- **Glass Block** (`src/glass`)
  - Six drifting blobs plus looping fbm feed a colour ramp.
  - A grid of 70 bevelled square blocks sits on top. Each block shows an inverted, magnified, facet-refracted lookup of the gradient, with top-left lighting (bright corner, dark opposite corner), a specular glint on the bevel, and a soft glow.

## Banding check

BANDING_SECTION

## Adding a colourway

1. Add a row to the right array in `src/colorways.ts`: `HORIZON_COLORWAYS`, `SERVER_COLORWAYS` or `GLASS_COLORWAYS`. The `id` is the composition id: letters, digits and `-` only.
2. That's it. `Root.tsx` registers a `<Composition>` for every row. Render it with the commands above.

For example, a green server room:

```ts
{ id: "ServerBokeh-BlueGreen", light: "#2A6AD8", led: "#40FF90", ledAlt: "#E8FFF0" },
```

## Completion checklist

CHECKLIST

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
