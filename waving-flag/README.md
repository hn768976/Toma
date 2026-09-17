# Waving Flag — Remotion + three.js template

A waving national flag, rendered as a lit, vertex-displaced mesh in three.js
inside Remotion. **30 countries × 2 versions = 60 compositions**, all defined at
**3840×2160, 30 fps, 300 frames (10 s), seamless loop**.

The mesh, wave, lighting and camera are identical for every country. Only the
flag texture and the flag's true aspect ratio change, and both come from one
data set — `src/data/countries.json`. Adding a country is a data row, not a code
change.

---

## Quick start

```bash
npm install
npm run build:textures     # rasterise the 30 flag SVGs -> public/flags/*.png
npx remotion studio
```

`build:textures` runs automatically nowhere — run it once after `npm install`.
It is the only step that touches `node_modules/svg-country-flags`, and it also
verifies every flag's proportion against its official specification (see
[Flag artwork](#flag-artwork-source-and-verification)).

---

## ⚠️ Renderer: WebGL. The WebGPU headless test and its outcome

**The project ships on WebGL. WebGPU was tested first, in ten frames, through
the real Remotion render pipeline, and it does not work in headless Chromium
here.** What follows is what actually happened, so nobody has to repeat it.

The test was a minimal WebGPU scene — one lit, vertex-displaced plane using
`WebGPURenderer` from `three/webgpu` and a TSL `positionNode`, mounted in
`ThreeWebGPUCanvas` from `@remotion/three/webgpu` — rendered headless at 10
frames with the flags intended for production.

| Configuration | Result |
| --- | --- |
| three r186 + Chromium 141 headless shell | **Hard failure at frame 1.** `TypeError: Failed to execute 'createView' on 'GPUTexture': Failed to read the 'swizzle' property from 'GPUTextureViewDescriptor': The provided value is not of type 'GPUTextureComponentSwizzle'.` three r186 sets `swizzle` as the string `'rgba'`; this Chromium implements the earlier dictionary form of that spec member. 0 frames written. |
| three r180 (predates `swizzle`) + Chromium 141 headless shell | WebGPU adapter and device **are** acquired and shader compilation starts, then: `THREE.WebGPURenderer: WebGPU Device Lost — A valid external Instance reference no longer exists.` 0 frames written. |
| three r180, `--gl=vulkan` (avoids Remotion's `--single-process`, a plausible cause of the device loss) | Identical device loss. 0 frames written. |

Remotion already launches Chromium with `--enable-unsafe-webgpu` and
`--ignore-gpu-blocklist`, so the failure is not a missing flag.

**Conclusion: build on WebGL.** Nothing in this clip needs compute shaders or
any other WebGPU advantage — the fabric is a vertex-displaced mesh, which WebGL
handles fine, and the WebGL path is what every deliverable here was rendered
with. If you later want to retry WebGPU, the two blockers above are the things
to re-check; the scene code would need porting from GLSL chunk injection to TSL
node materials.

### Required renderer and GL flags

```bash
--gl=swangle        # set as the default in remotion.config.ts
```

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer('swangle')`.
SwiftShader-via-ANGLE is the backend that renders this scene correctly and
**byte-identically across runs** on a machine with no GPU. On a machine with a
real GPU, `--gl=angle` is faster and equally correct.

Renders are reproducible: rendering the same five frames twice produced
byte-identical PNGs (verified by `md5sum`).

If you are pointing Remotion at a Chrome you already have rather than letting it
download its own, set `CHROME_EXECUTABLE`; `remotion.config.ts` picks it up:

```bash
export CHROME_EXECUTABLE=/path/to/chrome-headless-shell
```

---

## Render commands

Every composition is defined at 3840×2160. The full-resolution command for any
one of them:

```bash
npx remotion render src/index.ts <CompositionId> out/<Name>.mp4 \
  --codec=h264 --gl=swangle --concurrency=4
```

For example:

```bash
npx remotion render src/index.ts Germany-FlagPole    out/Germany_FlagPole.mp4    --codec=h264 --gl=swangle
npx remotion render src/index.ts Mexico-FlagCloseup  out/Mexico_FlagCloseup.mp4  --codec=h264 --gl=swangle
```

A 1080p preview of the same composition — this is how the three delivered clips
were made:

```bash
npx remotion render src/index.ts Japan-FlagPole out/Japan_FlagPole.mp4 \
  --codec=h264 --scale=0.5 --gl=swangle --concurrency=4
```

A still:

```bash
npx remotion still src/index.ts Japan-FlagPole out/Japan_FlagPole.png --frame=90 --scale=0.5
```

Composition ids are `<Slug>-FlagPole` and `<Slug>-FlagCloseup` (Remotion does not
allow `_` in a composition id; the delivered *files* use `_`). Run
`npx remotion compositions src/index.ts` for the full list.

---

## Measured render time

Measured on this machine: **4 vCPU, 15 GB RAM, no GPU**, SwiftShader via ANGLE
(`--gl=swangle`), `--concurrency=4`. Wall-clock seconds per output frame.

| | 1080p (`--scale=0.5`) | 4K (3840×2160) |
| --- | --- | --- |
| V1 — flag on a pole | **3.24 s/frame** (Japan, 300 frames in 972 s)<br>**3.30 s/frame** (Saudi Arabia, 989 s) | **10.37 s/frame** |
| V2 — full-frame fabric | **5.48 s/frame** (Brazil, 1644 s) | **11.00 s/frame** |

The 4K figures come from 8-frame samples of the same two compositions, using
the same command and concurrency, so the two columns are comparable.

**Scheduling the 57 unrendered compositions at 4K on hardware like this:**

| | Compositions | Frames | Estimate |
| --- | --- | --- | --- |
| V1 remaining | 28 | 8,400 | ≈ 24.2 h |
| V2 remaining | 29 | 8,700 | ≈ 26.6 h |
| **Total** | **57** | **17,100** | **≈ 51 h** |

That is the number for a **software rasteriser**. Almost all of it is fragment
and vertex work that a real GPU does in a small fraction of the time — on a
GPU machine with `--gl=angle`, expect roughly an order of magnitude better, and
raise `--concurrency` to the core count. Budget from a short measured sample on
your own hardware rather than from this table:

```bash
npx remotion render src/index.ts Japan-FlagPole /tmp/probe \
  --sequence --image-format=png --frames=100-107 --concurrency=4
```

At 1080p, V2 costs more than V1 because of the stacked backdrop-filter passes
that produce the depth of field; at 4K the two converge, because V1's
full-frame procedural sky becomes the dominant cost instead.

---

## Flag artwork: source and verification

**Source.** The public-domain Wikimedia Commons flag SVGs, via the
[`svg-country-flags`](https://www.npmjs.com/package/svg-country-flags) package
(`license: PD` — "The source files were taken from Wikipedia and are not under
copyright protection since flags are effectively in public domain"). They are
rasterised to PNG **once, at build time**, by `scripts/build-textures.mjs`, never
per frame. Each texture is 4096 px on its long edge, which is slightly above 1:1
pixel density when the flag fills a 4K frame, so emblems stay crisp through the
folds in the close-up.

**Proportion verification.** `scripts/build-textures.mjs` holds the officially
specified ratio for all 30 countries in `src/data/countries.json` and compares it
against the ratio the source SVG actually declares. A drift of more than 0.2%
**fails the build** rather than shipping a wrong-shaped flag. All 30 pass.

**Respecting true aspect ratios.** Ratios are *not* forced to one shape. The set
spans 1:1 (Switzerland), 10:19 (United States), 1:2 (UK, Canada, Australia,
Nigeria, UAE), 3:5 (Germany), 5:8 (Poland, Sweden), 7:10 (Brazil), 9:14
(Argentina), 4:7 (Mexico), 8:11 (Israel) and 2:3 (the rest). The mesh's
dimensions are set per country from the data row, and V1 sizes every flag by
whichever dimension binds first, so a square Swiss flag and a 1:2 Canadian flag
read as the same size of object without either being distorted.

**One correction.** The Commons rendering of the Argentine flag is 8:5, but
Argentine law specifies **9:14**. The data row carries a `svgViewBox` override
that crops 11.11 units from each side of the source viewBox — this reaches the
official proportion while keeping the Sun of May centred and perfectly circular,
rather than squashing the artwork into a new box. This is a general mechanism:
any country can carry a `svgViewBox` override.

**Never mirrored.** The flag is rendered `DoubleSide`, and the reverse face
samples the texture with `u` flipped (`FlagMesh.tsx`, the `map_fragment`
injection). That is how a two-layer flag is actually manufactured: the design
reads **correctly** from behind instead of showing a mirror image. Saudi Arabia's
shahada and Iraq's takbir therefore read correctly wherever a fold turns the
cloth away from camera. A mirrored shahada is a serious error, not a cosmetic
one, and this is the specific reason for that code.

**No distortion beyond the wave.** The cloth is never stretched to fit a frame
and no emblem is cropped by the texture pipeline; the only deformation is the
wave itself.

---

## The wave — procedural, not simulated

There is **no cloth simulation**. A solver accumulates state frame to frame, and
Remotion renders frames out of order across threads, so a simulated flag would
produce inconsistent output and would not loop. Every term in
`src/flag/glsl/wave.glsl.ts` is a pure function of the loop phase
`t = frame / 300`, driven by `useCurrentFrame()` — no `useFrame` clock, no delta
accumulation anywhere in the project.

Displacement along the cloth's local +Z comes from:

1. a **primary sine** travelling from the hoist outward,
2. a **secondary sine** at a different frequency, travelling at 22° (V1) / 25° (V2),
3. a **low-frequency gradient noise** term for irregularity, and
4. a **drape** term — soft vertical folds gathered near the pole (`u·e^(-u/σ)`,
   which is zero at the attachment and peaks just outside it), plus a gentle
   gravitational sag toward the free edge.

Every term is multiplied by the envelope `E(u) = u^p`, which is **exactly zero at
the attachment and largest at the free edge**. This is the detail that decides
whether the shot reads as a flag or as a floating sheet.

**Looping.** Each sine completes a whole number of cycles over the 300 frames
(`n1`, `n2` and `drapeCycles` in `src/flag/constants.ts` are integers — keep them
that way), and the noise is sampled on a **circle in time**, so it returns to its
start. The sky's clouds use *periodic* noise and drift by exactly one period over
the loop. Measured: the mean absolute pixel difference across the 299 → 0 seam is
**1.40**, sitting inside the 1.30–1.62 range of the frames either side of it —
i.e. the seam is indistinguishable from any other frame boundary.

**Normals are analytic.** `wf_wave()` returns closed-form tangents `∂P/∂u` and
`∂P/∂v` — the chain rule applied to the expressions above, using a gradient noise
that returns its own analytic derivatives (`wf_noised`, after Inigo Quilez). The
normal is their cross product. Nothing is reconstructed from a normal or
displacement texture, which is what would otherwise stair-step and show as banded
shading across the folds.

**Self-shading.** The troughs of a corrugation are occluded by the crests either
side of them, so `wf_wave()` also returns a normalised trough depth, which
attenuates indirect and direct light in the `aomap_fragment` injection. Without
it the cloth reads as a printed image on a curved surface.

**Material.** `MeshPhysicalMaterial` at roughness 0.86 with a sheen lobe
(`sheen: 0.45`, `sheenRoughness: 0.9`) that brightens at grazing angles, and no
sharp specular hotspot — fabric, not plastic. A fine procedural weave perturbs
the normal in the fragment shader; it is faded out by `fwidth` wherever it would
alias, so it is barely visible at 1080p and present at 4K. Tone mapping is
**off** (`NoToneMapping`): an ACES-style curve would shift every flag's colours,
and the exact shade is part of the specification.

---

## Project layout

```
src/
  data/countries.json     the single data set: country, slug, official ratio,
                          optional viewBox override, notes
  data/countries.ts       types and derived helpers (aspect, texture path)
  flag/constants.ts       fps/size/duration, and the wave parameters per version
  flag/WavingFlag.tsx     the template component: {countryCode, framing}
  flag/FlagMesh.tsx       geometry, material and all shader injection
  flag/glsl/wave.glsl.ts  the displacement function and its analytic derivatives
  flag/glsl/noise.glsl.ts gradient noise with derivatives; periodic noise for sky
  flag/Sky.tsx            procedural gradient sky and looping clouds (V1)
  flag/Pole.tsx           brushed metal pole and finial (V1)
  flag/Grade.tsx          vignette / lens falloff (V1), depth of field (V2), grain
  flag/useEnvironment.ts  procedural environment map for metal and sheen
  flag/CameraRig.tsx      explicit camera placement
  Root.tsx                generates all 60 compositions from the data set
scripts/
  build-textures.mjs      SVG -> PNG at build time, with proportion verification
  verify-compositions.mjs checks all 60 configurations
public/flags/*.png        generated textures (not checked in by hand)
public/grain.png          generated grain tile
```

All sizes and camera framing are fractions of the frame dimensions from
`useVideoConfig()`, so the compositions reframe correctly at any resolution and
`--scale` behaves.

---

## Adding a further country

1. Confirm the flag's **official proportion** and find its two-letter ISO 3166-1
   alpha-2 code. `node_modules/svg-country-flags/svg/<code>.svg` must exist — the
   package covers every country, so this is a lookup, not a download.
2. Add one row to `src/data/countries.json`:

   ```json
   {"code": "no", "name": "Norway", "slug": "Norway", "ratio": [8, 11]}
   ```

   `ratio` is `[height, width]`, written exactly as the specification states it
   (Norway is 8:11). `slug` becomes the composition id and the output filename.
3. If the Commons rendering does not match the official proportion, add a
   `svgViewBox` override — crop the source viewBox rather than squashing the
   artwork, as the Argentina row does, and add a `ratioNote` saying why.
4. Run `npm run build:textures`. It rasterises the new flag and **fails loudly**
   if the proportion does not check out.
5. Run `npm run verify` and open `npx remotion studio` to eyeball the two new
   compositions.

No code changes. `Root.tsx` generates the compositions from the data, and
`WavingFlag` takes the flag's aspect ratio from the same row.

---

## Deliverables

| File | |
| --- | --- |
| `out/Japan_FlagPole.mp4` | V1, simple flag — the base case |
| `out/SaudiArabia_FlagPole.mp4` | V1, text-bearing — proves the no-mirroring rule |
| `out/Brazil_FlagCloseup.mp4` | V2, complex emblem — emblem resolution and fold distortion |
| `out/<same>.png` | one 1080p still each |
| `waving-flag-project.zip` | the 4K-render-ready project, all 60 compositions |

All three clips verified with `ffprobe`: H.264, 1920×1080, `yuv420p` (limited
range), 30 fps, 300 frames, 10.0 s, and **no audio stream**.

---

## Completion checklist

All 60 compositions are configured and were **verified by rendering a still from
every one of them** (`npm run contact-sheet`) and checking each flag's aspect
ratio, colours and orientation against its official specification. Three are
also rendered as 1080p clips; the other 57 ship configured and unrendered.

✅ = configured, textured at the verified official ratio, and visually checked.

| # | Country | Ratio | V1 `-FlagPole` | V2 `-FlagCloseup` |
| --- | --- | --- | --- | --- |
| 1 | United States | 10:19 | ✅ | ✅ |
| 2 | United Kingdom | 1:2 | ✅ | ✅ |
| 3 | Canada | 1:2 | ✅ | ✅ |
| 4 | Germany | 3:5 | ✅ | ✅ |
| 5 | France | 2:3 | ✅ | ✅ |
| 6 | Italy | 2:3 | ✅ | ✅ |
| 7 | Spain | 2:3 | ✅ | ✅ |
| 8 | Netherlands | 2:3 | ✅ | ✅ |
| 9 | Poland | 5:8 | ✅ | ✅ |
| 10 | Sweden | 5:8 | ✅ | ✅ |
| 11 | Turkey | 2:3 | ✅ | ✅ |
| 12 | Russia | 2:3 | ✅ | ✅ |
| 13 | Ukraine | 2:3 | ✅ | ✅ |
| 14 | China | 2:3 | ✅ | ✅ |
| 15 | Japan | 2:3 | ✅ **rendered** | ✅ |
| 16 | South Korea | 2:3 | ✅ | ✅ |
| 17 | India | 2:3 | ✅ | ✅ |
| 18 | Indonesia | 2:3 | ✅ | ✅ |
| 19 | Australia | 1:2 | ✅ | ✅ |
| 20 | Brazil | 7:10 | ✅ | ✅ **rendered** |
| 21 | Argentina ⚠️ ratio corrected | 9:14 | ✅ | ✅ |
| 22 | Mexico | 4:7 | ✅ | ✅ |
| 23 | South Africa | 2:3 | ✅ | ✅ |
| 24 | Nigeria | 1:2 | ✅ | ✅ |
| 25 | Egypt | 2:3 | ✅ | ✅ |
| 26 | Saudi Arabia ⚠️ text-bearing | 2:3 | ✅ **rendered** | ✅ |
| 27 | United Arab Emirates | 1:2 | ✅ | ✅ |
| 28 | Israel | 8:11 | ✅ | ✅ |
| 29 | Switzerland | 1:1 | ✅ | ✅ |
| 30 | Portugal | 2:3 | ✅ | ✅ |

⚠️ **Argentina** — the only flag whose source rendering did not match its
official proportion; corrected from 8:5 to 9:14 by a viewBox crop that keeps the
Sun of May centred and circular.
⚠️ **Saudi Arabia** — bears the shahada in Thuluth script; confirmed to read
correctly, never mirrored, in both versions and across folds that turn the cloth
away from camera.

Contact sheets of all 60 are written to `out/contact/sheet-1..3.png`.
