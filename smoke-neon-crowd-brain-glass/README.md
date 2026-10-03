# Glitter Smoke · Neon Polygon Frame · Crowd Spotlight · AI Brain Paths · Glass Twist

One Remotion project, five looks, **8 compositions**, all defined at
**3840×2160, 30 fps**. Everything is built in code (no MCP servers, no stock
assets except the shipped OFL fonts and a CC0 HDRI).

| # | Composition id | Look | Engine | Length | Loop |
|---|---|---|---|---|---|
| 1A | `GlitterSmoke-Blue` | Glitter Smoke, blue (as ref) | **PixiJS 8** (WebGL2) | 600 f / 20 s | yes |
| 1B | `GlitterSmoke-VioletGold` | Glitter Smoke, violet-gold | **PixiJS 8** (WebGL2) | 600 f / 20 s | yes |
| 2 | `NeonPolygonFrame` | Neon Polygon Frame, blue & magenta | three.js via `@remotion/three` | 600 f / 20 s | yes |
| 3A | `CrowdSpotlight-Blue` | Crowd Spotlight, blue (as ref) | three.js via `@remotion/three` | 360 f / 12 s | no |
| 3B | `CrowdSpotlight-Gold` | Crowd Spotlight, gold | three.js via `@remotion/three` | 360 f / 12 s | no |
| 4 | `AIBrainPaths` | AI Brain Paths, blue | three.js via `@remotion/three` | 360 f / 12 s | no |
| 5A | `GlassTwist-IceBlue` | Glass Twist, ice blue (as ref) | three.js via `@remotion/three` | 600 f / 20 s | yes |
| 5B | `GlassTwist-Blush` | Glass Twist, blush | three.js via `@remotion/three` | 600 f / 20 s | yes |

WebGL2 everywhere (never WebGPU). The three.js looks use **ACES filmic**
tonemapping (in our own final pass), half-float HDR targets with 4× MSAA,
bloom, and — for looks 3 and 4 — a depth-of-field pass.

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ (built and tested with Node 22). Versions are pinned in
`package.json` (`remotion` / `@remotion/cli` / `@remotion/three` 4.0.515,
`three` 0.180.0, `@react-three/fiber` 9.4.2, `pixi.js` 8.13.2, React 19.2.3).

### Chromium GL flag

Headless Chromium must use ANGLE: **`--gl=angle`**. It is already set in
`remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), so every
`npx remotion render|still` picks it up. If you call the renderer from Node
APIs instead, pass `chromiumOptions: { gl: "angle" }`.

On a machine with a GPU, ANGLE uses it; on a GPU-less server it falls back to
SwiftShader (CPU) — that is what the measured times below were taken on.

## 4K render commands (one per composition)

```bash
npx remotion render GlitterSmoke-Blue       out/GlitterSmoke_Blue_4K.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GlitterSmoke-VioletGold out/GlitterSmoke_VioletGold_4K.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render NeonPolygonFrame        out/NeonPolygonFrame_4K.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CrowdSpotlight-Blue     out/CrowdSpotlight_Blue_4K.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CrowdSpotlight-Gold     out/CrowdSpotlight_Gold_4K.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render AIBrainPaths            out/AIBrainPaths_4K.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GlassTwist-IceBlue      out/GlassTwist_IceBlue_4K.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GlassTwist-Blush        out/GlassTwist_Blush_4K.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

(`--gl`, codec, CRF, pixel format and PNG intermediate frames are also the
defaults in `remotion.config.ts`; the flags above just make the commands
self-explanatory. Add `--concurrency=N` to tune for your machine.)

## Stills (6000×3375)

The compositions are 3840×2160, so a 6000×3375 still is `--scale=1.5625`:

```bash
npx remotion still GlitterSmoke-Blue out/GlitterSmoke_Blue_6K.png --frame=300 --scale=1.5625 --image-format=png --gl=angle
```

Swap the composition id and frame (e.g. `CrowdSpotlight-Blue --frame=340`,
`AIBrainPaths --frame=340`). Canvas backing stores follow the render scale, so
the still is rendered natively at 6000×3375 (not upscaled). Not rendered here.

## 720p previews

```bash
./scripts/render-previews.sh            # all 8, or pass composition ids
```

Renders each composition with Remotion at `--scale=0.3333333333333333`
(exactly 1280×720) as a full PNG sequence, then encodes H.264 / yuv420p /
30 fps / CRF 16 / no audio with ffmpeg. The PNG sequence is kept so the
determinism check can compare frame 200 byte-for-byte.

## Measured render times

Machine: 4 vCPU cloud container, **no GPU** (ANGLE → SwiftShader, CPU only).

| Look | 720p, s/frame (full sequence render) |
|---|---|
| 1 Glitter Smoke (A / B) | 2.88 / 2.85 |
| 2 Neon Polygon Frame | 0.51 |
| 3 Crowd Spotlight (A / B) | 2.78 / 2.78 |
| 4 AI Brain Paths | 2.09 |
| 5 Glass Twist (A / B) | 1.38 / 1.38 |

**Look 1 at 4K, same machine:** one cold `remotion still` (bundle + browser
start + 1 frame) takes 9.2 s vs 7.9 s at 720p; the marginal cost per frame
inside a sequence render is **3.45 s/frame at 4K** vs 2.86 s/frame at 720p
(20-frame runs). Look 1 barely scales with resolution on this box: its frame
time is dominated by fixed work (80k-speck update in JS, the 192×108 density
read-back, Remotion's screenshot), not by pixels.

For comparison, look 3 (heaviest per-pixel shading: DoF gather + bloom) at 4K:
**21.7 s/frame** (marginal, 10-frame run) vs 2.78 s/frame at 720p — 7.8×,
i.e. the three.js looks scale roughly with pixel count.

### 4K estimate

CPU-only (this box): look 1 ≈ 3.5 s/frame, look 2 ≈ 3–4 s/frame, look 3 ≈ 22
s/frame, look 4 ≈ 15 s/frame, look 5 ≈ 10 s/frame →
GlitterSmoke ≈ 35 min each, NeonPolygonFrame ≈ 35 min, CrowdSpotlight ≈ 2.2 h
each, AIBrainPaths ≈ 1.5 h, GlassTwist ≈ 1.7 h each — **about 11 h for all 8**.

On a machine with a real GPU (ANGLE on D3D11 / Metal / Vulkan) the shading is
typically 20–50× faster than SwiftShader, so expect roughly **0.5–1.5 s/frame
at 4K for every look** (look 1 is then bound by its fixed ~0.3 s of JS +
capture), i.e. **~5–15 min per composition, ~1–1.5 h for all 8** with default
concurrency. (Not measured — no GPU available here.)

## How each look is built

* **1 Glitter Smoke (PixiJS 8).** One `Application` per composition
  (`preference: 'webgl'`, `autoStart: false`, `preserveDrawingBuffer: true`,
  ticker stopped, one `app.render()` per Remotion frame, init + textures
  behind `delayRender`). Smoke is a full-screen `Mesh` with a custom GLSL ES 3
  shader: domain-warped simplex fbm in **polar coordinates folded M = 2 times
  around a tilted elliptical swirl centre**, so the field is exactly periodic
  under a half turn; each layer turns a whole number of half turns per 600
  frames (smoke flows in a continuous curving sweep and still loops exactly).
  A static crescent mask places the mass. 80 000 specks (`Float32Array`s
  built once from a module-level `mulberry32`) live in a `ParticleContainer`
  per bokeh level (8 pre-made disc textures, additive), move with the same
  swirl, are projected each frame, take brightness from the smoke density
  (the same shader rendered at 192×108 and read back), and twinkle on cycles
  that divide 600. Grain + ±1/255 dither are a custom Pixi `Filter` with a
  `uFrame` uniform.
* **2 Neon Polygon Frame.** 30 large flat polygons / shallow open prisms in a
  ring just outside the frame, dark glossy faces, thin tube edges with
  per-vertex colour blending blue→magenta, soft hot glows at some corners,
  faint diagonal light rays. Every rotation is a whole-cycle sine over 600
  frames.
* **3 Crowd Spotlight.** ~210 instanced bust icons (extruded shoulders,
  oval head slab, shirt V, lapels, tie — vertex-colour shaded), satin
  material, top + rim light, mirrored instanced crowd under a semi-transparent
  floor for reflections, emissive chosen figure, hologram disc + rings,
  reflection streak, haze column; camera on a monotone-cubic keyed path;
  gather depth of field from a linear-depth pass.
* **4 AI Brain Paths.** Extruded brain outline (two superellipse hemispheres,
  glossy rim, circuit-textured face), "AI" chip (Montserrat Bold drawn to a
  canvas texture after the font loads), flat glowing path ribbons drawn by a
  distance-along-tree shader (bright head, flowing dots, pulses at the end),
  glowing pads with six self-designed extruded icons that rise and pop
  (scale 0.9 → overshoot → 1). Circuit floor, data bits, light depth of field.
* **5 Glass Twist.** 48 rounded glass bars (`MeshPhysicalMaterial`: clearcoat,
  sheen + iridescence tint on edges, Fresnel from the HDRI, translucent fill —
  **no transmission**), a travelling sine that turns each bar about its
  vertical axis and leans it about the row axis, so a twist ripples through
  the row; long-lens frontal camera; studio HDRI, soft shadows. The wave
  travels exactly one wavelength per 600 frames; camera drift is closed.

## Determinism

Every value on screen is a function of `useCurrentFrame()` only:
no `Math.random()` at render time (module-level / per-scene seeded
`mulberry32`), no simulation stepped frame by frame, no R3F clock, no
`Date.now()`, no state carried between frames, no TAA / temporal AO /
accumulation. Grain and dither are integer hashes of pixel position and
`frame % loopLength`. Fonts and HDRI load behind `delayRender`.

## Checks (all scripts in `scripts/`)

* `check-loop.sh` — renders frames 0 and 600 with
  `--props='{"durationOverride":601}'` and compares the PNGs.
* `check-determinism.sh` — cold `remotion still --frame=200` vs frame 200 of
  the full sequence render, byte for byte.
* `check-banding.py` — decodes frames **from the encoded mp4s** and prints
  32-row-averaged luma profiles across gradients/glows plus the residual noise.

Results on the delivered previews:

| Check | Result |
|---|---|
| 1 ffprobe: 1280×720, 30/1, h264, yuv420p, no audio; 12.0 s (looks 3, 4) / 20.0 s (others) | all 8 pass |
| 2 loop: frame 0 vs frame 600 (601-frame override) | identical PNGs for GlitterSmoke A/B, NeonPolygonFrame, GlassTwist A/B |
| 3 determinism: cold frame 200 vs full render frame 200 | byte-identical for all 8 (GlassTwist after removing shadow maps, see below) |
| 4 banding (from the encoded mp4) | gradients move in fractional code steps, no plateaus; dither/grain noise survives encoding (σ ≈ 0.6–1 code in dark areas) |

GlassTwist originally used a PCF soft shadow map; frame N then depended on
which frames the same browser tab had rendered before (drift grew with
history: Δmean 0.03 after 1 prior frame, 1.3 after 50, 2.5 in the full
render). Shadows were removed from that look (the HDRI does the soft shading);
it is now byte-exact.

## Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps; 600 f (looks 1, 2, 5) / 360 f (looks 3, 4)
- [x] Look 1 in PixiJS 8 (WebGL, ticker stopped, one `app.render()` per frame, ParticleContainer, 80k specks, 8 bokeh discs, custom smoke shader, grain/dither Filter with `uFrame`)
- [x] Looks 2–5 in three.js via `@remotion/three`, ACES tonemapping, WebGL2 (`--gl=angle`)
- [x] One data row per version (`src/versions.ts`)
- [x] Loops close exactly (whole cycles over 600 frames; smoke/glitter on whole half-turns)
- [x] Deterministic: frame 200 cold == frame 200 from full render, byte for byte, all 8
- [x] ±1/255 dither after tonemapping/bloom + grain from a fixed hash of pixel and frame (2 %, 1.5 % in look 5); never `Math.random()`
- [x] Fonts (Inter, Montserrat, OFL) and HDRI (CC0) shipped with licences; icons self-drawn; only text is "AI"
- [x] Fonts, HDRI, Pixi init behind `delayRender` / `continueRender`
- [x] No TAA / temporal AO / accumulation; no `useFrame` clock, `Date.now()` or carried state
- [x] 720p previews + 720p PNG stills of all 8; render times measured (720p each look, 4K look 1)
- [x] Visual comparison against the references with fresh sub-agents (3 rounds per look; see report)

## Adding a colourway

All colours live in `src/versions.ts`, one row per version. Copy a row in the
relevant array, give it a new `id` (letters, digits, `-`), change the colours,
and it appears as a new composition (Root.tsx maps over the arrays). Example:

```ts
export const glassVersions = [
  // …
  {
    id: "GlassTwist-Mint",
    colors: {
      tintA: "#9FE0C8", tintB: "#CFEFE2", white: "#F4FBF8",
      background: "#EEF7F3", iridescence: ["#A8E8F5", "#C8F5B0"],
    },
  },
];
```

Then add its output name to `scripts/render-previews.sh` if you want it in the
preview batch.

## Licences

* Fonts: Inter and Montserrat — SIL Open Font License 1.1
  (`public/fonts/*-OFL.txt`).
* HDRI: "Studio Small 03" by Sergej Majboroda, Poly Haven — CC0
  (`public/hdri/LICENSE.txt`).
* Simplex noise GLSL: Stefan Gustavson / Ashima Arts — MIT (credited inline).
