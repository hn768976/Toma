# Data Wall · Censored Terminal · Particle Terrain

Remotion + three.js (`@remotion/three`, WebGL2) motion graphics: three looks, five compositions,
all defined at **3840×2160, 30 fps**.

| Composition id | Look | Length | Preview file |
|---|---|---|---|
| `DataWall-Slate` | 1 · Data Wall | 600 frames (20 s), seamless loop | `DataWall_Slate.mp4` |
| `CensoredTerminal-Cyan` | 2A · Censored Terminal | 450 frames (15 s), story | `CensoredTerminal_Cyan.mp4` |
| `ClassifiedTerminal-Amber` | 2B · Classified Terminal | 450 frames (15 s), story | `ClassifiedTerminal_Amber.mp4` |
| `ParticleTerrain-BlueEmber` | 3A · Particle Terrain | 600 frames (20 s), seamless loop | `ParticleTerrain_BlueEmber.mp4` |
| `ParticleTerrain-Teal` | 3B · Particle Terrain | 600 frames (20 s), seamless loop | `ParticleTerrain_Teal.mp4` |

## Setup

```bash
npm install
npx remotion studio          # preview (drawn at half resolution in the Studio to stay interactive)
```

Node 18+ is required. All versions in `package.json` are pinned.

### GPU / Chromium GL flag

Everything is WebGL2 (not WebGPU). Headless Chromium must use ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets this (`Config.setChromiumOpenGlRenderer("angle")`), so the
commands below work as-is; the flag is repeated in them for clarity. On a machine with a real GPU,
ANGLE uses it; without one, Chromium falls back to SwiftShader (software). That works but is slow
(see the timings below).

## Render at 4K (final masters)

```bash
npx remotion render src/index.ts DataWall-Slate            out/DataWall_Slate_4K.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts CensoredTerminal-Cyan     out/CensoredTerminal_Cyan_4K.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts ClassifiedTerminal-Amber  out/ClassifiedTerminal_Amber_4K.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts ParticleTerrain-BlueEmber out/ParticleTerrain_BlueEmber_4K.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts ParticleTerrain-Teal      out/ParticleTerrain_Teal_4K.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

(For a mezzanine master use `--codec=prores --prores-profile=4444` instead of H.264.)

### 6K stills (6000×3375)

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375. Everything resolution-dependent
(DoF radius, line widths, point sizes, grain) is expressed relative to the output height, so the
still matches the video.

```bash
npx remotion still src/index.ts DataWall-Slate            out/DataWall_Slate_6K.png            --frame=300 --scale=1.5625 --gl=angle
npx remotion still src/index.ts CensoredTerminal-Cyan     out/CensoredTerminal_Cyan_6K.png     --frame=400 --scale=1.5625 --gl=angle
npx remotion still src/index.ts ClassifiedTerminal-Amber  out/ClassifiedTerminal_Amber_6K.png  --frame=400 --scale=1.5625 --gl=angle
npx remotion still src/index.ts ParticleTerrain-BlueEmber out/ParticleTerrain_BlueEmber_6K.png --frame=300 --scale=1.5625 --gl=angle
npx remotion still src/index.ts ParticleTerrain-Teal      out/ParticleTerrain_Teal_6K.png      --frame=300 --scale=1.5625 --gl=angle
```

### 720p previews

`scripts/render-previews.sh [outDir]` renders all five at `--scale=0.3333333333333333`
(exactly 1280×720; the WebGL canvas really renders at 1280×720, it is not a downscale) and saves
a 720p PNG still of each (on the held label for the stories).

## Measured render times

@@TIMINGS@@

## Verification

@@VERIFY@@

## How it works

### Determinism

Every value on screen is a function of `useCurrentFrame()` only:

- `src/lib/Stage.tsx` hosts each look in `<ThreeCanvas>`. A priority `useFrame` callback takes over
  R3F's render, but ignores R3F's clock; it calls `look.render(frame)` with the Remotion frame.
- All randomness comes from `mulberry32` generators seeded at module level, or from integer hashes
  of (element id, frame) in the shaders. There is no `Math.random()`, `Date.now()` or `useState`
  driving visuals, and nothing is carried between frames.
- The terminal's Canvas 2D screens are cleared and redrawn from scratch every frame.
- No TAA. The terminal whip's motion blur averages 10 deterministic sub-frames (180° shutter).
- Grain and dither are hashes of (pixel, `frame % 600`) for the loops and (pixel, `frame % 450`)
  for the stories.

### Loops

- **Data Wall:** each band stack has its own seeded template that repeats every `BLOCK_L` along x.
  The camera tracks exactly one block in 600 frames. Glyph changes, flicker, glow-block slots and
  line cycles are whole numbers of cycles per 600 frames and are seeded by the element's template
  id (its position modulo the block).
- **Particle Terrain:** the height field tiles along the travel direction (periodic noise whose
  lattice period divides the tile, plateaus wrapped modulo the tile). Each of the 900,000 dots
  keeps its terrain coordinate and is drawn at `mod(s - s_camera, depth)`, so dots that pass under
  the camera re-enter at the far end inside the haze. The camera moves exactly one tile in
  600 frames. Node pulses, dust drift and the sway are whole cycles.

### Post (shared, `src/lib/post.ts`)

1. **Scene** into a half-float HDR target (linear light).
2. **Depth of field** (Data Wall, Terminal): non-temporal gather with a fixed 40-tap
   golden-angle pattern, at half resolution, merged with the sharp image by CoC. Both scenes are a
   single plane, and for a plane 1/depth is affine in screen space. The circle of confusion is
   therefore computed exactly per tap from three coefficients, with no depth buffer.
   The terrain does its DoF in the point shader instead: points grow into energy-conserving
   discs.
3. **Bloom:** a dual-filter mip chain.
4. **Composite:** chromatic aberration (radial, plus the terminal's RGB-split glitch), bloom,
   grade, soft-clip, vignette, sRGB, then grain (1.5%) and ±1/255 triangular dither last.

### Files

```
src/versions.ts            one data row per version (colours, terminal text, stamp word, DoF)
src/Root.tsx               composition registration
src/lib/                   Stage (R3F host), post pipeline, fonts, seeded random, colour helpers
src/datawall/              layout + template generation, 5x7 glyph atlas, renderer
src/terminal/              story timeline, Canvas 2D screen drawing, renderer (camera, whip, DoF)
src/terrain/               height field / plateaus / nodes, renderer (point shaders, sky)
public/fonts/              OFL fonts (IBM Plex Mono SemiBold, Oswald Bold) + licences
scripts/                   render-previews.sh, stills.mjs (PNG frames, cold-start option), sheet.sh
```

## Add a colourway

1. Open `src/versions.ts` and copy a row in `DATAWALL_VERSIONS`, `TERMINAL_VERSIONS` or
   `TERRAIN_VERSIONS`.
2. Give it a new `id` (letters, digits and dashes) and change the colours. The colours are sRGB
   hex and are converted to linear light internally.
3. Root.tsx maps over these arrays, so the new composition appears automatically.

## Change the terminal text or stamp word

In `src/versions.ts`, in the terminal row:

- `lines` holds exactly three strings, typed at 25 characters/second. Keep each line to about
  50 characters or fewer: the line must fit the 4096 px screen canvas at the current font size.
  Otherwise lower `TEXT_LAYOUT.fontPx` in `src/terminal/screenContent.ts`.
- `stamp` is the label word. It is automatically scaled to fit the strip.

Redaction bars group words at seeded spaces and adapt to any text. The story timing (typing
start per line, highlight sweeps, whip, label) lives in `src/terminal/timeline.ts`.

## Fonts

Both fonts are under the SIL Open Font License 1.1 and are bundled in `public/fonts` with their
licences. The render is held (`delayRender`) until both are loaded, so no frame is ever drawn
with a fallback font.

- **IBM Plex Mono SemiBold:** terminal text.
- **Oswald Bold:** the stamp word.

## Completion checklist

@@CHECKLIST@@
