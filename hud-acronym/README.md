# HUD Acronym Rings — Remotion + three.js template

A trending tech/finance acronym in glowing 14-segment display letters (DSEG14 Classic)
inside rotating HUD rings, floating over a glowing circuit board in perspective, with a
gentle camera sway, depth of field and bloom.

- **9 compositions**, one per data row in `src/acronyms.ts`
- **3840×2160, 30 fps, 600 frames (20 s) seamless loops**
- 3D with `@remotion/three` (three.js, WebGL2). No PixiJS, no WebGPU.
- Same seed, board, rings and camera for every composition; only the word changes.

> **Composition IDs use a hyphen:** `HudAcronym-DEFI`, `HudAcronym-AGI`, … Remotion only
> allows `a-z A-Z 0-9 -` in composition IDs, so `HudAcronym_DEFI` is rejected. The output
> files keep the underscore (`HudAcronym_DEFI.mp4`).

| Composition | Word |
|---|---|
| `HudAcronym-DEFI` | DEFI |
| `HudAcronym-CBDC` | CBDC |
| `HudAcronym-DAO` | DAO |
| `HudAcronym-AGI` | AGI |
| `HudAcronym-RAG` | RAG |
| `HudAcronym-NPU` | NPU |
| `HudAcronym-MFA` | MFA |
| `HudAcronym-KYC` | KYC |
| `HudAcronym-AI` | AI |

## Setup

```bash
npm install
npx remotion studio        # preview (Studio draws the WebGL buffer at 1920 px wide for speed)
```

Node 18+ is required (tested on Node 22).

### Chromium GL flag

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`, which is the same as
passing `--gl=angle` on the CLI. That is the reliable WebGL2 backend in headless Chromium. On
machines without a GPU, ANGLE falls back to SwiftShader (slower, but the output is the same).
When you use the Node APIs instead of the CLI, pass `chromiumOptions: { gl: "angle" }`.

## Render at 4K

Each composition (H.264, CRF 16, yuv420p, PNG intermediate frames; set in `remotion.config.ts`):

```bash
npx remotion render HudAcronym-DEFI out/HudAcronym_DEFI.mp4 --gl=angle
npx remotion render HudAcronym-CBDC out/HudAcronym_CBDC.mp4 --gl=angle
npx remotion render HudAcronym-DAO  out/HudAcronym_DAO.mp4  --gl=angle
npx remotion render HudAcronym-AGI  out/HudAcronym_AGI.mp4  --gl=angle
npx remotion render HudAcronym-RAG  out/HudAcronym_RAG.mp4  --gl=angle
npx remotion render HudAcronym-NPU  out/HudAcronym_NPU.mp4  --gl=angle
npx remotion render HudAcronym-MFA  out/HudAcronym_MFA.mp4  --gl=angle
npx remotion render HudAcronym-KYC  out/HudAcronym_KYC.mp4  --gl=angle
npx remotion render HudAcronym-AI   out/HudAcronym_AI.mp4   --gl=angle
```

All 9 in one batch (bundles once):

```bash
npx remotion bundle --out-dir=build
for id in DEFI CBDC DAO AGI RAG NPU MFA KYC AI; do
  npx remotion render build HudAcronym-$id out/HudAcronym_$id.mp4 --gl=angle
done
```

720p preview (`--scale=1/3` gives exactly 1280×720):

```bash
npx remotion render HudAcronym-DEFI out/HudAcronym_DEFI.mp4 --gl=angle --scale=0.3333333333333333
```

The delivered previews were made with the same renderer, as a PNG sequence that was then
encoded with x264. That way frame 300 of the full render could be compared byte for byte
with a cold still:

```bash
npx remotion render HudAcronym-DEFI out/seq/DEFI --sequence --image-format=png --scale=0.3333333333333333 --concurrency=4
ffmpeg -framerate 30 -i out/seq/DEFI/element-%03d.png -c:v libx264 -crf 16 -pix_fmt yuv420p -preset slow -movflags +faststart out/HudAcronym_DEFI.mp4
```

## Stills (6000×3375)

```bash
npx remotion still HudAcronym-DEFI out/HudAcronym_DEFI_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375. Change the composition ID for other words.)

## Render time

Measured on the build machine: **4 vCPU, no GPU** (ANGLE → SwiftShader software WebGL2),
720p (`--scale=0.3333333333333333`), `--concurrency=4`, 600 frames:

| Composition | Wall time | Per frame (wall) | Per frame per render thread |
|---|---|---|---|
| HudAcronym-DEFI | 553 s | **0.92 s** | ~3.7 s |
| HudAcronym-AGI | 556 s | **0.93 s** | ~3.7 s |
| HudAcronym-AI | 560 s | **0.93 s** | ~3.7 s |

**4K estimate.** 4K is 9× the pixels of 720p, and the cost is almost entirely per-pixel
shading (the scene geometry is small). On the same CPU-only machine that is **about 8–9 s per
frame**, or roughly 80–90 min per composition and 12–14 h for all 9. This is an estimate;
4K was not rendered here.

On a machine with a real GPU behind ANGLE, expect well under 1 s per frame at 4K. A 4K
still with SwiftShader can need more than the 30 s default page timeout, which is why
`remotion.config.ts` raises the delayRender timeout to 120 s.

## Add an acronym

Add one row to `src/acronyms.ts`:

```ts
{ id: "ZKP", text: "ZKP" },
```

That creates the composition `HudAcronym-ZKP`. `id` may contain only letters, digits and `-`.
The word is upper-cased and auto-sized:
- 3 or more letters: the full segment cells fill 60% of the inner ring's diameter.
- 1–2 letters: capped at 45%.

Any character in the DSEG14 font works (A–Z, 0–9 and some symbols).

## How it's built

| File | What |
|---|---|
| `src/acronyms.ts` | the data rows |
| `src/Root.tsx` | one `<Composition>` per row |
| `src/hud/HudAcronym.tsx` | font loading (`delayRender`) and `<ThreeCanvas>` |
| `src/hud/HudScene.tsx` | scene graph and the post chain; `LOOK` holds all look-dev values |
| `src/hud/board.ts` | seeded PCB routing: 8-direction grid, 45° bends, pads, vias, pulse traces |
| `src/hud/rings.ts` | ring/arc/tick definitions and anti-aliased line geometry |
| `src/hud/wordTexture.ts` | DSEG14 word drawn into a 4096 px RGBA texture (lit / ghost segments / glow) |
| `src/hud/flicker.ts` | fixed segment-flicker events |
| `src/hud/shaders.ts` | all GLSL |

**Render passes**, all in half-float targets:
1. The board is rendered with its view distance in alpha, then gets a separable
   depth-of-field blur. The blur depends on distance from the focus plane, plus extra blur
   toward the frame edges.
2. The outer rings get a wide, out-of-focus blur at half resolution.
3. The word, inner ring and middle rings are rendered sharp on top.
4. Bloom: a 7-level soft-threshold downsample/upsample chain.
5. ACES filmic tonemapping, then sRGB.
6. ±1/255 dither and about 2% triangular grain, hashed from (pixel, frame % 600).

Bloom only picks up emissive content, because the board base is far below the threshold.
There is no TAA or any other temporal effect.

**The word.** It uses DSEG14 Classic Regular, drawn with a slightly tighter letter advance
and stretched to 1.45× height so the cells read tall and narrow, like the reference. Unlit
segments are shown faintly (the `~` glyph, all segments on). The core colour is `#D8FFFF`
with a `#4FE0F0` glow.

### Seamless loop (600 frames)

- Ring spins are whole turns. Swings use `sin(2π·k·p)` with integer k.
- The camera path uses frequencies 1 and 2.
- Each pulse makes a whole number of passes per loop.
- Flicker events are at fixed frames inside 0–599.
- Grain uses `frame % 600`.
- Everything uses `p = (frame % 600) / 600`, so frame 600 is identical to frame 0.

### Determinism

- Every on-screen value is computed from `useCurrentFrame()`.
- All randomness comes from `mulberry32`, seeded at module level.
- No `Math.random()`, `Date.now()`, R3F clock or `useState`-driven visuals.
- The single R3F `useFrame(…, 1)` callback is only the render hook that `<ThreeCanvas>`
  triggers once per frame through `advance()`. It reads the Remotion frame and never the
  clock.
- The font is loaded behind `delayRender` / `continueRender` before the word texture is drawn.

## Verification

### Banding check

Grab a frame **from the encoded mp4**, not the preview, and read pixel values across the
glow falloff:

```bash
ffmpeg -ss 10 -i out/HudAcronym_DEFI.mp4 -frames:v 1 check.png
# then read a row/column of pixel values outward from a bright ring edge; they must
# change smoothly (no flat plateaus followed by 1–2 level steps).
```

### Loop check

```bash
npx remotion still HudAcronym-DEFI f0.png   --frame=0   --props='{"loopCheck":true}' --scale=0.3333333333333333
npx remotion still HudAcronym-DEFI f600.png --frame=600 --props='{"loopCheck":true}' --scale=0.3333333333333333
cmp f0.png f600.png && echo identical
```

`loopCheck: true` makes the composition 601 frames long.

### Determinism check

Render frame 300 cold with `remotion still` and compare it byte for byte with frame 300 of a
full `--sequence --image-format=png` render.

## Completion checklist

- [x] 9 compositions from data rows, 3840×2160, 30 fps, 600 frames; same seed, board, rings and camera
- [x] 3D with `@remotion/three` and WebGL2 (`--gl=angle`); no WebGPU, no PixiJS, no MCP servers
- [x] DSEG14 Classic font (OFL, shipped with its licence), drawn into a 4096 px texture,
      with faint unlit segments and per-segment flicker at fixed frames
- [x] Word sizing: 60% of the inner ring's width for 3 or more letters, 45% for 1–2 letters
- [x] Rings: bright inner ring and hairline; dashed, long-arc and tick middle rings at
      different depths; 2 faint, defocused outer arcs past the frame edge
- [x] Board: `#03131A`, seeded 45° routing with pads and vias, brighter near the centre,
      data pulses travelling toward the rings, depth-of-field blur
- [x] Camera: closed sway path (yaw ±3°, pitch ±2°, slight push in/out), viewed slightly from below
- [x] Bloom on emissive only; ACES tonemapping; ±1/255 dither; about 2% grain from (pixel, frame % 600)
- [x] No `Math.random()`, `Date.now()`, R3F clock, `useState`-driven visuals or temporal effects
- [x] Loop check: frame 0 == frame 600, pixel for pixel (DEFI, AGI, AI)
- [x] Determinism: cold frame 300 == frame 300 of a full multi-threaded render, byte for
      byte (DEFI, AGI, AI)
- [x] Banding: glow falloff read from the encoded mp4 changes smoothly (DEFI, AGI, AI)
- [x] All 9 words render, read correctly and are centred at frame 300
- [x] Previews: 1280×720, h264, yuv420p, 30/1, 20.0 s, no audio
- [x] `npm install && npx remotion studio` works from a clean copy

## Licences

DSEG14 Classic © keshikan, SIL Open Font License 1.1. See `public/fonts/DSEG-LICENSE.txt`.
