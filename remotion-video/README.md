# Dental 3D loops — 12 versions

Twelve seamless 3D tooth animations built with **Remotion + three.js (WebGL)**, one per
supplied reference clip. Every version is a real-time WebGL scene rendered
frame-accurately by Remotion — no pre-baked frames, no external render farm.

- **30 fps**, H.264 / MP4, 16:9
- Each version's duration matches its reference clip
- Every version is a **seamless loop** — the last frame flows back into the first
- Every version is registered at **both 1920×1080 and 3840×2160**, from the same component

## The 12 versions

| # | Name | Duration | Frames | What it is |
|---|------|----------|--------|------------|
| 01 | `WireframeHalo` | 10.000s | 300 | Low-poly glowing wireframe tooth on deep navy |
| 02 | `ScanSweep` | 10.000s | 300 | As 01, with a magenta analysis plane travelling up through it |
| 03 | `EnamelShield` | 7.033s | 211 | Honeycomb shield gathers, coats the tooth, dissolves |
| 04 | `MintStudio` | 10.000s | 300 | Glossy enamel on a seamless mint cyclorama |
| 05 | `XRay` | 7.567s | 227 | Additive x-ray volume, roots dissolving into a beam |
| 06 | `MolecularOrbit` | 13.567s | 407 | Pearlescent tooth inside a swarm of orbiting spheres |
| 07 | `HudAnalysis` | 13.333s | 400 | Dark glass tooth on a reflective floor, flanked by readouts |
| 08 | `AtomCage` | 13.600s | 408 | Orbit rings accumulating into an atomic cage |
| 09 | `BubbleShield` | 8.033s | 241 | Soap bubble sealing around the tooth above a mirror floor |
| 10 | `SoftBlue` | 12.000s | 360 | Minimal glossy tooth on a soft powder-blue field |
| 11 | `LatticeScan` | 10.000s | 300 | White tooth under a blue measurement lattice |
| 12 | `ReflectiveFloor` | 5.033s | 151 | Small tooth turning on a glossy blue surface |

Durations are the reference clips' durations re-timed to 30 fps and rounded to the
nearest whole frame, so a few differ from the reference by up to ~17 ms.

## Rendering

```console
npm i

npm run render:1080p      # all 12 at 1920x1080  -> out/1080p
npm run render:4k         # all 12 at 3840x2160  -> out/4K
```

The script bundles once and then renders every version, which is most of the
wall clock saved on a machine without a GPU. Options:

```console
node scripts/render-all.mjs --res=4k --only=01,07     # just those versions
node scripts/render-all.mjs --res=4k --out=deliver/4k # somewhere else
node scripts/render-all.mjs --crf=14                  # higher quality
node scripts/render-all.mjs --concurrency=8           # more parallel tabs
```

Single composition, straight from the CLI:

```console
npx remotion render Tooth-07-HudAnalysis-4K out/hud-4k.mp4 --codec=h264 --image-format=png --crf=16 --muted
```

Browse and scrub everything in the Studio:

```console
npm run dev
```

### File sizes

At the default CRF 16 most versions land between 1 and 11 MB. Versions 01 and 02
are the exception at ~48 MB: thousands of thin, high-contrast, moving wireframe
edges are about the worst case there is for H.264. `--crf=23` brings them to
~24 MB with no visible difference at 100%, and barely moves the others.

### A note on 4K render time

These are software-rendered WebGL scenes unless the rendering machine exposes a
GPU to headless Chrome. 4K is four times the pixels of 1080p and the hero mesh is
188k triangles, so expect 4K to take roughly 4–5× as long as 1080p. On a GPU
machine, pass `--gl=angle-egl` (or `--gl=vulkan`) to `remotion render` to use it.

## How it fits together

```
src/tooth/
  config.ts            fps, the two output resolutions, model paths
  assets.tsx           loads every geometry variant and gates the canvas on it
  loaders.ts           decoders for the tooth binaries
  environment.tsx      procedurally generated studio environment maps
  stage.tsx            the <ThreeCanvas/> wrapper, loop maths, DOM scaling
  parts.tsx            backdrop, particles, halos, contact shadow, reflection
  shaders/materials.ts every hand-written material
  versions/V01..V12    one file per version
public/models/         the tooth geometry (see below)
scripts/render-all.mjs batch renderer
```

Five things are worth knowing before changing anything:

**Seamless looping.** Every scene is driven by `t = frame / durationInFrames`,
and only through whole-cycle periodic functions (`wave`, `cwave`, `saw`, `ping`
in `stage.tsx`). Rotations are whole turns; orbiting beads complete a whole
number of laps; camera moves breathe in and back out. If you add motion, express
it in `t` the same way or the loop will jar.

**1080p and 4K come from one component.** Anything measured in pixels — shader
line widths, point sprite sizes, CSS in the HUD overlay — must be multiplied by
`usePxScale()` (1 at 1080p, 2 at 4K) or authored inside `<ScaledDom>`, which lays
out at 1920×1080 and scales. Otherwise the 4K render is not a true 2× of the
1080p one: screen-space derivatives are measured in real pixels, so lines come
out half as thick.

**Vignettes and glows are eased, never linear.** A CSS gradient interpolates
linearly between stops, so a two-stop fade changes slope abruptly at each end
and the eye reads that as a ring across an otherwise smooth background. The
vignette therefore lives in the backdrop shader as
`pow(smoothstep(start, end, d), power)` — zero derivative at the onset, with the
exponent keeping the near field flat so the corners can still go properly dark.
Overlays that genuinely have to sit above the canvas (version 03's soft-focus
glow, which hazes the tooth too) use `easedRadialGradient()`, which samples the
same curve into enough CSS stops that neither end kinks.

**The background lives in the 3D scene, not in CSS.** `<SceneBackdrop>` draws it
as a full-screen quad inside WebGL. With a transparent canvas over a CSS
backdrop there is nothing for additive glows to add to, and semi-transparent
pixels get their alpha applied twice during page compositing — halos and ripples
come out *darker* than the background instead of brighter. An opaque canvas makes
every blend mode behave. DOM layers on top of the canvas (the HUD in version 07)
are fine.

**Assets must load before the canvas mounts.** `<ThreeCanvas>` draws the scene
once per Remotion frame from an effect keyed on the frame number. A mesh that
arrives after that effect has run will not appear, because nothing re-draws.
`<WithToothAssets>` therefore blocks its children until every geometry is
decoded. Do not load anything the WebGL scene needs from inside the canvas.

## The tooth geometry

`public/models/` holds the supplied model, re-centred on its bounding box and
scaled to exactly 2 units tall so every scene can size it predictably, plus three
derived variants:

| File | Contents | Used by |
|------|----------|---------|
| `tooth.glb` | the normalised source model, with a material attached | external tools |
| `tooth-full.bin` | 97,635 verts / 188,158 tris, with UVs | every solid version |
| `tooth-midpoly.bin` | 10,639 verts / 21,306 tris | shipped for edits, not loaded |
| `tooth-lowpoly.bin` | 2,525 verts / 5,052 tris | versions 01 and 02 |
| `tooth-points.bin` | 24,000 area-weighted surface samples | the point clouds |

The `.bin` files are flat little typed-array dumps rather than glTF, so decoding
is a handful of `Float32Array` views instead of a parser, and the low-poly and
point-cloud variants — which glTF has no notion of — travel in the same format.
`src/tooth/loaders.ts` documents the layout.

## Other compositions in this project

`BluetoothExplainer` and `ParticleRingHalo` predate this work and are unrelated
to the dental versions. They are left registered and untouched.

---

Built with [Remotion](https://remotion.dev). Note that for some entities a
company license is needed — [read the terms](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
