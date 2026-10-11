# Meta Blobs · Wave Fins · Glow Rings

Three abstract looks, eight colourways, one Remotion project. Every composition is a
**20 s seamless loop** (600 frames at 30 fps), defined at **3840×2160**, rendered with
**three.js on WebGL2** through `@remotion/three`. No text, logos or brands; everything
is generated in code.

| Composition id | Look | Engine |
|---|---|---|
| `MetaBlobs-NeonBlueMagenta` | 1A, neon blue/magenta on black | raymarched SDF fragment shader |
| `MetaBlobs-WhiteMatte` | 1B, porcelain white on pale grey | raymarched SDF fragment shader |
| `MetaBlobs-SunsetCoral` | 1C, coral/amber on black | raymarched SDF fragment shader |
| `WaveFins-Blue` | 2A, steel blue fins | three.js instanced meshes + gather DoF + bloom |
| `WaveFins-Copper` | 2B, copper fins | three.js instanced meshes + gather DoF + bloom |
| `GlowRings-Magenta` | 3A | fullscreen fragment shader |
| `GlowRings-Violet` | 3B | fullscreen fragment shader |
| `GlowRings-Teal` | 3C | fullscreen fragment shader |

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio canvas runs at half resolution for interactivity)
```

Versions are pinned in `package.json` (Remotion 4.0.515, three 0.180.0,
@react-three/fiber 9.3.0, React 19.2.3).

### Chromium GL flag

WebGL2 in headless Chromium needs ANGLE. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`; on the command line it is **`--gl=angle`**.
On a machine with a GPU, ANGLE uses it. Without one (CI, containers), Chromium falls
back to SwiftShader: it works and gives the same pictures, only slower (see timings).

`remotion.config.ts` also sets PNG frames, H.264, `yuv420p`, CRF 16 and concurrency 1.

## Render at 4K

```bash
npx remotion render MetaBlobs-NeonBlueMagenta out/MetaBlobs_NeonBlueMagenta.mp4 --gl=angle
npx remotion render MetaBlobs-WhiteMatte      out/MetaBlobs_WhiteMatte.mp4      --gl=angle
npx remotion render MetaBlobs-SunsetCoral     out/MetaBlobs_SunsetCoral.mp4     --gl=angle
npx remotion render WaveFins-Blue             out/WaveFins_Blue.mp4             --gl=angle
npx remotion render WaveFins-Copper           out/WaveFins_Copper.mp4           --gl=angle
npx remotion render GlowRings-Magenta         out/GlowRings_Magenta.mp4         --gl=angle
npx remotion render GlowRings-Violet          out/GlowRings_Violet.mp4          --gl=angle
npx remotion render GlowRings-Teal            out/GlowRings_Teal.mp4            --gl=angle
```

All eight use the same encoder settings (H.264, `yuv420p`, CRF 16 from
`remotion.config.ts`); no special Glow Rings encode is needed (see Banding).

### Stills at 6000×3375

```bash
npx remotion still MetaBlobs-NeonBlueMagenta out/MetaBlobs_NeonBlueMagenta_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Swap the composition id for any of the eight. `--scale=1.5625` turns 3840×2160 into
6000×3375; the canvas drawing buffer follows the scale, so the shaders really render at
6000×3375 (not an upscale).

### 720p previews

```bash
scripts/render-previews.sh          # all 8 -> out/previews/*.mp4 + out/stills/*.png
scripts/verify.sh                   # ffprobe, loop seam, cold-start determinism
```

`--scale=0.3333333333333333` gives exactly 1280×720 (checked with ffprobe on every
frame sequence and every mp4).

## Render times

Measured in this sandbox: **no GPU**, so Chromium ran WebGL2 on SwiftShader (software)
on 4 vCPUs, concurrency 1. These are worst-case numbers; on a machine with a GPU the
shader work drops by orders of magnitude and frame capture/PNG encoding dominates.

**720p (1280×720), per frame** (full 600-frame renders, final code):

| Composition | s / frame | 600-frame render |
|---|---|---|
| MetaBlobs-NeonBlueMagenta | 0.90 | 538 s |
| MetaBlobs-WhiteMatte | 0.73 | 440 s |
| MetaBlobs-SunsetCoral | 0.82 | 494 s |
| WaveFins-Blue | 3.7 | 2239 s |
| WaveFins-Copper | 3.8 | 2284 s |
| GlowRings-Magenta | 0.79 | 472 s |
| GlowRings-Violet | 0.78 | 467 s |
| GlowRings-Teal | 0.84 | 503 s |

**Real 4K frames** (3840×2160, frames 300–302; "GPU" = WebGL render + readback measured
in the page, "wall" = marginal wall-clock per frame incl. screenshot + PNG):

| Composition | GPU-side render | wall clock / frame |
|---|---|---|
| **1A** MetaBlobs-NeonBlueMagenta (24-blob raymarch + glow + bloom) | **6.0–6.6 s** | 7.1 s |
| **2A** WaveFins-Blue (fins + MSAA + 80-tap gather DoF + bloom) | **24.6–25.5 s** | 25.2 s |
| 3A GlowRings-Magenta (for reference) | 5.0 s | 5.7 s |

1A is under the ~8 s threshold, so the per-tile blob culling was not needed: the
per-ray bounding-sphere culling already limits each ray to the 0–3 blobs it can touch,
and at 4K about half of the frame time is the screenshot/PNG path, not the raymarch.

**4K estimate per composition** (600 frames, this software-GL sandbox; a GPU machine will be
much faster):

| Composition | estimate |
|---|---|
| MetaBlobs (each of 3) | ~65–75 min |
| WaveFins (each of 2) | ~4.2 h |
| GlowRings (each of 3) | ~55–60 min |

Raising `Config.setConcurrency` helps only when the GPU isn't the bottleneck; on SwiftShader
one tab already uses every core.

## Determinism

Remotion renders frames out of order across tabs, so every pixel is a pure function of
`useCurrentFrame()`:

* All random layout (blob sizes, positions, groups, sway phases) comes from
  `mulberry32` seeded **at module level** (`src/metablobs/blobs.ts`). There is no
  `Math.random()` anywhere.
* Time enters only as `phase = (frame % 600) / 600`. Every motion is a whole number of
  cycles of that phase, so frame 600 is the same picture as frame 0 *and* the motion
  is continuous across the seam.
* Grain and dither are integer hashes (PCG3D) of pixel position and `frame % 600`.
* No `Date.now()`, no `useState` for visuals, nothing carried between frames, no TAA.
  Depth of field and bloom are single-frame passes with fixed sample patterns.
* `@remotion/three` calls R3F's `advance()` once per frame; the project registers a
  priority-1 `useFrame` callback only as the hook that runs its own render pipeline.
  The callback ignores R3F's clock/delta and reads the frame number from
  `useCurrentFrame()`.
* The Wave Fins environment map is drawn once into a canvas (fixed panels, no
  randomness) and pre-filtered with PMREM, identically in every tab.

## How it is built

**Meta Blobs** (`src/metablobs`). 24 spheres in 16 groups (10 singles, 4 pairs,
2 triplets), radii 0.35–1.3 (larger near the camera), in x ∈ [−6, 6], z ∈ [−5, 1.5]. The field is a polynomial
smooth-min (k = 0.55). Groups rise with a vertical period H = 11 and travel exactly 1 or
2 periods per loop; each group wraps as a unit, and its radius is limited by its depth
so that it (and its glow halo) is outside the frustum when it wraps, which means no pop.
Members of a group breathe apart and together (whole cycles), so peanuts form and
split. Camera: fixed, fov 38°, at z = 7.5 looking along −z. The raymarcher (≤ 96 steps)
first intersects each ray with every blob's bounding sphere inflated by k, and marches
only between the nearest entry and the farthest exit, evaluating only those blobs. That
is exact, because a blob more than k away along the ray cannot change a polynomial smin
at the surface. Normals come from the tetrahedral gradient, AO from 4 taps. Silhouettes
are anti-aliased by shading the ray's closest approach and blending by cone coverage.
Neon shading: a milky body carrying a very soft A→B gradient (light A upper left,
light B right), the two colours concentrated in a soft rim band and a fresnel edge,
and far blobs slightly darker. The glow halo (colour A) uses the analytic
closest-approach distance in frame-height units. It falls off over about 2–3% and is cut to
exactly zero beyond 4.5%, so blobs wrapping outside the frame never pop. White shading:
high-ambient diffuse light from the upper left, F8 to C8 grey with AO, near blobs pushed
toward white, a thin darker rim line with a brighter band inside it, a slightly
translucent edge, and depth fog toward the background. Neon post: bloom mip-chain, then
grain 1.5% and dither.

**Wave Fins** (`src/wavefins`). 20 instanced `PlaneGeometry(1.2, 6, 64, 256)` fins,
0.55 apart, turned 60°, the row leaning about −32°. The vertex shader bends each fin by
`A(t)·sin(y·k + φ(t) + i·δ(t))` plus a second harmonic and a slight cross-curvature,
with normals from the analytic derivative. Material: `MeshStandardMaterial` (metalness
1, roughness 0.28) extended in `onBeforeCompile` with the bend, a thin leading-edge
highlight band (fresnel weighted, brightness drifting along the edge), and a contact
darkening where each fin tucks behind its neighbour, plus a metal→highlight tone ramp
(bright reflections shift toward the version's highlight colour; per-version strength). The environment is a canvas
equirect with 3 soft panels on black, put through PMREM, and its rotation sweeps on a
closed path. One point key light also moves on a closed path. The camera does one
closed lap: ±1.2 sideways drift, ±8° orbit and a slight push. Post: 4× MSAA scene
target (view depth in alpha, mipmapped), then an 80-tap golden-spiral gather DoF
focused on the middle fins. Each tap reads mip ≤ 1, pre-blurred to about half the tap
spacing, so thin highlights don't leave a copy at every tap. After that come a bloom
mip-chain, vignette, grain 1.5% faded to zero below 3%
luminance, and dither.

**Glow Rings** (`src/glowrings`). Rings are centred at (50%, −25%) of the frame and drift
on a small closed path. Six rings are alive at once; ring *i* is at life
`(t + i/6) mod 1`, so its radius grows from 0.2 to 1.6 frame heights. Each ring is a
Gaussian core (σ 4.2–7.5% of frame height, widening with age) plus a 3.2× wider faint
halo. A ring is visible for about the middle half of its life, so two or three arcs show at once, each
slightly off-centre so the arcs aren't perfectly concentric. The top-centre hot spot is a compact
breathing glow, with a faint tint haze beside it. Arc brightness is 3D value noise sampled on (cos θ, sin θ) offset around a
circle in time, so the bright stretches slide around the ring and loop. The inner tint
copy sits 0.9σ inside at 25%. A faint breathing centre glow, a slight vignette, then
grain 2.5% (not faded in the darks) and dither.

## Adding a colourway

Every version is one data row in `src/versions.ts`. To add one, copy a row, give it a
new `id` (letters, digits and `-` only) and change the colours:

```ts
// src/versions.ts, in GLOW_RINGS
{ id: "GlowRings-Amber", props: { ring: "#B8803A", tint: "#5A6A8A", background: "#060402", grain: 0.025 } },
```

`Root.tsx` maps each array to compositions, so nothing else needs editing. Fields:

* **Meta Blobs:** `mode` (`"neon"` or `"white"`), `colorA` (neon: upper-left light, rim
  and glow; white: lit side), `colorB` (neon: right light; white: shadow grey),
  `background`, `backgroundCentre` (white mode only), `glow`, `bloom`, `grain`.
* **Wave Fins:** `metal`, `highlight`, `panelA`, `panelB` (environment light panels),
  `keyLight`, `background`, `envIntensity`, `edgeStrength`, `bloom`, `grain`.
* **Glow Rings:** `ring`, `tint`, `background`, `grain`.

Add the new id to the list in `scripts/render-previews.sh` / `scripts/verify.sh` if you
use them.

## Banding

Checked on frames **decoded from the encoded mp4s** (not the renderer output), with
`scripts/banding.py`: profiles averaged over a 9-px strip, plus a contrast-stretched copy
of the frame so any steps become obvious.

| Area | Result |
|---|---|
| Glow Rings, ring peak → black (all 3 colours, 3.6× stretch) | smooth; largest 1-px step in the averaged profile 3.9–4.3 codes (grain level), no plateaus or contour rings |
| White Matte background (4.6× stretch) | smooth; the lighter centre falls off without contours; max step 4.9 codes |
| Neon glow halo (1A), blob edge → black | blue channel 165 → 1 over ~36 px in monotone steps; no plateaus |
| Wave Fins gaps | 44–51 % of the frame below 8/255; mean inside those 1.5, max 8 — clean black (grain faded below 3 % luminance, dither off below half a code) |

Grain: 2.5 % Glow Rings (not faded in the darks), 1.5 % Meta Blobs, 1.5 % Wave Fins (faded
to zero below 3 % luminance); ±1/255 triangular dither in every final pass; both are
integer hashes of pixel position and `frame % 600`.

**Glow Rings encoder fix: none needed.** The first previews were encoded with x264
`-tune grain` as a precaution. A side-by-side test on 60 frames encoded with and without
it showed no banding in either (max step 4.0 vs 4.4 codes, visually identical at 3.6×
stretch); the plain encode is ~23 % smaller, so the final previews use the plain settings
(CRF 16, no `-tune`). Grain was not raised and CRF 14 was not needed.

Brightest peaks (the top hot spot, blurred to ignore grain): 36–43 % in the brightest
channel, i.e. 20 % (Magenta, Violet) and 28 % (Teal) as Rec.709-weighted luma of the
encoded values. That is a little under the 30–40 % the brief suggested: the reference
reviews repeatedly found the rings too bright, so they were dimmed until they read like the
references. Raise the `0.066` ring gain in `GlowRings.tsx` to lift them.

## Completion checklist

Verify loop as run on the final 720p previews (`scripts/verify.sh`, `scripts/banding.py`,
`scripts/motion.py`):

- [x] **Step 1 – files:** all 8 are h264, `yuv420p`, 1280×720, 30/1, 600 frames, 20.0 s,
      video stream only (no audio).
- [x] **Step 2 – loop:** 601-frame variant (`--props='{"loopCheck":true}'`), frame 600 ==
      frame 0 byte for byte for all 8. The motion is continuous across the seam: the
      599→600 change equals an ordinary 0→1 step (ratio 0.97–1.00).
- [x] **Step 3 – determinism:** frame 300 rendered alone from a cold start == frame 300
      of the full render, byte for byte, for all 8.
- [x] **Step 4 – banding:** see Banding; smooth everywhere, Wave Fins gaps clean black.
- [x] **Step 5 – contact sheets:** blobs (spheres, peanuts and triples at several sizes,
      rising, merging/splitting, two-colour lighting + halo / white with thin rims and
      softer distant blobs), fins (row of thin curved fins, S/C/diagonal shapes over the
      loop, edge highlights, travelling light, black gaps, soft near/far fins), rings
      (crescents from above-frame centres, expanding, faint inner tint, dark). No text.
- [x] **Step 6 – motion:** frame-to-frame change over 2 s around frame 300 and over the
      full loop. Blobs and rings: max ≤ 1.19× median (no pops, flicker or pulsing); fins:
      the step size varies smoothly with the camera speed (largest change between
      neighbouring steps 0.29 on a median of 1.8, no jumps). The DoF edge-ghosting found in
      an earlier version was fixed (mip-prefiltered taps).
- [x] **Step 7 – self comparison** with the references (1A, 1B, 2A, 2B, 3A, 3B) after
      every tuning pass.
- [~] **Step 8 – independent comparison** (fresh agents, given only the two frames and
      the fixed instruction) for 1A, 1B, 2A, 2B, 3A, over three rounds; each round's
      findings drove the next change.
      - 1A, 1B, 3A: the remaining notes are mostly layout (the reference frames are
        different moments of a different random arrangement), the requested film grain,
        and, for 1B, the reference's glassy translucency, which goes beyond the matte
        porcelain the brief describes.
      - **2A / 2B: not fully matched after the third attempt.** Reviewers still report:
        fins that curve into arches on the right instead of the reference's evenly
        spaced backward-bowing crescent blades with long tails to the lower left; uneven
        width and spacing from perspective; blue lighter and less saturated / copper
        more rust-orange than the reference's deep royal blue / champagne-silver; and
        faint stacked thin lines along some fin rims in the DoF.
- [x] 4K timing of 1A (≤ 8 s GPU-side, so no tile culling) and 2A recorded; 720p timing
      for all 8 recorded.
- [x] `npm install && npx remotion studio` from a clean copy of the zip: installs, type
      checks, the Studio serves, and all 8 compositions bundle and list.
- [x] No text, logos or brands; no MCP servers; everything generated in code.
