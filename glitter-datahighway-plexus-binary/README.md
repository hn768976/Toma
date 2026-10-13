# Glitter Vortex · Data Highway · Plexus Landscape · Low-Poly Plexus · Binary Plane

Five looks, eight compositions, one Remotion project. Every composition is a
**3840×2160, 30 fps, 600-frame (20 s) seamless loop**, built entirely in code.

| Composition id | Look | Engine | Preview file |
|---|---|---|---|
| `GlitterVortex-Gold` | 1A Glitter Vortex, gold (as reference) | PixiJS 8, WebGL2 | `GlitterVortex_Gold.mp4` |
| `GlitterVortex-Silver` | 1B Glitter Vortex, silver | PixiJS 8, WebGL2 | `GlitterVortex_Silver.mp4` |
| `DataHighway-Multicolour` | 2 Data Highway | three.js via `@remotion/three` | `DataHighway_Multicolour.mp4` |
| `PlexusLandscape-BlueAmber` | 3 Plexus Landscape | three.js via `@remotion/three` | `PlexusLandscape_BlueAmber.mp4` |
| `LowPolyPlexus-Blue` | 4A Low-Poly Plexus, blue (as reference) | three.js via `@remotion/three` | `LowPolyPlexus_Blue.mp4` |
| `LowPolyPlexus-Violet` | 4B Low-Poly Plexus, violet | three.js via `@remotion/three` | `LowPolyPlexus_Violet.mp4` |
| `BinaryPlane-Blue` | 5A Binary Plane, blue (as reference) | three.js via `@remotion/three` | `BinaryPlane_Blue.mp4` |
| `BinaryPlane-Green` | 5B Binary Plane, green | three.js via `@remotion/three` | `BinaryPlane_Green.mp4` |

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Versions are pinned in `package.json` (Remotion 4.0.535, three 0.186.1,
@react-three/fiber 9.8.1, PixiJS 8.22.0, React 19.2.3).

### Chromium GL flag

All looks need **WebGL2**. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing
**`--gl=angle`** on the command line. On a machine with a GPU, ANGLE uses it;
on a headless server without one, Chromium falls back to SwiftShader
(software WebGL2), which works but is slow (the timings below were measured
that way). Do not use WebGPU.

If Remotion cannot download its own Chrome Headless Shell, set a browser with
`--browser-executable=/path/to/chrome-headless-shell` (the config does this
automatically when a Playwright Chromium is present at the path it checks).

## Render at 4K

Each command renders the full 20 s loop at 3840×2160, H.264, yuv420p, CRF 16
(the codec / pixel format / CRF / `--gl=angle` defaults come from
`remotion.config.ts`; they are repeated here so the commands stand alone).

```bash
npx remotion render src/index.ts GlitterVortex-Gold        out/GlitterVortex_Gold_4K.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --timeout=600000
npx remotion render src/index.ts GlitterVortex-Silver      out/GlitterVortex_Silver_4K.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --timeout=600000
npx remotion render src/index.ts DataHighway-Multicolour   out/DataHighway_Multicolour_4K.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --timeout=600000
npx remotion render src/index.ts PlexusLandscape-BlueAmber out/PlexusLandscape_BlueAmber_4K.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --timeout=600000
npx remotion render src/index.ts LowPolyPlexus-Blue        out/LowPolyPlexus_Blue_4K.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --timeout=600000
npx remotion render src/index.ts LowPolyPlexus-Violet      out/LowPolyPlexus_Violet_4K.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --timeout=600000
npx remotion render src/index.ts BinaryPlane-Blue          out/BinaryPlane_Blue_4K.mp4          --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --timeout=600000
npx remotion render src/index.ts BinaryPlane-Green         out/BinaryPlane_Green_4K.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --timeout=600000
```

On a GPU machine, `--concurrency` can be raised; on software GL it barely
helps because all tabs share one GPU process.

### 6K still (6000×3375)

The compositions are 3840 wide, so a 6000×3375 still is `--scale=1.5625`
(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375). Everything is drawn at device
pixels, so the still is genuinely rendered at 6K, not upscaled:

```bash
npx remotion still src/index.ts GlitterVortex-Gold out/GlitterVortex_Gold_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png --timeout=600000
```

(Swap the composition id for any other. 6K stills were not rendered here.)

### 720p previews

`scripts/render-preview.sh <CompositionId> <OutputName>` renders the 720p
preview the way the delivered files were made: a 601-frame PNG sequence at
`--scale=0.3333333333333333` (exactly 1280×720), the loop check on frames 0
and 600, an H.264 / yuv420p / CRF 16 / 30 fps encode of frames 0–599 with no
audio, and the cold-start frame-300 determinism check.

```bash
npx remotion bundle src/index.ts --out-dir=out/bundle
scripts/render-preview.sh GlitterVortex-Gold GlitterVortex_Gold out/bundle
```

## How it is built

- `src/versions.ts` holds **one data row per version** (colours only).
  `src/Root.tsx` registers every row as a composition.
- `src/lib/random.ts`: `mulberry32` seeded at module level, integer hashes for
  per-id / per-bucket choices, `LOOP = 600`.
- `src/lib/ThreeStage.tsx`: wraps `<ThreeCanvas>` from `@remotion/three`. The
  frame from `useCurrentFrame()` is stored during render and read inside an
  R3F render-takeover callback that Remotion advances once per frame. The R3F
  clock is never read.
- `src/lib/post.ts`: the three.js post pipeline. It renders the scene to a 4×
  MSAA half-float target, then optionally applies DoF (a gather blur whose
  circle of confusion comes from intersecting each pixel's ray with the
  analytic surface: the sphere floor in Look 2, the plane in Look 5). Then
  comes a 7-level dual-filter bloom, and a final pass that does a soft
  shoulder, vignette, grain and dither.
- `src/lib/glsl.ts`: the shared finish (linear → sRGB, vignette, **grain ≈1.5 %**
  and **±1/255 triangular dither**, both a PCG hash of
  `(pixel x, pixel y, frame % 600)`). Looks 2 and 3 fade the grain out below
  about 3 % luminance so their black skies stay clean.
- `src/looks/glitter/*`: PixiJS 8 renderer created with `autoDetectRenderer`
  (`preference: "webgl"`). There is no ticker; `engine.render(frame)` is called
  from a layout effect once per Remotion frame. 150,000 instanced quads are
  projected from 3D in a custom vertex shader. Each point's size and blur
  follow its distance from the focal depth: a bokeh disc with a brighter rim
  out of focus, a 4-point star in focus. Bloom and finish run in Pixi
  `RenderTexture`s (`rgba16float`).
- `src/lib/glyphAtlas.ts`: JetBrains Mono Bold (OFL, `public/fonts/`) is loaded
  with the FontFace API and drawn once into a 1024×128 atlas (with mipmaps and
  anisotropic filtering). `delayRender` holds the first frame until it is ready.

### Loop maths (all exact at frame 600)

| Look | What moves | Period |
|---|---|---|
| 1 Glitter | each particle turns `k` whole turns per 600 f (inner band 2, middle and outer 1, with a soft mixed zone); twinkle = hash(id, ⌊f/2⌋ mod 300) blended to the next bucket; camera sway sin(2πf/600) | 600 |
| 2 Highway | bar layout periodic along lanes, scrolled exactly one period per 600 f; flicker holds ∈ {10,12,15,20,24,30}; roll ±1.5° sin(2πf/600) | 600 |
| 3 Plexus | heightfield = Σ sin(k·p + n·2πf/600), n integer; twinkle n integer; camera drift sin/cos of 2πf/600 | 600 |
| 4 Low-poly | node loops with integer cycles; 8 facet slots × 100-frame cycles (6 per loop); orbit ±4° | 600 |
| 5 Binary | streams move whole periods per loop (1–3); glyph swap holds ∈ {20,30,40,50,60,75}; camera drift | 600 |

### Determinism

Nothing on screen depends on `Math.random()`, `Date.now()`, `useState`, R3F's
clock or state carried between frames. All layouts are generated once at
module level from seeded `mulberry32`. Twinkles, flickers and glyph swaps are
hashes of (id, frame bucket). The glyph atlas and the font are built once
behind `delayRender`. There is no TAA.

## Add a colourway (one data row)

Copy a row in `src/versions.ts`, give it a new `id` and change the colours.
For example, a red Low-Poly Plexus:

```ts
{ id: "LowPolyPlexus-Red", v: { line: "#FF4A5A", lineAlpha: 0.55, facet: "#FF8A8A", node: "#FFC0C8", bgTop: "#1A0408", bgBottom: "#4A0A14" } },
```

It shows up in the studio and is renderable as `LowPolyPlexus-Red`.

## Measured render times

Machine: 4-core Intel Xeon @ 2.1 GHz, **no GPU**, so WebGL2 ran on SwiftShader
(software) through `--gl=angle`. A GPU machine will be far faster, often by more
than 10×.

**720p (1280×720), per frame.** Each figure is the wall time of the full
601-frame preview render divided by its frame count, at `--concurrency=2`. It
includes browser start-up.

| Composition | s / frame @ 720p | 600-frame preview |
|---|---|---|
| GlitterVortex-Gold | 2.65 | 26.5 min |
| GlitterVortex-Silver | 2.19 | 21.9 min |
| DataHighway-Multicolour | 1.67 | 16.7 min |
| PlexusLandscape-BlueAmber | 0.73 | 7.3 min |
| LowPolyPlexus-Blue | 0.26 | 2.6 min |
| LowPolyPlexus-Violet | 0.26 | 2.6 min |
| BinaryPlane-Blue | 3.07 | 30.7 min |
| BinaryPlane-Green | 2.96 | 29.6 min |

**Two real 4K frames (3840×2160), timed at `--scale=1 --concurrency=1`.**
Each composition was rendered for frames 300–300 and then for frames 300–302.
The marginal cost per frame is the difference divided by 2.

| Composition | 1 frame incl. start-up | 3 frames | **marginal s / 4K frame** | same method @ 720p |
|---|---|---|---|---|
| GlitterVortex-Gold (1A) | 7.1 s | 15.6 s | **4.3 s** | 2.2 s |
| BinaryPlane-Blue (5A) | 72.7 s | 136.2 s | **31.8 s** | 2.8 s |

Glitter is vertex-bound: 150k instanced particles, so it scales by only about
2× from 720p to 4K. Binary is fill-bound: a 72-tap DoF gather plus bloom at
9× the pixels, so it scales by about 11×.

**4K estimates for a full 600-frame render on this kind of CPU-only machine.**
The two measured looks are from the table above. The others use their 720p
times × the scale factor of the look they most resemble: about 10× for
the DoF-plus-bloom pipelines (Highway), and about 8× for the
point/line looks (Plexus and Low-Poly), which do not have the full-screen DoF pass.

| Composition | est. s / 4K frame | est. 600 frames |
|---|---|---|
| GlitterVortex-Gold / Silver | 4.3 (measured) | ~45 min each |
| DataHighway-Multicolour | ~17 | ~2.8 h |
| PlexusLandscape-BlueAmber | ~6 | ~1 h |
| LowPolyPlexus-Blue / Violet | ~2 | ~20 min each |
| BinaryPlane-Blue / Green | 31.8 (measured) | ~5.3 h each |

On software GL a single 4K Binary frame can take more than 30 s, which is why
`remotion.config.ts` raises the page timeout to 10 minutes. Pass
`--timeout=600000` if you render with the Node API or another config.

## Verification (what was checked, and the results)

All checks ran on the delivered 720p files and their PNG sequences.
`scripts/render-preview.sh` does checks 1–3 for each composition,
`scripts/banding-check.py` does check 4 and `scripts/motion-check.py` does check 6.

1. **File checks (ffprobe).** All 8 previews are h264, 1280×720, `30/1`,
   yuv420p, 20.000000 s, with one video stream and **no audio**. `--scale=0.3333333333333333`
   gives exactly 1280×720, so no downscale fallback was needed.
2. **Loop.** Each composition was rendered as 601 frames
   (`--props='{"loopCheck":true}'`). The decoded pixels of frame 0 and frame 600
   are identical (framemd5) for **all 8**. A seam check on the mp4s also shows
   that the 599→0 step is no larger than an ordinary frame step.
3. **Determinism.** Frame 300 was rendered alone from a cold start with
   `remotion still`, using a 600-frame composition rather than the 601-frame
   one. It is **byte-identical** to frame 300 of the full render (`cmp`)
   for **all 8**.
4. **Banding, measured on the encoded mp4.** Frames were decoded at 2, 4, 10
   and 15 s, and the gradient areas were sampled:
   - Glitter: the glow haze in the top-right sky.
   - Highway: the sky above the horizon glow.
   - Plexus: the dark sky down to the navy horizon.
   - Low-Poly: the navy or plum gradient.
   - Binary: the dark DoF blur.

   The largest row-to-row step of the averaged profile is 0.15–0.96 levels, and
   **0.0 % of 8×8 blocks are flat**, so the dither survived the encode and every
   region passed. x264's default adaptive quantisation stripped the dither in
   the darkest areas (up to 14 % flat blocks in Low-Poly Violet). The encode
   therefore uses `-x264-params aq-mode=3:aq-strength=1.6`.
5. **Contact sheets.** Five evenly spaced frames per composition were checked
   against the brief.
6. **Motion.** Two seconds around frame 300 of each composition were checked:
   - Mean luminance has no alternating pulse; lag-1 autocorrelation of the
     frame-to-frame change is above −0.5 everywhere except Plexus.
   - Plexus's ±0.09-level wobble is x264 noise: the source PNG frames change
     smoothly.
   - Glyph swaps and bar flicker are staggered per instance, so no frame
     carries a synchronised swap.
7. **Look comparison with the references** (steps 7 and 8). See the delivery
   report for what the independent comparisons flagged and what was changed.

### Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] Look 1 on PixiJS 8 / WebGL2 with 150k particles projected in a custom shader; Looks 2–5 on `@remotion/three` / WebGL2
- [x] One data row per version (`src/versions.ts`)
- [x] Deterministic: seeded `mulberry32`, hashes of (id, frame bucket), no `Math.random`/`Date.now`/clock/`useState` visuals, no TAA
- [x] Font and atlas loaded behind `delayRender`
- [x] Grain about 1.5 % from (pixel, frame % 600); ±1/255 dither; grain fades below about 3 % luminance in Looks 2 and 3
- [x] JetBrains Mono (OFL) bundled with its licence; no other text
- [x] 720p previews, H.264 yuv420p CRF 16, verified with ffprobe
- [x] Loop check, cold-start determinism check, banding check on the encoded mp4, motion check
- [x] 4K render commands, 6K still command, GL flag, timings and estimates documented

## Fonts and licences

`public/fonts/JetBrainsMono-Bold.woff2` is JetBrains Mono (SIL Open Font
License 1.1). The licence text is in `public/fonts/OFL.txt`. It is the only
font used, and only for the characters in Look 5.
