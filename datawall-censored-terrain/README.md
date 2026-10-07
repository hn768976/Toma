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

Measured in a cloud container with **no GPU**. Chromium used ANGLE's software fallback
(SwiftShader) on a 4-vCPU Intel Xeon @ 2.8 GHz. Times are wall-clock per frame for a full
`remotion render` at concurrency 2, including PNG capture and H.264 encoding.

| Composition | 720p per frame (measured) | 4K per frame | 4K full clip, software GL (estimate) |
|---|---|---|---|
| `DataWall-Slate` | 0.98 s | ~6 s (estimate) | ~60 min |
| `CensoredTerminal-Cyan` | 1.31 s | ~8 s (estimate; the whip frames use 12–32 sub-frames) | ~60 min |
| `ClassifiedTerminal-Amber` | 1.31 s | ~8 s (estimate) | ~60 min |
| `ParticleTerrain-BlueEmber` | 1.69 s | **10.1 s (measured: one real 3840×2160 frame, frame 300, startup excluded)** | ~100 min |
| `ParticleTerrain-Teal` | 1.74 s | ~10.5 s (estimate) | ~105 min |

The 4K estimates scale each 720p time by the measured 3A ratio (10.1 s / 1.69 s ≈ 6×). That's
less than the 9× pixel count, because geometry and setup costs don't scale with resolution.

On a machine with a real GPU these drop sharply. The work is a few full-screen passes plus
~1 M points or ~100 k instanced quads, which a desktop GPU draws in milliseconds. Expect
encoding and capture to dominate, at roughly 0.3–1 s per 4K frame (an estimate; not measured
here). With `--concurrency` matched to the GPU, a 4K clip should take a few minutes.

Note: in the 720p preview the far horizon band of the terrain is a little brighter than in the
4K master. At 720p many distant dots are drawn at the 1.5 px minimum size, and the rasteriser
covers slightly more pixels than their nominal area. The 4K render is the reference look.

## Verification

All checks were run on the 720p renders in this container.

1. **File checks** (`ffprobe`). All five previews are h264, 1280×720, 30/1, yuv420p, with no
   audio stream. Durations: 20.000 s for the loops and 15.000 s for the stories. The 720p PNG
   stills are 1280×720. `--scale=0.3333333333333333` produced exactly 1280×720, so no
   downscale fallback was needed.
2. **Loop check.** Render with `--props='{"versionId":"<id>","loopCheck":true}'` (601 frames)
   and compare frames 0 and 600:
   ```bash
   node scripts/stills.mjs DataWall-Slate out/loop 0.3333333333333333 0,600 '{"versionId":"DataWall-Slate","loopCheck":true}'
   ```
   Frame 600 is pixel-identical to frame 0 for `DataWall-Slate`, `ParticleTerrain-BlueEmber`
   and `ParticleTerrain-Teal`.
3. **Same result every time.** Each frame was rendered on its own from a cold start (a fresh
   browser per frame) with `node scripts/stills.mjs <id> <dir> 0.3333333333333333 <frames> '<props>' --cold`.
   It was compared with the same frame from a multi-threaded `remotion render --sequence`
   (concurrency 2, frames rendered out of order). Results were byte-identical in decoded pixels:
   - frame 300 of all five compositions;
   - frame 100 (mid-typing) and frame 190 (inside the whip) of both stories.
4. **Banding**, read from frames decoded out of the encoded mp4s. Profiles were averaged over a
   31 px band to cancel the grain, then checked for flat runs followed by a jump (the signature
   of banding). None were found:
   - **Terrain skies (3A, 3B):** rise smoothly from ~11 to ~36 (8-bit) at no more than
     ~2.7 levels per row, the largest steps being dust specks.
   - **Data Wall glow falloff:** descends smoothly from 216 to 11.
   - **Label strip's blurred background (2A, 2B):** varies by ≤ 0.84 levels per pixel.
5. **Contact sheets**: five evenly spaced frames per composition, built with `scripts/sheet.sh` or
   ffmpeg `tile`. Checked against the brief. The typed text was also verified on the flat
   screen canvas: it matches the copy exactly, with the correct line breaks. "CENSORED" and
   "CLASSIFIED" are spelled correctly. There are no logos, seals or brands, and no words other
   than the given copy and the stamp.
6. **Motion.** Frame-to-frame difference around frame 300 varies by ≤ 9% (Data Wall) and ≤ 6%
   (terrain), so there is no stutter. The whip in frames 180–204 ramps smoothly up and down, with
   continuous sub-frame motion blur. The RGB-split glitch occupies exactly frames 191–194, and
   the background glitches last 2–3 frames each.

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

## Interpretation notes

- **Typing speed vs. window:** the three lines (142 characters) type at 25 characters/second
  each. At that rate, typing them one after another would need 5.7 s, but the window is
  0.7–4.5 s. So each line starts 0.65 s after the previous one, while that one is still typing,
  and each line has its own block cursor while it types. All text is complete by 3.9 s. Some
  letters land a few frames late, leaving brief gaps that fill in, as in the reference.
- **Data Wall "slightly upward":** a camera drifting upward cannot loop with a finite wall.
  The camera instead tracks purely sideways along the bands and is *aimed* upward along the
  wall. The wall ends at the top against dark space, where the network "beams" fan out from
  hubs, as in the reference.
- **Grid lines:** the terrain's dotted grid lines are flat (constant height) and cross through
  the hills, as in the reference.

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

- [x] 5 compositions at 3840×2160, 30 fps: loops 600 frames, stories 450 frames
- [x] three.js through `@remotion/three`, WebGL2, `--gl=angle`
- [x] Data Wall:
  - [x] instanced quads: glyph rows from a 5×7 dot-matrix atlas, barcode bars, dot strips, glow blocks
  - [x] network lines
  - [x] non-temporal DoF gather
  - [x] bloom, grade, vignette, dither, grain
- [x] Censored Terminal (2 versions):
  - [x] Canvas 2D screen redrawn per frame, with mipmaps and 16× anisotropy
  - [x] sub-pixel mask, scanlines, chromatic offset
  - [x] boot glitch → typing → redaction → whip (sub-frame motion blur, RGB split) → label with overshoot → hold with glitching background
- [x] Particle Terrain (2 versions):
  - [x] 900,000 points from one `Points` draw, with DoF in the shader
  - [x] plateaus, dotted grid lines
  - [x] nodes: 120 per tile, about 40 with vertical lines
  - [x] 3,000 dust specks, sky with haze
- [x] Seamless loops: frame 600 == frame 0 (verified)
- [x] Deterministic: cold frame == full-render frame, byte for byte (verified)
- [x] No `Math.random()`, `Date.now()`, `useState` visuals or TAA
- [x] Fonts are OFL, bundled, and loaded before the first frame
- [x] Dither ±1/255 and 1.5% grain from (pixel, frame % loop) only
- [x] Banding checked on the encoded mp4s
- [x] 720p previews and stills rendered; render times measured; 4K frame of 3A timed
- [x] `npm install && npx remotion studio` works from a clean copy
