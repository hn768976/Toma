# Glow Gradient · Glitch Code · Light Curtain

Five 20 s seamless-loop motion backgrounds (30 fps, 600 frames, 16:9, composed at
3840×2160) in **one Remotion project**.

| Composition id | Look | Engine | Output name |
|---|---|---|---|
| `GlowGradient-Aurora` | 1A Glow Gradient, aurora (as reference) | Canvas 2D | `GlowGradient_Aurora` |
| `GlowGradient-Sunset` | 1B Glow Gradient, warm | Canvas 2D | `GlowGradient_Sunset` |
| `GlitchCode-MonoRGB` | 2 Glitch Code | Canvas 2D | `GlitchCode_MonoRGB` |
| `LightCurtain-MagentaFire` | 3A Light Curtain, magenta-fire (as reference) | fragment shader, three.js plane, WebGL2 | `LightCurtain_MagentaFire` |
| `LightCurtain-BlueTeal` | 3B Light Curtain, blue-teal | same | `LightCurtain_BlueTeal` |

Everything is built in code: no MCP servers, no images, no logos. The only bundled
asset is the OFL font **JetBrains Mono** (`public/fonts`, licence text included).
All code text on screen is invented (`src/codegen.ts`).

## Install and open

```bash
npm install
npx remotion studio          # Studio previews at 1/2 resolution to stay responsive
```

Node 20+ (tested on 22). `package.json` pins every version.

## Render commands (4K, 3840×2160)

Run these from the project root. Output goes to `out/`.

```bash
npx remotion render src/index.ts GlowGradient-Aurora      out/GlowGradient_Aurora.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render src/index.ts GlowGradient-Sunset      out/GlowGradient_Sunset.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render src/index.ts GlitchCode-MonoRGB       out/GlitchCode_MonoRGB.mp4       --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render src/index.ts LightCurtain-MagentaFire out/LightCurtain_MagentaFire.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render src/index.ts LightCurtain-BlueTeal    out/LightCurtain_BlueTeal.mp4    --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
```

**6K stills** (6000×3375 = scale 1.5625; frame 300 shown, any frame 0–599 works):

```bash
npx remotion still src/index.ts GlowGradient-Aurora out/GlowGradient_Aurora_6k.png --frame=300 --scale=1.5625 --gl=angle
```
(Same pattern for the other four composition ids.)

**720p previews** (exactly 1280×720; 3840 × 1/3 = 1280, 2160 × 1/3 = 720):

```bash
npx remotion render src/index.ts GlowGradient-Aurora out/GlowGradient_Aurora.mp4 --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
```
or `tools/bundle.sh && tools/render-previews.sh` for all five plus 720p PNG stills.

### Chromium GL flag

Light Curtain uses **WebGL2**. Headless Chromium needs the ANGLE backend:
`--gl=angle` (already set in `remotion.config.ts` with
`Config.setChromiumOpenGlRenderer("angle")`, so the flag is optional on the CLI).
Without a GPU ANGLE falls back to SwiftShader (software), which is what every
timing below was measured on. On a machine with a GPU, ANGLE uses it and Light
Curtain renders far faster. Not WebGPU. The two Canvas 2D looks do not use the GPU at all.

The config also points Remotion at a Playwright headless shell when it exists at a
sandbox path; elsewhere Remotion downloads its own browser as usual.

## How it works

* **Canvas size follows the render scale.** `Canvas2D` makes its backing store
  `3840·devicePixelRatio` wide and draws in 4K design units, so a 1/3-scale preview
  really draws 1280×720 and a 4K render draws 3840×2160. No downscaling of a 4K canvas.
* **Determinism.** Every value comes from `useCurrentFrame()` (as `frame % 600`) and
  seeded data built at module level (`mulberry32` in `src/rng.ts`). No
  `Math.random()`, no `useFrame` clock, no `Date.now()`, no state driving visuals, no
  carry-over between frames. Dither/grain come from fixed noise tiles read at an
  offset hashed from `frame % 600` (Canvas 2D) or an integer hash of pixel and frame
  (shader). The only `useState` is Glitch Code's font-loaded flag, which gates the first draw.
* **Loops.** Blob paths, breathing, line slides, pulses, code scroll, ribbon sway and
  travelling waves all use whole numbers of cycles per 600 frames; glitch events
  wrap around the loop point. Frame 600 equals frame 0 (checked pixel-for-pixel).
  The optional `--props='{"frames":601}'` only lengthens the composition for that test.
* **Glow Gradient.** 9 additive blobs from 512 px soft sprites (no `ctx.filter`), two light lines,
  final dither ±1/255 and 2% grain.
* **Glitch Code.** Seeded code columns → three channel-tinted layers composed with
  `lighter` → band shifts/smears/blurs, local smears, blocks → bloom, block texture,
  scanlines → static (3%, coarse) + dither. The schedule is in `src/glitchSchedule.ts`:
  a clean moment every 5 s (0.5 s crisp, snap down, ~1.8 s ramp back up).
* **Light Curtain.** `src/curtainShader.ts`: 60 ribbons per pixel (8 broad, 16 medium,
  36 thin), parameters from `src/curtainParams.ts` passed as uniforms. Sway samples
  smooth functions around a circle in time (cos/sin of the loop angle). Sum in linear light,
  soft hue-preserving tone-map, dither ±1/255 + 1.5% grain after tone-mapping.

## Timings (this sandbox: 4 CPU cores, no GPU, software rendering)

Per-frame render time via `tools/timing.mjs` (one browser tab, warm-up frame excluded, median):

| Composition | 720p per frame | 4K per frame | 4K estimate, 600 frames |
|---|---|---|---|
| GlowGradient-Aurora | 0.18 s | **0.81 s** (timed) | ≈ 8 min |
| GlowGradient-Sunset | 0.16 s | ≈ 0.7 s (est.) | ≈ 7 min |
| GlitchCode-MonoRGB | 0.19 s | **1.01 s** (timed) | ≈ 10 min |
| LightCurtain-MagentaFire (3A) | 1.75 s | **14.4 s** (timed) | ≈ 2.4 h |
| LightCurtain-BlueTeal (3B) | 1.71 s | ≈ 14 s (est.) | ≈ 2.4 h |

The two timed 4K frames requested are Glitch Code (1.01 s) and 3A (14.4 s). Estimates
come from the measured 720p→4K ratio of the same look (×4.5 Glow, ×5.4 Glitch, ×8.3 Curtain);
add PNG encode and H.264 encode. Software GL already uses all cores, so more tabs did not
help on this machine (the 720p 3A preview took 1008 s with 4 tabs, vs ≈1050 s single-tab
extrapolated). With a real GPU expect Light Curtain to be many times faster.

## Banding check

Done on frames decoded **from the encoded mp4**, not the preview:

* contrast-stretched dark range (levels 0–48 → 0–255, `tools/stretch.py`), inspected for
  rings or steps in blob falloffs, dark base, ribbon edges;
* numeric: in slowly varying dark regions, the fraction of 9×9-averaged values that sit
  within 0.08 of an integer level (a smooth dithered ramp gives ≈0.16, hard banding gives much more).

Results are in the table in "Completion checklist".

## Completion checklist

Measured on the 720p previews in this sandbox (all from `tools/verify-all.sh` / `verify-curtain.sh`; logs were kept in `out/`).

| Check | 1A Aurora | 1B Sunset | 2 Glitch Code | 3A Magenta-Fire | 3B Blue-Teal |
|---|---|---|---|---|---|
| ffprobe: 1280×720, 30/1, 20.0 s, h264, yuv420p, no audio | pass | pass | pass | pass | pass |
| Loop: frame 600 == frame 0 (pixel-for-pixel, 0 differing px) | pass | pass | pass | pass | pass |
| Cold-start frame 300 == frame 300 of a 4-tab full render, byte-for-byte | pass | pass | pass (also heavy-glitch frames 330, 345) | pass | pass |
| Banding on mp4 frames (stretch inspection + integer-proximity ≈0.16 = smooth) | smooth (0.156–0.164) | smooth (0.160–0.163) | n/a (hard-edged, 3% grain) | smooth (0.155–0.177) | smooth (0.161–0.176) |
| Motion 270–330 (grain-free block means): spike ratio of 2nd difference (max/mean) | 1.3 | 1.1 | 1.5 (events by design) | 1.1 | 1.1 |
| Contact sheet (5 evenly spaced frames) shows what it should | yes | yes (warm, no cyan/blue) | yes (frames 25/125/225/325/425; 225 is nearly clean) | yes | yes (cool, no warm colours) |

* Byte-for-byte means the PNG frame from `remotion still --frame=300` in a fresh browser equals frame 300
  of `remotion render --sequence` (4 parallel tabs, frames out of order). The mp4 itself is not compared
  byte-for-byte, only decoded from for the banding / motion checks.
* The Glitch Code default contact frames (0/150/300/450/599) land between the clean moments, so its sheet
  uses frames 25/125/225/325/425.
* The motion check shows no pops or flicker spikes. It cannot tell a 2- from a 6-frame glitch event; that
  is guaranteed by construction (`len = 2 + floor(5·rand)` in `glitchSchedule.ts`, bursts share start and length).
* Mp4 sizes at CRF 16: Glow ≈ 33 MB (grain is expensive to encode), Glitch ≈ 73 MB, Curtain ≈ 10 MB each.

## How to add a colourway

1. Open `src/colourways.ts`. Each look has one table: `GLOW_VERSIONS`, `CODE_VERSIONS`,
   `CURTAIN_VERSIONS`. **One row per version.**
2. Copy a row, give it a new `id`, and change the colours:
   * Glow: `base` (page gradient), `blobs` (one colour per blob slot, 9 slots, see
     `BLOB_SLOTS` in `GlowGradient.tsx`), `line` (far / hot centre / near).
   * Glitch: `text` and the three `channels` colours.
   * Curtain: `ramp` (base → tip, 5 colours), `bg` (bottom → top), `glow`.
3. `Root.tsx` registers one composition per row automatically (`GlowGradient-<id>`, …). Add the
   output name to `NAMES` in `tools/render-previews.sh` if you use that script.
4. Re-run the checks in `tools/` (see below), especially the banding check for dark colourways.

## Tools (`tools/`)

| Script | What |
|---|---|
| `bundle.sh` | one-time bundle into `out/bundle` (other tools render from it) |
| `render-previews.sh` | five 720p mp4s + stills |
| `verify.sh`, `verify-all.sh` | ffprobe, 0==600 loop check, cold-start vs full-render byte comparison, mp4 banding stats, contact sheets |
| `analyze.py`, `motion.py`, `stretch.py`, `cmp.py`, `sheet.py` | analysis helpers |
| `timing.mjs` | per-frame render time |

## Deviations from the written brief (matched to the reference look instead)

The reference clips were matched by eye and by independent frame comparisons; where the written numbers and the
reference disagreed, the reference won:

* **Glitch Code text size**: three columns (hero 3.4 %, others 2.4 %) of the frame height instead of 3–4 columns at
  1.6 % and 2.4 %: the reference text is much larger and sparser. Font stays monospace JetBrains Mono (the
  reference uses a proportional face).
* **Glitch Code extras**: red/cyan default fringe (wider than the brief's 1–2 px), local smear rectangles
  (strip stretched into a region, biased to the left edge), bloom and horizontal softening, lifted blue-grey blacks
  with a faint mosaic texture. The scanline period is 9 design px so it looks the same at 720p and 4K.
* **Glow Gradient layout**: light is concentrated as one wide sweep rising from the bottom edge (blue → cyan →
  violet → hot pink → dark maroon), broad deep-blue washes top right and left, near-black elsewhere. The lines sit
  0.6 % from the frame edge instead of 1.5 % and the top line carries no pink.
* **Light Curtain**: 8 broad, 16 medium and 36 thin ribbons (12 of the thin ones bright filaments); a bright rim on
  the crisp side of each ribbon; hue-preserving tone-map; early-out for ribbons far from the pixel (exact to <1e-9,
  ≈3.5× faster).
* **Dither/grain** for the Canvas 2D looks is a pixel pass (`getImageData`, fixed noise tile at a frame-hashed
  offset) rather than a drawn overlay. Same result, exact rounding. Grain stays at the briefed 2 % / 3 % / 1.5 %,
  and reviewers did notice it as texture in the darks.
* **Previews** were rendered with PNG intermediates (not JPEG) to avoid blocking in dark gradients.
