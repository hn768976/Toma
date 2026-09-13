# Digital Globe — 4K Remotion composition

A recreation of the reference clip: a dot-matrix globe turning inside a thin
orbit ring, over a drifting field of binary digits with a soft key light on the
right. Two colour grades ship from one scene graph.

| | |
|---|---|
| Master resolution | 3840 × 2160 (UHD 4K) |
| Delivery resolution | 1920 × 1080 |
| Frame rate | 30 fps |
| Duration | 331 frames = 11.033 s (matches the 11.04 s reference) |
| Codec | H.264 / MP4, yuv420p, CRF 16 |
| Audio | none (the reference is silent) |

## Compositions

| ID | Size | Grade |
|---|---|---|
| `GlobeViolet4K` | 3840 × 2160 | violet / magenta — matches the reference |
| `GlobeDarkBlue4K` | 3840 × 2160 | cool dark blue |
| `GlobeViolet1080` | 1920 × 1080 | violet / magenta |
| `GlobeDarkBlue1080` | 1920 × 1080 | cool dark blue |

The 1080p entries are **not** downscales of a 4K render. The whole scene is
vector, authored in a fixed 3840 × 2160 design space and projected through an
SVG `viewBox`, so every composition rasterises natively at its own resolution.
Rendering 4K resolves more of the globe's dashes rather than just enlarging
them.

## Usage

```bash
npm install

# preview
npm run dev

# render
npx remotion render GlobeViolet4K    out/globe-violet-4k.mp4
npx remotion render GlobeDarkBlue4K  out/globe-darkblue-4k.mp4
npx remotion render GlobeViolet1080  out/globe-violet-1080p.mp4
npx remotion render GlobeDarkBlue1080 out/globe-darkblue-1080p.mp4

# or both at a time
npm run render:4k
npm run render:1080
```

On a headless box without a Chrome download you can point Remotion at an
existing headless shell:

```bash
npx remotion render GlobeViolet4K out/globe-violet-4k.mp4 \
  --browser-executable=/path/to/headless_shell
```

## How it is built

| File | Role |
|---|---|
| `src/config.ts` | design space, fps, duration |
| `src/theme.ts` | the two colour grades as pure data |
| `src/Scene.tsx` | layer stack, lighting, camera, grade |
| `src/Globe.tsx` | sphere projection and dash rasteriser |
| `src/BinaryField.tsx` | the drifting digit field |
| `src/world-mask.ts` | generated land mask (see below) |
| `src/random.ts` | seeded PRNG — no `Math.random()` anywhere |

**Globe.** Latitude/longitude samples are projected orthographically with a 12°
viewing tilt, back-hemisphere points are culled, and each surviving land point
becomes a short horizontal dash. Longitude compresses towards the limb, so dash
length is scaled by `|cos λ|` — without that the marks overlap into a solid
smear at the edges instead of tightening into fine lines. Dashes are bucketed
into three brightness tiers and emitted as three `<path>` elements rather than
a few thousand nodes, which is what keeps a 4K frame cheap.

**Land data.** `src/world-mask.ts` is generated from `world-atlas`' `land-50m`
(Natural Earth, public domain), scanline-rasterised to a 720 × 360 equirectangular
grid and bit-packed into base64. It is committed so the project has no build
step and no network dependency at render time.

**Soft light.** Every bright element is drawn twice — a Gaussian-blurred
`screen`-blended pass underneath, then the crisp pass on top. Blur radii are
expressed in `viewBox` user units, so the bloom scales with the composition and
looks identical at 1080p and 4K. The key light on the right is layered radial
gradients rather than a single hard flare.

**Determinism.** Every frame of a Remotion render is an independent evaluation
of the component tree, so nothing may depend on wall-clock time or
`Math.random()`. The digit field is generated from a fixed seed, and the
monospace font is bundled in `public/fonts` and awaited via `delayRender` so a
render is identical on any machine.
