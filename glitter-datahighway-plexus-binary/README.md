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
npx remotion render src/index.ts GlitterVortex-Gold        out/GlitterVortex_Gold_4K.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts GlitterVortex-Silver      out/GlitterVortex_Silver_4K.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts DataHighway-Multicolour   out/DataHighway_Multicolour_4K.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts PlexusLandscape-BlueAmber out/PlexusLandscape_BlueAmber_4K.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts LowPolyPlexus-Blue        out/LowPolyPlexus_Blue_4K.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts LowPolyPlexus-Violet      out/LowPolyPlexus_Violet_4K.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts BinaryPlane-Blue          out/BinaryPlane_Blue_4K.mp4          --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts BinaryPlane-Green         out/BinaryPlane_Green_4K.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

On a GPU machine, `--concurrency` can be raised; on software GL it barely
helps because all tabs share one GPU process.

### 6K still (6000×3375)

The compositions are 3840 wide, so a 6000×3375 still is `--scale=1.5625`
(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375). Everything is drawn at device
pixels, so the still is genuinely rendered at 6K, not upscaled:

```bash
npx remotion still src/index.ts GlitterVortex-Gold out/GlitterVortex_Gold_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
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

## Measured render times, banding check and checklist

See **[`VERIFY.md`](VERIFY.md)**. It covers the 720p per-frame times for every
composition, the two timed 4K frames with 4K estimates, the ffprobe results,
the loop and determinism checks, the banding transects and the completion
checklist.

## Fonts and licences

`public/fonts/JetBrainsMono-Bold.woff2` is JetBrains Mono (SIL Open Font
License 1.1). The licence text is in `public/fonts/OFL.txt`. It is the only
font used, and only for the characters in Look 5.
