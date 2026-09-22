# Fat Cell Clusters

Nine compositions across four looks: clusters of stored-fat cells, floating,
filling the frame as tissue, or deflating, in soft light under a real
depth-of-field falloff.

Remotion + `@remotion/three` (react-three-fiber, WebGL2). 30fps, 300 frames
(10s), 16:9, compositions defined at **3840x2160**.

> **There are no human figures anywhere in this project** — no body, no torso,
> no silhouette, no skin, no anatomical form, in any composition, at any frame.
> The clips are cell sections only. Nothing here names a condition, a tissue
> type or a body region, and nothing implies a treatment outcome.

---

## Quick start

```bash
npm install
npx remotion studio
```

Headless Chromium needs ANGLE; `remotion.config.ts` already sets
`Config.setChromiumOpenGlRenderer("angle")`. On a machine with no GPU this
falls through to SwiftShader, which works but is much slower — see
**Render times** below.

`remotion.config.ts` also raises the delay-render timeout to 300s. The cluster
geometry is built once per render process at module scope, and
`PackedTissue-Golden` carries about a million triangles, so the first frame can
take well over the 30s default before anything is drawn. Renders fail outright
with `Timeout (30000ms) exceeded rendering the component initially` without
this, and 4K is slower still.

---

## The four looks

| # | Look | Compositions | Loops? |
|---|------|-------------|--------|
| 1 | Floating Cluster | `FloatingCluster-Beige`, `FloatingCluster-CoolGrey`, `FloatingCluster-Minimal` | yes |
| 2 | Packed Tissue | `PackedTissue-Golden`, `PackedTissue-White` | yes |
| 3 | Shrinking Cell | `ShrinkingCell-Warm`, `ShrinkingCell-Cool` | **no** |
| 4 | Dark Fibre | `DarkFibre-Orange`, `DarkFibre-Teal` | yes |

### Look 3 is not a loop

`ShrinkingCell-Warm` and `ShrinkingCell-Cool` run their deflation once, start to
finish. By frame 260 every cell is fully deflated; the last 40 frames are
fragments drifting in a near-empty frame. **Do not keyword these two as
seamless loops, and do not make them loop.** The one-way shrink is the product
— a buyer licensing the clip wants the fat to go away, and looping it back to
full size makes it useless for the narrative it sells.

The other seven compositions are exact 300-frame loops: frame 300 is
pixel-identical to frame 0.

---

## Rendering

### 4K master, per composition

```bash
npx remotion render FloatingCluster-Beige   out/FloatingCluster_Beige.mp4   --scale=1 --crf=16
npx remotion render FloatingCluster-CoolGrey out/FloatingCluster_CoolGrey.mp4 --scale=1 --crf=16
npx remotion render FloatingCluster-Minimal out/FloatingCluster_Minimal.mp4 --scale=1 --crf=16
npx remotion render PackedTissue-Golden     out/PackedTissue_Golden.mp4     --scale=1 --crf=16
npx remotion render PackedTissue-White      out/PackedTissue_White.mp4      --scale=1 --crf=16
npx remotion render ShrinkingCell-Warm      out/ShrinkingCell_Warm.mp4      --scale=1 --crf=16
npx remotion render ShrinkingCell-Cool      out/ShrinkingCell_Cool.mp4      --scale=1 --crf=16
npx remotion render DarkFibre-Orange        out/DarkFibre_Orange.mp4        --scale=1 --crf=16
npx remotion render DarkFibre-Teal          out/DarkFibre_Teal.mp4          --scale=1 --crf=16
```

Codec, pixel format and CRF default correctly from `remotion.config.ts`
(h264 / yuv420p / 16); the flags above are explicit so the command stands alone.
**No composition has an audio track** — these are silent motion graphics, and
the absence is a property of the render config, not something stripped
afterwards.

### 1080p preview

```bash
npx remotion render <id> out/<name>.mp4 --scale=0.5 --crf=16
```

`--scale=0.5` on a 3840x2160 composition gives exactly 1920x1080. Depth of
field is quoted for the 2160p master and scaled by the height actually being
rendered, so a preview and a 4K master show the same blur rather than the same
pixel count.

### Stills

```bash
npx remotion still <id> out/stills/<name>_f<frame>.png --frame=<frame> --scale=1.5625
```

`--scale=1.5625` on a 3840-wide composition gives **6000x3375**. The frames to
harvest are stored per composition in the `stills` field of its data row
(`src/fatcells/looks.ts`), three per composition. For look 3 they are spread
across the collapse — full, half-collapsed, fragments — which gives three
genuinely different images rather than three near-duplicates.

```bash
# every still for every composition, at 6000x3375
node scripts/stills.mjs
```

PNG, no compression artifacts, dither kept.

---

## Render times

Measured on this build at **1920x1080** (`--scale=0.5`), headless Chromium on
**SwiftShader — software rasterisation, no GPU**, 4 cores, concurrency 3:

| Composition | Wall clock | Per frame |
|---|---|---|
| FloatingCluster_Beige | 1170 s | 3.90 s |
| FloatingCluster_CoolGrey | 1137 s | 3.79 s |
| FloatingCluster_Minimal | 1056 s | 3.52 s |
| PackedTissue_Golden | 1628 s | 5.43 s |
| PackedTissue_White | 1313 s | 4.38 s |
| ShrinkingCell_Warm | 1183 s | 3.94 s |
| ShrinkingCell_Cool | 1044 s | 3.48 s |
| DarkFibre_Orange | 1057 s | 3.52 s |
| DarkFibre_Teal | 1172 s | 3.91 s |
| **All nine** | **2 h 58 m** | **4.0 s mean** |

`PackedTissue_Golden` is the outlier: it carries roughly a million triangles.

Cost scales close to the pixel count, so a 4K frame is about **4x** a 1080p
frame on the same machine — call it **16 s a frame, 80 minutes a composition,
12 hours for all nine** on hardware like this. On a real GPU both figures drop
by an order of magnitude. Measure on your own hardware before planning a batch.

The build-time geometry pass (cell packing and marching cubes) runs once per
render process, not per frame. It costs under a second for most compositions
and about six seconds for `PackedTissue-Golden`, which carries roughly a
million triangles.

---

## Verifying banding

Large smooth beige and grey gradients across a 4K frame band badly in 8-bit
H.264, and these palettes sit in the warm mid-tones where it shows worst. Two
defences are already in: a +/-1/255 ordered dither on the background gradient
and on the diffuse shading, applied before tonemapping, and film grain at
1.6-2.2% that is a deterministic hash of `(pixel, frame)` — never
`Math.random()` — fed `frame % 300` on the looping compositions so it repeats
with the loop.

One thing to know before tuning `grain`: the effect stage runs on the
composer's linear half-float buffer, not on 8-bit display values, so a given
amplitude lands on screen about a quarter of its nominal size. The grain shader
carries a `TO_DISPLAY` factor to compensate, and the row values are quoted as
what actually reaches the file. Without it, 2% grain moved the output by barely
one code value and the background plateaus survived untouched.

**Check the encoded mp4, not the studio preview:**

```bash
npx remotion ffmpeg -y -ss 5 -i out/FloatingCluster_Beige.mp4 -frames:v 1 /tmp/band.png
node scripts/scanline.mjs /tmp/band.png
```

`scripts/scanline.mjs` walks one horizontal and one vertical scanline across the
background and reports the longest run of a single value, how many distinct
values the line holds, and what fraction of neighbouring pixels differ. A
dithered gradient changes value on most pixels; stepped plateaus — long runs of
one value with abrupt jumps between them — mean banding.

It reports clipped runs separately and does not count them. A flat run at the
top of the range is an exposure problem, not a quantisation one, and scoring it
as banding sends you chasing grain that cannot help.

If bands survive, raise `grain` in the composition's data row toward 0.025,
then lower CRF toward 14.

---

## Adding a look

Add one row to `LOOKS` in `src/fatcells/looks.ts`. Nothing else needs to
change: `src/Root.tsx` registers a composition for every row, and the cluster
generator, material, motion system, camera rig and post chain are fixed.

A row carries the palette (cell, crevice and rim colours, background gradient,
mottling, occlusion), the lighting rig, the framing (field of view, and how
much of the frame the hero fills — the camera distance is derived from the
cluster that actually gets built, so changing the cell count reframes rather
than silently changing the shot), the packing (cell count, density, overlap,
crease size, cluster shape), the depth of field, the grain, and which frames
the stills harvest samples.

```ts
{
  id: "FloatingCluster-Sage",       // composition id, and the studio label
  file: "FloatingCluster_Sage",     // output file base name
  kind: "floating",                 // floating | tissue | shrinking | fibre
  seed: "floating-sage-12",         // seeds every build-time draw
  loops: true,                      // false only for the shrinking look
  palette: { /* ... */ },
  lighting: WARM_LIGHT,
  camera: { fov: 36, fill: 0.82 },
  dof: { focusDistance: 0, focusRange: 6.5, bokehScale: 17, resolutionScale: 0.25 },
  grain: 0.02,
  heroCells: 46, heroResolution: 140, blend: 0.13, overlap: 0.13, density: 0.8,
  extent: [1.05, 1.0, 0.95],
  backdropCount: 7, backdropDepth: [-30, 8],
  drift: 0.11, specks: 90, membrane: 0, fibres: 0,
  stills: [40, 150, 250],
}
```

`kind` picks which scene the generator assembles; everything else is a number
or a colour.

---

## How it is built

`src/fatcells/`

| file | what it does |
|---|---|
| `random.ts` | mulberry32, seeded once per composition at module level |
| `field.ts` | the exponential smooth-minimum field the cells are surfaced from |
| `cluster.ts` | packing: scatter, then a fixed number of relaxation passes |
| `isosurface.ts` | marching cubes, with baked occlusion and per-cell attributes |
| `geometry.ts` | isosurface to BufferGeometry |
| `build.ts` | assembles a whole scene, once, at module scope |
| `CellMaterial.ts` | the cell surface |
| `MembraneMaterial.ts` | the film over the packed tissue |
| `motion.ts` | closed drifts, whole-turn rotations, deflation timing |
| `Scene.tsx`, `Background.tsx`, `Fibres.tsx`, `Specks.tsx`, `Grain.tsx` | the scene |
| `looks.ts` | the nine data rows |

**Geometry.** Cells are packed into a target ellipsoid whose volume comes from
the cell count at a given density, so a look's `extent` carries shape only. A
short relaxation settles them into contact without deep interpenetration. The
cluster is then surfaced as a marching-cubes mesh over a smooth-minimum field
with a small smoothing constant — enough to crease the contacts, not enough to
melt the cells into one blob. Ambient occlusion is sampled from the field along
each vertex normal and baked in as a vertex attribute; the deep amber in the
gaps between packed cells is mostly that.

**Material.** No transmissive material anywhere. These cells are dense and
waxy, not glass, and `transmission` is both the most expensive material in the
library and the wrong model. The warm interior glow is wrapped diffuse
(`max(0, (dot(N,L) + w) / (1 + w))`, w = 0.5), a fresnel rim in the cell's own
hue, a little light bleeding through from behind, and a warm grazing-angle
sheen. Roughness about 0.45, metalness zero.

**Deflation.** Look 3 needs no soft-body solver. A cell emptying of fat is a
sphere whose radius falls while its surface crumples, and both are functions of
one parameter: `r(u) = r0 * (1 - shrink * u)` and `amp(u) = A * u^2`. The
quadratic matters — a cell that crumples linearly looks like it is being
crushed from outside, while one that stays smooth until it is well down in
volume and then folds looks like it is emptying. The folds are biased inward
and their noise field turns as it collapses, so they travel rather than just
deepening. Each cell starts at its own offset, so the cluster comes apart over
the clip.

On this look each cell is surfaced as its own closed mesh, dished where its
neighbours press into it by a smooth subtraction, rather than all of them
merging into one. A merged mesh cannot come apart: as two cells empty toward
their own centres the crease between them stretches into a long flat strip.

---

## Determinism

Remotion renders frames out of order across several threads, so every value on
screen is a pure function of `useCurrentFrame()`.

- No `useFrame` clock, no `Date.now()`, no delta accumulation.
- No `Math.random()` at render time. A `mulberry32` is seeded at module level
  from the composition id and every value — cell positions, radii, packing,
  noise seeds, rotation axes, Lissajous frequencies and phases, deflation
  offsets and spans, fibre paths, speck paths — is drawn once, at build time.
- Marching-cubes meshes are generated once, at module scope. Deflation happens
  in the vertex shader and by rigid transform, never by rebuilding geometry.
- No mutable state between frames, no `useState` driving visuals, no physics
  solver.
- Nothing in the post chain accumulates across frames: no TAA, no temporal
  motion blur, no temporally denoised occlusion, no `AccumulativeShadows`.
  Depth of field is a pure spatial shader. There is no bloom — none of the
  references glow.

**Self-check.** Rendering frame 150 alone from a cold start must produce a
byte-identical PNG to frame 150 from a full sequential render:

```bash
npx remotion render <id> out/seq --sequence --image-format=png --frames=140-160
npx remotion render <id> out/one --sequence --image-format=png --frames=150-150
cmp out/seq/element-150.png out/one/element-150.png
```

---

## Completion checklist

- [ ] `ffprobe` reports exactly 1920x1080, 30/1, 10.0s, h264, yuv420p, and **no
      audio stream** on every preview.
- [ ] Ten evenly spaced frames from every composition contain no human body,
      torso, limb, silhouette, skin surface or anatomical form.
- [ ] Frame 300 equals frame 0 on all seven looping compositions (render 301
      frames; comparing 0 to 299 shows a one-step difference and is not a
      failure).
- [ ] Look 3's frame 300 does **not** resemble its frame 0.
- [ ] Frame 150 rendered alone is byte-identical to frame 150 from a sequential
      render.
- [ ] Individual cells are countable; contacts are soft creases, not hard
      intersection seams; crevices are visibly darker than the cell faces; cell
      edges glow warmly at grazing angles; sharpness falls off gradually across
      depth; the background is not visible through any cell.
- [ ] No background pixel in the sharp layer on `PackedTissue-Golden`.
- [ ] Background gradients show no stepped plateaus on the encoded mp4.

---

## Packaging

`fat-cell-cluster-project.zip` contains the whole project ready to render at 4K
elsewhere: source, `remotion.config.ts`, `package.json` with pinned versions and
this README. `node_modules`, `.git` and render output are excluded. `npm install
&& npx remotion studio` works from a clean copy.
