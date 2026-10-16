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

<!-- MEASUREMENTS -->
