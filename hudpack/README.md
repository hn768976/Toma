# Stock Screen · AI HUD · Particle Heart · Market Map · Loading HUD

One Remotion project with **8 compositions** made from 5 looks. Everything is
built in code: Canvas 2D, three.js (via `@remotion/three`) and PixiJS 8, on
WebGL2. All compositions are **3840×2160, 30 fps**.

| Composition id | Output file | Look | Engine | Length |
|---|---|---|---|---|
| `StockScreen-Teal` | `StockScreen_Teal.mp4` | angled market board, DoF | three.js + Canvas 2D texture | 600 f (20 s loop) |
| `AIHUD-WhiteOverlay` | `AIHUD_WhiteOverlay.mp4` | white AI dashboard on black | Canvas 2D | 600 f (20 s loop) |
| `ParticleHeart-Pink` | `ParticleHeart_Pink.mp4` | glitter burst → heart | PixiJS 8 | 300 f (10 s story) |
| `ParticleHeart-Red` | `ParticleHeart_Red.mp4` | 〃 | PixiJS 8 | 300 f |
| `ParticleHeart-Gold` | `ParticleHeart_Gold.mp4` | 〃 | PixiJS 8 | 300 f |
| `MarketMap-Blue` | `MarketMap_Blue.mp4` | tilted dotted world map + charts, DoF | three.js + Canvas 2D textures | 600 f (20 s loop) |
| `MarketMap-Gold` | `MarketMap_Gold.mp4` | 〃 | three.js + Canvas 2D textures | 600 f (20 s loop) |
| `LoadingHUD-WhiteOverlay` | `LoadingHUD_WhiteOverlay.mp4` | white data-loading HUD on black | Canvas 2D | 360 f (12 s story) |

Remotion composition ids may not contain underscores, so ids use a hyphen
and the rendered files use the underscore names.

## Setup

```bash
npm install
npx remotion studio        # preview (4K canvases are capped to half size in the Studio)
```

Node 18+ is required. `package.json` pins exact versions.

**Chromium GL flag.** WebGL2 needs ANGLE in headless Chromium. It is set in
`remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), which is
the same as passing **`--gl=angle`**. If you use the Node.js render APIs
(which ignore the config file), pass `chromiumOptions: { gl: "angle" }`.

## Rendering at 4K

```bash
npx remotion render StockScreen-Teal        out/StockScreen_Teal.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render AIHUD-WhiteOverlay      out/AIHUD_WhiteOverlay.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ParticleHeart-Pink      out/ParticleHeart_Pink.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ParticleHeart-Red       out/ParticleHeart_Red.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ParticleHeart-Gold      out/ParticleHeart_Gold.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render MarketMap-Blue          out/MarketMap_Blue.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render MarketMap-Gold          out/MarketMap_Gold.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render LoadingHUD-WhiteOverlay out/LoadingHUD_WhiteOverlay.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

For a mastering-grade file, use `--codec=prores --prores-profile=4444`
instead. Add `--concurrency=N` to suit your machine; on a real GPU the
WebGL looks are much faster than the software-GL timings below.

**Stills at 6000×3375** (25/16 of 4K):

```bash
npx remotion still ParticleHeart-Pink out/ParticleHeart_Pink_6K.png --frame=240 --scale=1.5625 --gl=angle
```

(Swap in any composition id and frame. Not rendered here, as requested.)

**720p previews** (how the delivered previews were made):

```bash
scripts/preview.sh <CompositionId> [concurrency]   # PNG sequence at --scale=1/3, then H.264 CRF 16 yuv420p
scripts/render-all.sh                              # all eight
python3 scripts/verify.py <CompositionId>          # checks 1-4 of the brief
```

## Using the overlays

**AI HUD, Loading HUD and Particle Heart** render on exact black (0,0,0)
with no grain, dither or vignette. Put them over footage in **Screen** or
**Add** blend mode and the black drops out. The two HUDs are white, so you can
tint them in your editor.

**Glitter size scales with resolution.** Particle Heart glitter is 1–2 px at
720p, which is 3–6 px at 4K. Everything is laid out in a 1280×720 design
space and scaled to the output, so a 4K render looks like a sharper 720p
render, not a sparser one.

## Adding a colourway (one data row)

Every version is one row in `src/versions.ts`. Copy a row, give it a new id
(letters, digits and hyphens) and change its colours:

```ts
{
  id: "ParticleHeart-Silver",
  look: "heart",
  durationInFrames: 300,
  palette: { glitter: ["#B8C0CC", "#E0E6EE", "#FFFFFF"], hearts: "#A0A8B4", heartHeight: 0.48 },
},
```

`Root.tsx` registers every row automatically. Each look's palette fields are
described in the `*Palette` interfaces at the top of `src/versions.ts`.
`heartHeight` is the heart's height as a fraction of the frame; the brief asks
for 0.48, and the reference clip's heart is nearer 0.82.

## Determinism

Every pixel is a function of `useCurrentFrame()` only:

- Seeded `mulberry32` at module level for every table: ticker values, code
  lines, particle paths and targets, candle series, map dots.
  `Math.random()` is never used.
- Motion is closed-form in the frame. Particle positions are computed in the
  vertex shader from per-particle seeds. Loops use `frame % 600`, and every
  periodic element has a period that divides 600.
- Twinkle, grain and dither are integer hashes of particle id or pixel
  position and frame.
- R3F's `useFrame` is only the render hook that `<ThreeCanvas>` drives once
  per frame (priority 1); its clock is never read. No `Date.now()`, no
  `useState` driving visuals, no TAA, no accumulation.
- Fonts, map data and the PixiJS renderer are awaited with
  `delayRender` / `continueRender` before the first frame.

## Banding

- three.js post chain (scene → DoF ×2 → final) and the PixiJS scene and bloom
  all use **half-float** render targets.
- Stock Screen and Market Map compute their background gradients in float in
  the shader. Their final pass adds **±1/255 dither** and **~1% grain** from a
  fixed hash of pixel position and frame, faded out below 3% luminance.
- AI HUD, Particle Heart and Loading HUD have no grain or dither, so their black stays 0.

## Assets and licences

- **Fonts** (SIL Open Font License 1.1): Inter (numbers and labels) and
  JetBrains Mono NL (code and HUD text), in `public/fonts/` with their licence
  texts. The NL cut has no ligatures, so `<=` stays two characters.
- **Map:** Natural Earth 1:110m land, public domain. See
  `public/data/NATURAL_EARTH.md`.
- **Tickers:** invented. See `TICKERS.md`. All HUD text and code is made-up
  pseudo-code; no real code, logos, brands or exchange names.

## Measured render times

Measured in a 4-vCPU cloud container with **no GPU**: WebGL2 runs on
ANGLE → SwiftShader (software). On a machine with a GPU the three.js and
PixiJS looks are many times faster; the Canvas 2D HUDs barely change.

**720p (`--scale=1/3`), single-threaded steady state** (11-frame run minus
1-frame run), plus the throughput of the full preview renders:

| Composition | 720p ms/frame (concurrency 1) | Full preview render (throughput) |
|---|---|---|
| StockScreen-Teal | 987 | 773 ms/frame at concurrency 2 (600 f in 7.7 min) |
| AIHUD-WhiteOverlay | 105 | 44 ms/frame at concurrency 3 |
| ParticleHeart-Pink / Red / Gold | 245 | 130–134 ms/frame at concurrency 2 |
| MarketMap-Blue / Gold | 837 | 739–761 ms/frame at concurrency 2 |
| LoadingHUD-WhiteOverlay | 82 | 54 ms/frame at concurrency 3 |

**Real 4K frames** (3840×2160, steady state, concurrency 1):

| Frame | Seconds per 4K frame |
|---|---|
| **ParticleHeart-Pink, frame 75 (the burst)** | **1.09** |
| **MarketMap-Blue, frame 300** | **7.08** |
| StockScreen-Teal, frame 300 | 6.99 |
| AIHUD-WhiteOverlay, frame 300 | 0.45 |
| LoadingHUD-WhiteOverlay, frame 150 | 0.52 |

**4K estimates** for a whole composition on this kind of machine (software
GL, one render thread; divide by roughly 1.5–1.8 at concurrency 2):

| Composition | Estimate |
|---|---|
| StockScreen-Teal (600 f) | ~70 min |
| AIHUD-WhiteOverlay (600 f) | ~4.5 min |
| ParticleHeart-* (300 f each) | ~5.5 min each |
| MarketMap-* (600 f each) | ~71 min each |
| LoadingHUD-WhiteOverlay (360 f) | ~3 min |

On a desktop GPU expect the Stock Screen and Market Map to drop to well
under a second per 4K frame. Their cost here is the software rasteriser
redrawing a 3840–8192 px canvas texture, building its mipmaps and running
the two depth-of-field passes.

## Verification (720p previews)

Run with `python3 scripts/verify.py <id>`; reports land in `renders/verify/`.

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 20.0 / 10.0 / 12.0 s | all 8 pass |
| 2. Loop: frame 0 vs frame 600 of a 601-frame version (`--props='{"loopCheck":true}'`) | identical pixels, 4/4 loops |
| 3. Middle frame from a cold start vs the full multi-threaded render | byte-identical PNGs, 8/8 |
| 4. Black level, 50 points away from content, read from the encoded mp4 | AI HUD 0, Particle Heart (all 3) 0, Loading HUD 0 |
| 4. Banding, from the encoded mp4 | no contours in Stock Screen / Market Map gradients at 6–8× contrast stretch; Particle Heart glow steps by single 8-bit levels (no dither by design) |

A further 24 cold-start stills of the three.js looks (including frame 600 of
the loop-check variant) were compared with the full renders: all
byte-identical.

**Banding check method:** frames were decoded from the mp4s, the dark
gradient ranges stretched 6–8× and inspected, and pixel values read across
the gradients. The Stock Screen and Market Map gradients change smoothly with
±1 dither and grain. The Particle Heart glow climbs 0 → 26 → 0 in steps of
at most 2 levels between neighbouring pixels, with no plateaus.

## Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, 600 / 300 / 360 frames, one data row each
- [x] Stock Screen and Market Map: `@remotion/three`, WebGL2, Canvas 2D textures, DoF
- [x] Particle Heart: PixiJS 8, 120,000 glitter particles + 300 heart sprites, half-float bloom
- [x] AI HUD and Loading HUD: Canvas 2D, exact black, no grain, dither or vignette
- [x] Half-float render targets; ±1/255 dither and ~1% hashed grain on Stock Screen and Market Map only
- [x] Deterministic: seeded mulberry32, closed-form motion, no `Math.random()`, `Date.now()` or clock
- [x] Loops exact (periods divide 600); candles shift one per 120 frames with a periodic series
- [x] OFL fonts only (Inter, JetBrains Mono NL), with licence texts
- [x] Natural Earth 1:110m land with its public-domain note
- [x] Invented tickers (`TICKERS.md`); made-up HUD text and pseudo-code; no logos, brands or exchanges
- [x] Verification checks 1–4 pass for all 8; contact sheets and motion stepping reviewed (steps 5–6)
- [x] Three rounds of independent visual comparison against the references (step 8)

