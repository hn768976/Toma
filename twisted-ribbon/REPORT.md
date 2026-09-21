# Verify-loop report

All numbers below are measured, not estimated, unless explicitly marked as an
estimate. Luminance is relative luminance computed from linearised sRGB
(0.2126R + 0.7152G + 0.0722B), so "≥ 0.5" is on the same scale the brief uses.

Reference clip for comparison: `istockphoto-1484581202`, 768×432, 30fps, 6.0s.
Measured reference statistics (frame at t=1.5s): min luminance 0.482, mean
0.680, median 0.648, p95 0.945, max 0.996; mean RGB 211.0 / 214.9 / 219.1.

---

## Step 1 — Objective checks

`ffprobe` on both encoded files:

| | `TwistedRibbon_Light.mp4` | `TwistedRibbon_Dark.mp4` |
|---|---|---|
| codec | h264 | h264 |
| resolution | 1920×1080 | 1920×1080 |
| frame rate | 30/1 | 30/1 |
| pixel format | yuv420p | yuv420p |
| duration | 10.000000 s | 10.000000 s |
| audio stream | none | none |

No audio stream is present in either file. This comes from the render config
(`setEnforceAudioTrack(false)` + `setMuted(true)`), not from stripping the track
afterwards.

**Passed first time.**

---

## Step 2 — Loop closure

A 300-frame seamless loop means frame 300 equals frame **0**, not frame 299.
The composition was temporarily extended to 301 frames (the loop *period* is a
separate constant, so extending the composition does not change the rotation per
frame), frames 0 and 300 rendered as PNGs at 1920×1080, and compared
channel-by-channel.

| | differing pixels | max channel delta |
|---|---|---|
| `TwistedRibbonLight` | 0 / 2,073,600 | 0 |
| `TwistedRibbonDark` | 0 / 2,073,600 | 0 |

Both **pixel-identical**. Control: frame 0 vs frame 299 differs in 1,877,621
pixels with max channel delta 36, so the comparison is not passing trivially.

**Passed first time**, and it is exact by construction rather than by tuning:

- the geometry is **bit-exactly invariant under Ry(π)**. The curve satisfies
  `p(u + π) = Ry(π)·p(u)`, and with an even `k` the whole swept surface inherits
  that symmetry; the second half of the loop is built from that identity rather
  than by re-evaluating the trig, so the mirror is exact in floating point.
  `npm run verify:geometry` asserts max |delta| = 0 over every position and
  normal.
- the rotation matrix is built by hand so the half-turn is an **exact sign
  flip**. `Math.cos(phase + π)` and `-Math.cos(phase)` can differ in the last
  bit, and one bit in the model matrix is enough to move a rasterised edge by a
  pixel. Reducing to `[0, π)` and carrying the sign separately makes frame 300
  the exact negation of frame 0.

### Determinism

| comparison | result |
|---|---|
| frame 150 standalone, cold start, twice | 0 / 2,073,600 differing |
| frame 150 standalone vs frame 150 from a 3-thread sequence render | 0 / 2,073,600 differing |

---

## Step 3 — Geometry integrity

`npm run verify:geometry`, all passing:

```
params R=1 A=0.4R h3=0.05R k=2 width=0.3R thickness=0.015*width segments=1800
verts=14408 tris=14400

PASS  symmetry shortcut matches direct   max deviation 1.6e-15
PASS  seam closes exactly                max gap 0
PASS  Ry(pi) invariance is bit-exact     max |delta| 0
PASS  no normal discontinuity            max ring-to-ring turn 0.375 deg
PASS  silhouette tessellation            max turn per segment 0.401 deg
PASS  no degenerate triangles            0 found
PASS  winding matches normals            0 back-facing tris
```

- **No seam.** The last ring of vertices is bit-identical to the first, so there
  is no line, crease or normal discontinuity at the join. This required
  distributing the parallel-transport closure residual evenly around the loop;
  the raw holonomy is ~0.36 rad and would otherwise show as a visible twist
  discontinuity.
- **No faceting.** 1800 segments; the largest turn between consecutive segments
  is 0.40°, i.e. the silhouette never deviates from smooth by more than a
  fraction of a pixel even at 4K.
- **No Frenet crease.** The frame is a double-reflection rotation-minimising
  frame. A Frenet frame would flip at every inflection point of this curve and
  put a hard 180° crease in the band.
- **Thin edge face visible.** Confirmed by inspecting a 4K still at 100%: the
  edge face reads as a distinct narrow strip of its own value between the wide
  face and the background, not a rounded blend. It is ~11px wide at 4K. It is
  *not* resolvable at 768px, which matters when reading the step-5 critique
  below.
- **Cropped by all four frame edges at every rotation.** Verified
  geometrically rather than by thresholding a render — the band's shadowed
  underside is *darker* than the backdrop, so no brightness threshold can
  separate band from background. `npm run verify:framing` rasterises the
  silhouette through the real camera and reports per-edge coverage; the minimum
  coverage over any edge at any sampled frame is 0.085 (frame 25, bottom edge),
  i.e. never zero. Confirmed visually at frames 0, 75, 150 and 225.

---

## Step 4 — Per-version criteria

### Both versions

| check | result |
|---|---|
| band visibly crosses over itself, crossing off-centre | yes — crossing sits ~0.61 of frame width at frame 0, right of centre |
| self-shadow where the near band passes over the far band | yes |
| far side visibly softer than the near side, still legible | yes |
| crossing at a different position at frame 225 than frame 0 | yes — silhouette fill 0.184 at frame 0 vs 0.297 at frame 225; the compositions are plainly different |

The self-shadow needed a real fix: `shadow.normalBias` was initially 0.012,
which is *larger than the band's thickness* (0.0045). That offsets the shadow
lookup clean off the surface and self-shadowing disappeared entirely. It is now
0.0022, well under the thickness.

### V1 — Light

| check | requirement | measured |
|---|---|---|
| darkest pixel luminance | ≥ 0.5 | **0.533** (frames 75/150/225), 0.539 (frame 0), 0.545 (frame 299) — measured on frames extracted from the encoded mp4 |
| background gradient scanlines, no stepped plateaus | smooth | mean run length 1.64–1.80 px, 22–34 distinct values per scanline |
| band brighter than background across its lit area | yes | at frame 75, band median **0.855** vs background median **0.639**; band spans 0.571–0.951, background 0.533–0.793. Measured separately over band and backdrop using the silhouette coverage mask, eroded 14 px so depth-of-field bleed at the silhouette belongs to neither set |
| mean luminance vs reference | — | 0.677 / 0.686 / 0.677 at frames 0 / 75 / 299 against the reference's 0.680 |
| peak luminance | — | 0.951–0.969 against the reference's 0.996 |

Banding was measured on PNGs **extracted from the encoded mp4**, not on the
preview. Horizontal and vertical scanlines across the background gradient show
values changing every 1–2 pixels with no stepped plateaus.

### V2 — Dark

| check | requirement | measured |
|---|---|---|
| read test: shadowed face vs background vs lit edge | shadowed darker, lit edge substantially brighter, not a narrow range | at frame 75: background median **0.0084**, band shadowed face (p05) **0.0075**, lit edge **1.000**. Ordering correct, and the three are nowhere near a narrow range. See the caveat below for frame 150 |
| rim line continuous along the silhouette | continuous | yes, after a fix (below). Peak luminance per frame: 0.887 / 1.000 / 0.956 / 1.000 / 0.880 at frames 0 / 75 / 150 / 225 / 299 — the rim is present at every rotation |
| background not pure black | above 0,0,0 | yes — **no pixel anywhere in the encoded file is rgb(0,0,0)**; the darkest is rgb(6,7,12) |
| banding scanlines | smooth | mean run length 3.0–4.2 px in the deep shadows, values dithered (…22, 23, 24, 25, 23, 24…) rather than stepped |

Two things had to be fixed here:

1. **The rim dropped out at some rotations.** With a single rim light from
   behind-right, the rotations where it rakes past the silhouette left the frame
   with no edge line at all — frame 75 peaked at rgb 102, i.e. no rim anywhere.
   Two weaker counter-rims and a broader rim blob in the procedural environment
   now keep the line continuous all the way round; frame 75 peaks at 255.
2. **Grain and dither were being applied in linear space.** The effect chain
   runs linear and postprocessing converts to sRGB in the final write, so a
   "2% film grain" was 2% *of linear light* — imperceptible in the highlights
   and a ~30% swing on the dark version's near-black backdrop, which crushed
   0.1% of the frame to pure black and read as colour noise rather than grain.
   The grain pass now converts to sRGB, perturbs, and converts back, and the
   backdrop's own dither is applied multiplicatively. After the fix the darkest
   background pixel is rgb(8,9,13) rather than rgb(0,0,0).

**Caveat on the read test.** The ordering "shadowed face darker than the
background" holds at frames 0 and 75, but not at every rotation. At frame 150 —
where the band covers 57% of the frame and only the darkest part of the backdrop
is still visible — the band's shadowed face sits marginally *above* the
background (rgb ~20 vs ~16). The lit edge is still at 248 there, so the three
samples are nowhere near a narrow value range and the shape reads clearly; but
the strict ordering the brief asks for is a frame-75 result, not a
every-frame result. Reported rather than glossed.

On banding in the dark version specifically: a vertical scanline through the
backdrop run-length encodes as `24x6 23x2 24x19 23x1 22x2 23x3 24x5 …`, i.e. the
value alternates between adjacent levels rather than sitting in long constant
runs with abrupt ±1 jumps between them. Run lengths average 3–4 px with
occasional 24–28 px runs; with only ~34 distinct 8-bit levels available across
the whole near-black range, that is the floor of what 8-bit output can represent
and it is dithered, not banded.

---

## Step 5 — Independent visual comparison

Run twice, each time by a fresh sub-agent given only a reference frame, a frame
from the V1 render at matched resolution, and the comparison instruction —
nothing about how the scene was built or what the brief asked for.

### Round 1 — acted on

| finding | action |
|---|---|
| camera far too close, loop not legible | pulled back: camera distance 2.05 (was 1.75 effective), silhouette fill dropped from 0.36 mean to 0.33 mean with much more negative space |
| ribbon 2–3× too wide, reads as sheets not a ribbon | width 0.44·R → 0.34·R → **0.30·R** |
| contrast crushed, never reaches white | switched tone mapping AgX → **ACES Filmic**; band peak went 0.84 → 0.965, median landed on the reference's 0.648 exactly |
| no specular, reads as matte paper | raised `envMapIntensity` 0.85 → 1.35, roughness 0.65 → 0.56, added clearcoat |
| light direction flipped — reference is keyed from the **right** | verified independently by quadrant means on the reference (BR 222.0 brightest, BL 206.2 darkest), then re-keyed from screen-upper-right and made the background falloff diagonal toward the lower left. Lights are now specified in camera basis so "key from screen upper right" survives re-framing |
| no contact/occlusion darkening | root-caused to the `normalBias` bug above |
| cool cast lost | cooled material, key, ambient and background |

### Round 2 — acted on, partially

| finding | action |
|---|---|
| ribbon still ~2× too wide | width 0.34·R → **0.30·R** |
| brightness lifted and compressed (mean 228.6 vs reference 214.0) | deepened the backdrop floor and raised the key; frame 75 now has mean luminance 0.695 vs the reference's 0.680 |
| neutral rather than cool | pushed the cool cast: mean B−R went 4.0 → **6.4** on the final encode (reference 8.1) |
| band thickness / edge face missing | **not a real miss** — the critic was shown a 768px downscale, where an 11px-at-4K edge face is ~2px. Confirmed present by inspecting a 4K still at 100% |
| hard-edged shadows, no gradient | partly a frame-choice artifact — the frame supplied was the *densest* rotation in the loop, where most "shadow" boundaries the critic saw are surface boundaries between the lit face and the shadowed face, not cast shadows |

---

## Known gaps — not resolved

These are real and I did not resolve them. They are listed rather than buried.

1. **The loop never reads as a complete, freely-floating ellipse the way the
   reference does.** This is a direct conflict inside the brief. The brief
   states as a non-negotiable composition rule that "the band must be cropped by
   all four frame edges … at every frame of the rotation", and its own step 3
   checks it. The reference clip does **not** do this — measured on the
   reference frame at t=1.5s, the band is cropped at the top and left only; the
   right third and the lower-right are open background. Satisfying the four-edge
   rule at *every* rotation forces the camera close enough that the loop is
   always partly out of frame. I chose to satisfy the explicit, checkable rule
   and accept the departure from the reference, and both critics flagged the
   consequence. If the reference's framing is what matters more, relax the
   four-edge rule and pull the camera back to roughly distance 2.6–2.8 — the
   rig is unchanged otherwise.

2. **Cool cast is still short of the reference.** Mean B−R is 6.4 against the
   reference's 8.1 (on means of ~214 and ~211 respectively — a 3.0% vs 3.8%
   tilt). Pushing further started to read as a blue tint rather than a cool
   white, so I stopped. Small, but it is a measurable gap.

3. **Frame 0 is the sparsest composition in the loop** (silhouette fill 0.184
   against a 0.18–0.60 range across the rotation). Since the loop is seamless there is no
   privileged start frame, and the harvested stills use the fuller rotations,
   but a thumbnail taken at t=0 is not the strongest frame. `ROTATION_PHASE_DEG`
   in `src/ribbon/params.ts` shifts which composition lands on frame 0 and costs
   nothing but a re-render.

4. **The 4K render time is an estimate, not a measurement.** See below.

---

## Deliverables produced

| file | format |
|---|---|
| `out/TwistedRibbon_Light.mp4` | 1920×1080, 30fps, 10.0 s, h264 / yuv420p, no audio |
| `out/TwistedRibbon_Dark.mp4` | 1920×1080, 30fps, 10.0 s, h264 / yuv420p, no audio |
| `out/still_light_1080.png`, `out/still_dark_1080.png` | 1920×1080 PNG |
| `out/still_{light,dark}_f130.png`, `_f165.png`, `_f205.png` | 6000×3375 PNG, three rotations per version |
| `twisted-ribbon-project.zip` | source, config, pinned `package.json` + lockfile, README, this report — no `node_modules`, `.git` or render output |

Clean-copy check: unzipped into an empty directory, `npm install` succeeded
(312 packages), `npm run lint`, `npm run verify:geometry` and
`npm run verify:framing` all passed, and `npx remotion studio` booted and served
HTTP 200.

## Step 6 — Render time

Measured on a 4-core cloud container with **no GPU**, `--gl=swiftshader`,
`--concurrency=3`, software rasterisation throughout.

| | per frame (wall) | 300 frames |
|---|---|---|
| 1080p, `TwistedRibbonLight` | **5.02 s** | 25 min 07 s |
| 1080p, `TwistedRibbonDark` | **5.38 s** | 26 min 54 s |
| 6000×3375 single still | 32–37 s | — |
| **4K (`--scale=1`), estimate** | ~20 s | ~1 h 40 m |

The 4K number is extrapolated by pixel count (4× the 1080p area) and is *not*
measured. The cost is dominated by fill rate — 8× MSAA into a half-float target,
a full-resolution depth-of-field pass, and PCSS sampling a 4096² shadow map —
not by geometry, which is only 14,400 triangles. A single 4K still measured
12.3 s wall including browser startup, which is consistent with the
extrapolation. On a machine with a real GPU expect this to drop by more than an
order of magnitude; these figures are a software rasteriser's worst case.

---

## What needed fixing along the way

Three of these were silent failures that would not have shown up without a
deliberate check:

- **The first frame every render thread touched came out black.**
  `@react-three/postprocessing` publishes its composer through React state, so
  on the commit where the composer is created its `useFrame` closure still sees
  `null` and draws nothing — and `@remotion/three` calls `advance()` from a
  passive effect on that same commit. `src/ribbon/ComposerSync.tsx` holds a
  `delayRender()` across two animation frames and re-advances.
- **Self-shadowing was completely absent** because `shadow.normalBias` exceeded
  the band's thickness.
- **Grain and dither were applied in linear space**, which crushed the dark
  version's backdrop to pure black.
- **Depth of field blurred twice as hard at 1080p as at 4K**, because
  postprocessing measures the bokeh kernel in texels. `bokehScale` is now
  normalised against the drawing-buffer width, so the 1080p preview is an honest
  preview of the 4K render.
