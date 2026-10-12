# Acronym Cube Field — Remotion template (10 versions)

A data-driven three.js scene in Remotion. A vast field of small rounded cubes ripples slowly in
perspective; each cube's top face carries a glowing icon (pale cyan, with ~12% amber accents).
A raised plate in the centre holds the hero acronym in thick, rounded 3D letters with an
iridescent edge. Strong depth of field, bloom, vignette and grain.

One template → one data row per version → **10 seamless 20 s loops** (600 frames, 30 fps, 3840×2160).

| Output name | Composition id | Word |
|---|---|---|
| `AcronymCubes_CBDC` | `AcronymCubes-CBDC` | CBDC (with coin notches) |
| `AcronymCubes_AI` | `AcronymCubes-AI` | AI |
| `AcronymCubes_ESG` | `AcronymCubes-ESG` | ESG |
| `AcronymCubes_IoT` | `AcronymCubes-IoT` | IoT |
| `AcronymCubes_SaaS` | `AcronymCubes-SaaS` | SaaS |
| `AcronymCubes_API` | `AcronymCubes-API` | API |
| `AcronymCubes_ERP` | `AcronymCubes-ERP` | ERP |
| `AcronymCubes_CRM` | `AcronymCubes-CRM` | CRM |
| `AcronymCubes_KPI` | `AcronymCubes-KPI` | KPI |
| `AcronymCubes_LLM` | `AcronymCubes-LLM` | LLM |

> Remotion composition ids may only contain `a-z A-Z 0-9 -`, so the ids use a hyphen
> (`AcronymCubes-CBDC`); the render commands below write files with the underscore names.

## Quick start

```bash
npm install
npx remotion studio
```

Node 18+ (tested on Node 22). Versions are pinned in `package.json`.

## Rendering

**Chromium GL flag:** three.js needs WebGL2, so headless Chromium runs with `--gl=angle`.
`remotion.config.ts` sets this (`Config.setChromiumOpenGlRenderer("angle")`); when you use the
Node API, pass `chromiumOptions: { gl: "angle" }`. On a machine without a GPU, ANGLE falls back
to SwiftShader (software). That is correct but slow; see the timings below.

### 4K video (3840×2160), per composition

```bash
npx remotion render AcronymCubes-CBDC out/AcronymCubes_CBDC.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-AI   out/AcronymCubes_AI.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-ESG  out/AcronymCubes_ESG.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-IoT  out/AcronymCubes_IoT.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-SaaS out/AcronymCubes_SaaS.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-API  out/AcronymCubes_API.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-ERP  out/AcronymCubes_ERP.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-CRM  out/AcronymCubes_CRM.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-KPI  out/AcronymCubes_KPI.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render AcronymCubes-LLM  out/AcronymCubes_LLM.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

With a real GPU, add `--concurrency=2` (or more). With software GL, keep `--concurrency=1`:
SwiftShader already uses every core inside a single tab.

### 720p preview

```bash
npx remotion render AcronymCubes-CBDC out/AcronymCubes_CBDC.mp4 --scale=0.3333333333333333 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

`3840 × 0.3333333333333333` rounds to exactly 1280×720 (checked with ffprobe).
`scripts/render-previews.sh` renders all 10 previews plus a 720p still of each.

### 6K still (6000×3375)

```bash
npx remotion still AcronymCubes-CBDC out/AcronymCubes_CBDC_6K.png --frame=150 --scale=1.5625 --gl=angle --image-format=png
```

`3840 × 1.5625 = 6000` and `2160 × 1.5625 = 3375`. Every radius in the post pipeline (blur,
bloom) is a fraction of the frame height, so a 6K still matches the 4K look.

<!--TIMINGS-->

## How it is built

- `src/data/acronyms.ts`: **the data rows** (one per version).
- `src/scene/layout.ts`: grid constants, per-cube static data (icon, accent, jitter, twinkle
  schedule) from seeded hashes, and `cubeHeight(cell, frame)`, the looping ripple.
- `src/scene/world.ts`: builds the three.js scene once per composition, then `update(frame)`
  and `render(frame)`. The look parameters are in `LOOK`.
- `src/scene/materials.ts`: cube satin, icon quads (atlas + twinkle), plate rim, letter face
  gradient, and the iridescent thin-film sides.
- `src/scene/letters.ts`: Nunito Black → `opentype.js` path → `THREE.Shape` → `ExtrudeGeometry`
  (depth 0.35, rounded bevel), the fit rule, and the CBDC coin notches.
- `src/scene/post.ts`: single-frame post. MSAA scene → CoC → 64-tap gather DoF (half res) →
  composite → 6-level bloom mip chain → ACES, saturation, vignette, sRGB, grain and dither.
- `src/icons/icons.ts`: every icon as Canvas 2D paths. `src/icons/atlas.ts` builds the atlas
  (R = crisp icon, G = blurred halo for the accent glow).
- `public/fonts/Nunito-Black.ttf` with its licence `public/fonts/OFL.txt` (SIL Open Font
  License 1.1).

Engine: Remotion 4 with `@remotion/three` (React Three Fiber) on WebGL2. The cubes and the
icon quads are two `InstancedMesh`es of 2,304 instances each (a 60 × 40 grid minus the
16 × 6 hole for the plate). The environment is `RoomEnvironment` through PMREM.

### Determinism

Remotion renders frames out of order across tabs, so everything on screen is a pure function
of `useCurrentFrame()`:

- There is no `Math.random()`. `mulberry32` and integer hashes are seeded at module level or
  from the word, and they drive icon assignment, the static height offsets, the twinkle
  schedule and the noise permutation table.
- The ripple is 4D simplex noise whose last two axes run around a circle
  (`cos θ, sin θ`, θ = 2π·frame/600). Twinkles are evaluated modulo 600. The camera path is
  `sin θ` / `cos θ`. Grain hashes `(pixel, frame % 600)`. So frame 600 equals frame 0.
- There is no R3F clock (`useFrame` is a priority-1 no-op that only disables R3F's own
  render), no `Date.now()`, no state carried between frames, and no TAA.
- The font, the letter geometry, the icon atlas and the PMREM are built once. `delayRender`
  holds the first frame until the scene has drawn.

<!--CHECKS-->

## How to add a new acronym

1. **Add a data row** in `src/data/acronyms.ts`:

   ```ts
   {
     id: "AcronymCubes_DeFi",        // output name; the composition id becomes AcronymCubes-DeFi
     word: "DeFi",                    // spelled and cased exactly as shown
     icons: ["chip", "arrows", "padlock"],  // 2–5 base icons (share ~88% of the cubes)
     accentIcon: "sparkle",           // ~12% of the cubes, amber, glowing
     colorA: "#3A6AE8",               // field colour at the far / top edge
     colorB: "#8A3AE8",               // field colour at the near / bottom edge
     letterFace: "#BFF4FF",           // letter front faces (blend to white at the top)
     coinNotches: false,              // true = currency-style bars above and below each letter
     // optional: iconColor (default #BFF4FF), accentColor (default #FFC85A)
   },
   ```

   The composition appears in the studio automatically. Base icons + accent may total at
   most 8 (the atlas is 4 × 2 tiles).

2. **Draw a new icon** (if you need one) in `src/icons/icons.ts`:
   - Add its id to the `IconId` union.
   - Add a drawer to `ICONS`. You draw in a **100 × 100 box (y down)** in opaque white with the
     helpers `stroke`, `fill`, `cutFill` and `cutStroke` (the `cut…` helpers knock details out
     of a filled shape with `destination-out`). Use `circle`, `rrect` and `poly` for shapes.
   - Keep strokes at **7–11 units** and keep details at least ~6 units apart. Icons are ~25 px
     on screen at 720p, and thin lines vanish.
   - For a typographic icon, use `glyph("…")`. It draws from the bundled OFL font, never from
     system fonts.
   - No logos or brand marks.

3. **The fit rule for long words.** Letters are set so the cap height is **45% of the plate
   depth**. If the word is then wider than **85% of the plate width**, the whole word is scaled
   down uniformly (cap height included) until it fits. Mixed case is fine; lowercase letters
   keep the font's own proportions. Very long words (6+ letters) become noticeably smaller. If
   that happens, widen `PLATE_COLS` in `layout.ts`, which changes every version.
