# Business Info Stories · Black Holes — Remotion project

Seven compositions in three looks, all 30 fps, defined at **3840×2160**, all WebGL2
via `@remotion/three` (three.js). Everything is generated in code: no footage, no
images, no logos. Fonts are OFL (Inter Light/Regular, Montserrat ExtraBold) and ship
in `public/fonts/` with their licence texts.

| Composition id | Delivery name | Length | Look / engine |
|---|---|---|---|
| `InfoStory-DataAnalysisIdea` | `InfoStory_DataAnalysisIdea` | 450 f (15 s story) | three.js scene: tilted infographic layer, vector geometry, Canvas-2D text textures, gather DoF, mip-chain bloom |
| `InfoStory-AIDAFunnel` | `InfoStory_AIDAFunnel` | 450 f (15 s story) | same, with real 3D torus rings |
| `InfoStory-SWOT` | `InfoStory_SWOT` | 450 f (15 s story) | same, with letter planes flying in |
| `InfoPlane-Background` | `InfoPlane_Background` | 600 f (20 s loop) | background plane only, calm copy space centre-left |
| `BlackHole-EmberEclipse` | `BlackHole_EmberEclipse` | 600 f (20 s loop) | full-screen fragment shader |
| `BlackHole-LensedPeach` | `BlackHole_LensedPeach` | 600 f (20 s loop) | full-screen fragment shader, analytic lensing |
| `BlackHole-LensedIce` | `BlackHole_LensedIce` | 600 f (20 s loop) | same, ice-blue colourway |

One data row per version lives in `src/versions.ts`.

## Setup

```bash
npm install
npx remotion studio          # studio previews at half resolution for responsiveness
```

**Chromium GL flag:** all looks need WebGL2 in headless Chromium with the ANGLE
backend, i.e. `--gl=angle`. It is set in `remotion.config.ts`
(`Config.setChromiumOpenGlRenderer("angle")`); on the CLI you can also pass `--gl=angle`.
On a machine with a GPU this uses it; without one, ANGLE falls back to SwiftShader (slow
but bit-exact, see timings).

## Render at 4K

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG frame capture and a long
timeout, so the commands are just:

```bash
npx remotion render InfoStory-DataAnalysisIdea out/InfoStory_DataAnalysisIdea.mp4 --gl=angle
npx remotion render InfoStory-AIDAFunnel       out/InfoStory_AIDAFunnel.mp4       --gl=angle
npx remotion render InfoStory-SWOT             out/InfoStory_SWOT.mp4             --gl=angle
npx remotion render InfoPlane-Background       out/InfoPlane_Background.mp4       --gl=angle
npx remotion render BlackHole-EmberEclipse     out/BlackHole_EmberEclipse.mp4     --gl=angle
npx remotion render BlackHole-LensedPeach      out/BlackHole_LensedPeach.mp4      --gl=angle
npx remotion render BlackHole-LensedIce        out/BlackHole_LensedIce.mp4        --gl=angle
```

720p preview of any of them: add `--scale=0.3333333333333333` (gives exactly 1280×720).

### Stills (6000×3375)

The compositions are 3840×2160, so 6000×3375 is `--scale=1.5625`:

```bash
npx remotion still BlackHole-LensedPeach out/BlackHole_LensedPeach_6K.png --frame=300 --scale=1.5625 --gl=angle
# stories: pick a frame from the final hold, e.g. --frame=420
npx remotion still InfoStory-SWOT out/InfoStory_SWOT_6K.png --frame=420 --scale=1.5625 --gl=angle
```

Text textures are drawn at a fixed high resolution (labels 200–220 px em, SWOT letters
560 px em). That is at least 1:1 with the 4K frame at each label's largest on-screen size;
at 6K the largest labels are close to 1:1 rather than above it.

## Render times

Measured in this build environment, which has **no GPU**. WebGL runs on ANGLE →
SwiftShader (CPU, 4 cores), one frame at a time (`--concurrency=1`). Times are per
frame, excluding browser start-up (`scripts/time-frames.sh`). On a real GPU expect
these to be one to two orders of magnitude faster.

| Composition | 720p measured (s/frame) | 4K (s/frame) | 4K full render, 1 thread → 4 threads (CPU) |
|---|---|---|---|
| InfoStory-DataAnalysisIdea | 2.57 | ≈ 23.7 (est. ×9.2) | 450 f ≈ 3.0 h → ≈ 45 min |
| InfoStory-AIDAFunnel | 2.51 | **23.16 (measured)** | 450 f ≈ 2.9 h → ≈ 45 min |
| InfoStory-SWOT | 2.54 | ≈ 23.4 (est.) | 450 f ≈ 2.9 h → ≈ 45 min |
| InfoPlane-Background | 2.52 | ≈ 23.2 (est.) | 600 f ≈ 3.9 h → ≈ 1 h |
| BlackHole-EmberEclipse | 3.91 | ≈ 33 (est. ×8.5) | 600 f ≈ 5.5 h → ≈ 1.4 h |
| BlackHole-LensedPeach | 0.49 | **3.78 (measured)** | 600 f ≈ 38 min → ≈ 10 min |
| BlackHole-LensedIce | 0.46 | ≈ 3.6 (est.) | 600 f ≈ 36 min → ≈ 10 min |

The 4K estimates scale each 720p figure by the measured 720p→4K ratio of its own engine:
×9.2 for the three.js scenes (from 1B) and ×7.8 for the shaders (from 3A). Eclipse is
rounded up to ×8.5 because its cost is per pixel. The 4-thread figures assume near-linear
scaling on 4 cores. The Info scenes are dominated by the 48-tap DoF gather and MSAA, the
Eclipse by its multi-octave flow noise.

## How it works

### Determinism (non-negotiable)
* Every value on screen is a function of `useCurrentFrame()` only. `src/lib/GLStage.tsx`
  renders imperatively in a layout effect on each frame change and holds its own
  `delayRender` handle until the draw has finished. There is no `useFrame` clock, no
  `Date.now()`, no state carried between frames, and no TAA.
* Randomness: `mulberry32` seeded at module level (people formation, digits, rays). In
  shaders, integer hashes (`hashU`) are bit-exact on any GPU.
* Fonts are loaded once with `FontFace` and `document.fonts.ready` before the canvas
  mounts, and text textures are built once after that.
* Loop phases come from integer arithmetic: `phaseK(k) = ((frame·k) mod period)/period`.
  Every periodic term (band slide, ring noise, dust flow, disc rotation, twinkles) uses a
  whole number of cycles, so frame 600 is bit-identical to frame 0.
* Grain and dither come from a formula of pixel position and `frame % period`. There is
  no `Math.random()` anywhere at render time.

### Info Stories (`src/info/`)
* Background plane: 40 × 24 tiles, tilted 25° (top away) and turned 15°. The fragment
  shader draws seeded tile fills, `#5A7AE8` outlines at about 25 %, digits and icons from
  a Canvas-2D atlas, sliding light bands (whole periods per story or loop) and a
  violet→blue gradient. It writes its circle of confusion into alpha.
* Depth of field: the background is rendered to a mipmapped half-float target, then a
  48-tap golden-spiral gather samples it at a mip level matched to the CoC. The
  infographic layer is rendered separately (4× MSAA) and composited sharp on top.
* Bloom: deterministic 6-level down/up mip chain. After that come vignette, about 1.5 %
  grain and ±1/255 dither.
* Lines are ribbon meshes carrying an arc-length attribute; draw-on is a shader mask.
  Type-on reveals whole letters at 2 frames per letter, using per-letter stops measured
  from the canvas.

### Black holes (`src/blackhole/`)
* **Eclipse:** a pure black anti-aliased disc. Around it: a fiery rim (noise around the
  circle, hottest upper right), domain-warped flame wisps, an upper-left red glow, a
  cream/tan dust annulus with flow noise and brown lanes, smile-shaped wings, teal haze
  and a hashed star field. Grain and dither are masked out of the disc, so it stays at
  RGB 0.
* **Lensed:** each disc image (near side, far side, upper lensed arch, lower lensed arc)
  is a nested family of ellipses A(u), B(u). The shader solves for the orbit radius u by
  bisection, then textures it with 300 orbital bands in (u, θ). Each band turns a whole
  number of times per loop: 6 turns inside, 1 outside. Where bands fall below a pixel,
  coarser band groups take over, like mip levels, so the texture stays fibrous instead
  of shimmering. Doppler boosts the approaching left side.

## Checks (scripts in `scripts/`)

The scripts need `ffmpeg` (for `framemd5` pixel hashes) and `bc` on the PATH.

| Check | Script | Result in this build |
|---|---|---|
| Loop seam: frame 600 == frame 0, pixel for pixel (4 loops) | `scripts/check-loop.sh` | PASS ×4 (md5 of decoded pixels identical) |
| Determinism: cold frame 300 == frame 300 of a 4-thread sequence render (7 comps) | `scripts/check-determinism.sh` | PASS ×7 (byte-identical PNG pixels) |
| Eclipse disc is pure black | pixel read of the 720p still | PASS: all 63,348 pixels inside the disc are RGB (0,0,0) |
| Banding: pixel profiles across glows and blurred gradients (from PNG stills) | see below | PASS (no plateaus; see notes) |

`check-loop.sh` passes `--props='{"loopCheck":true}'`. That makes each loop 601 frames
long and turns off the modulo, so frame 600 really evaluates every periodic function at
t = 1.0 rather than wrapping back to frame 0.

**Banding notes.** No mp4s were encoded in this build (stills only, at the client's
request), so the profiles were read from the PNG stills. Each profile is 160 samples,
averaged over a 13-px strip to remove grain. Profiles: Eclipse red glow outward and teal
haze downward; 3A and 3B halo into the background, upward and diagonally; 1D blurred
background, horizontal and vertical. No profile has a flat run longer than 7 samples, so
there are no quantisation plateaus. The few larger steps come from stars, dust filaments
and tile edges, not bands. Grain is 2 % (black holes) and 1.5 % (Info Stories), plus
±1/255 triangular dither. **After encoding at 4K, re-check the H.264 output** with the
same kind of profile. If it bands, raise `grain` in `src/versions.ts`, up to 0.03.

### Completion checklist
- [x] 7 compositions, 3840×2160, 30 fps, 450 / 600 frames
- [x] WebGL2 via `@remotion/three`, ANGLE, no WebGPU, no PixiJS, no MCP
- [x] OFL fonts only (Inter, Montserrat) with licences; no Roboto
- [x] No logos or brands; text limited to the listed words plus background digits
- [x] Seeded randomness; frame-pure rendering; loop seams bit-exact
- [x] Dither and grain from a pixel + frame formula; Eclipse disc grain-free
- [x] 720p stills of every composition
- [ ] 4K video renders: not done here, by request (commands above)
- [ ] 720p preview videos: skipped at the client's request (stills only)

## Adding a colourway

Colourways are just rows in `src/versions.ts`. For example, a violet lensed black hole:

```ts
{
  id: "BlackHole-LensedViolet",
  file: "BlackHole_LensedViolet",
  frames: 600,
  loop: true,
  factory: createLensed({
    period: 600,
    ring: "#FAF4FF", inner: "#D0A0FF", outer: "#6A3AC8",
    bg0: "#0C0618", bg1: "#160A28", shadowGlow: "#9A80C4",
    grain: 0.02,
  }),
},
```

The Eclipse palette (`createEclipse({...})`) works the same way. Keep `period` at the
composition length so the loop stays exact.
